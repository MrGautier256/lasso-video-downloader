"""Proxy HTTP local : relaie des flux distants (ou des fichiers locaux) vers le lecteur
de la page et vers ffmpeg.

Deux raisons d'être :
- une balise <video> ne peut pas envoyer les en-têtes et cookies qu'exige un site ;
- YouTube bride les requêtes d'un seul tenant sur ses flux DASH : yt-dlp les découpe en
  morceaux de 10 Mio, ffmpeg non (un passage lu directement par ffmpeg n'avance plus).
  Le proxy fait le même découpage, quelle que soit la plage demandée par son client.

Il n'écoute que sur 127.0.0.1, chaque chemin porte un jeton aléatoire, et il ne relaie
que des cibles enregistrées par Python : jamais une URL fournie par la page.
"""
import http.client
import http.cookies
import http.server
import mimetypes
import os
import re
import secrets
import socket
import socketserver
import ssl
import sys
import threading
import time
import urllib.parse

CHUNK = 10 * 1024 * 1024
TIMEOUT = 20
_RANGE = re.compile(r"bytes=(\d*)-(\d*)$")
_CONTENT_RANGE = re.compile(r"bytes (\d+)-(\d+)/(\d+|\*)")


class UpstreamError(Exception):
    def __init__(self, status, reason=""):
        super().__init__("%s %s" % (status, reason))
        self.status = status


class Target:
    """Ce que relaie un chemin du proxy : une URL distante avec ses en-têtes, ou un fichier.

    `renew` (facultatif) renvoie un nouveau triplet (url, headers, available_at) quand
    l'URL a expiré (403 ou 410 en amont) ; il n'est appelé qu'une fois par requête.
    `available_at` (horodatage, facultatif) : instant à partir duquel l'URL répond. YouTube
    ne valide certaines URL de flux que quelques secondes après leur extraction (yt-dlp
    attend lui aussi) ; avant, elles répondent 403.
    """

    def __init__(self, url=None, headers=None, cookies="", path=None, mime=None, renew=None, data=None,
                 available_at=None):
        self.url = url
        self.available_at = available_at
        self.headers = dict(headers or {})
        self.cookies = cookies or ""
        self.path = path
        self.data = data            # contenu en mémoire (playlist HLS réécrite)
        self.mime = mime
        self.renew = renew
        self.size = None
        self.lock = threading.Lock()


def _wait_until(available_at, limit=15.0):
    """Attend que l'URL soit valable (une demi-seconde de marge), sans dépasser `limit`."""
    if available_at:
        delay = float(available_at) + 0.5 - time.time()
        if delay > 0:
            time.sleep(min(delay, limit))


def cookie_header(cookies, host):
    """En-tête Cookie pour `host`, à partir du champ "cookies" d'un format yt-dlp
    (forme Set-Cookie, avec Domain) : seuls les cookies du domaine appelé passent."""
    if not cookies:
        return ""
    jar = http.cookies.SimpleCookie()
    try:
        jar.load(cookies)
    except http.cookies.CookieError:
        return ""
    pairs = []
    for name, morsel in jar.items():
        domain = (morsel["domain"] or "").lstrip(".").lower()
        if not domain or host == domain or host.endswith("." + domain):
            pairs.append("%s=%s" % (name, morsel.value))
    return "; ".join(pairs)


class _FamilyHTTPSConnection(http.client.HTTPSConnection):
    """Connexion HTTPS limitée à une famille d'adresses : les URL de YouTube sont liées
    à l'adresse IP (paramètre ip=) qui les a obtenues, IPv4 ou IPv6."""

    def __init__(self, host, family, **kwargs):
        super().__init__(host, **kwargs)
        self._family = family

    def connect(self):
        last = OSError("no address")
        for af, kind, proto, _, addr in socket.getaddrinfo(self.host, self.port, self._family, socket.SOCK_STREAM):
            sock = socket.socket(af, kind, proto)
            sock.settimeout(self.timeout)
            try:
                sock.connect(addr)
            except OSError as exc:
                sock.close()
                last = exc
                continue
            self.sock = self._context.wrap_socket(sock, server_hostname=self.host)
            return
        raise last


class Upstream:
    """Requêtes par plages vers une URL, en réutilisant la même connexion."""

    def __init__(self, url, headers, cookies="", proxy="", force_ipv4=False):
        self.url = url
        self.parts = urllib.parse.urlsplit(url)
        self.headers = {k: v for k, v in headers.items() if k.lower() not in ("range", "host", "cookie")}
        cookie = cookie_header(cookies, (self.parts.hostname or "").lower())
        if cookie:
            self.headers["Cookie"] = cookie
        self.proxy = proxy
        self.force_ipv4 = force_ipv4
        self.conn = None

    def _connect(self):
        host, https = self.parts.hostname, self.parts.scheme == "https"
        port = self.parts.port or (443 if https else 80)
        if self.proxy:
            p = urllib.parse.urlsplit(self.proxy)
            cls = http.client.HTTPSConnection if p.scheme == "https" else http.client.HTTPConnection
            conn = cls(p.hostname, p.port or (443 if p.scheme == "https" else 80), timeout=TIMEOUT)
            if https:
                conn.set_tunnel(host, port)
            return conn
        if not https:
            return http.client.HTTPConnection(host, port, timeout=TIMEOUT)
        ip = urllib.parse.parse_qs(self.parts.query).get("ip", [""])[0]
        if self.force_ipv4 or (ip and ":" not in ip):
            family = socket.AF_INET
        elif ip:
            family = socket.AF_INET6
        else:
            family = 0
        return _FamilyHTTPSConnection(host, family, port=port, timeout=TIMEOUT,
                                      context=ssl.create_default_context())

    def get(self, start, end=None):
        """GET d'une plage [start, end] ; renvoie (réponse, taille totale ou None)."""
        target = self.parts.path + ("?" + self.parts.query if self.parts.query else "")
        if self.proxy and self.parts.scheme != "https":
            target = self.url
        headers = dict(self.headers)
        headers["Range"] = "bytes=%d-%s" % (start, "" if end is None else end)
        for attempt in range(2):
            if self.conn is None:
                self.conn = self._connect()
            try:
                self.conn.request("GET", target, headers=headers)
                resp = self.conn.getresponse()
                break
            except (OSError, http.client.HTTPException):
                self.close()
                if attempt:
                    raise
        if resp.status not in (200, 206):
            resp.read()
            raise UpstreamError(resp.status, resp.reason)
        total = None
        m = _CONTENT_RANGE.match(resp.getheader("Content-Range") or "")
        if m and m.group(3) != "*":
            total = int(m.group(3))
        elif resp.status == 200 and resp.getheader("Content-Length"):
            total = int(resp.getheader("Content-Length"))
        return resp, total

    def close(self):
        if self.conn is not None:
            try:
                self.conn.close()
            except Exception:
                pass
            self.conn = None


class StreamProxy:
    def __init__(self, network=None):
        self.token = secrets.token_urlsafe(16)
        self.targets = {}
        self.network = network or (lambda: ("", False))   # -> (proxy réseau, forcer IPv4)
        self._lock = threading.Lock()
        self._server = None

    # ---------------------------------------------------------- cycle de vie
    def start(self):
        with self._lock:
            if self._server is not None:
                return
            proxy = self

            class Handler(_Handler):
                owner = proxy

            self._server = _Server(("127.0.0.1", 0), Handler)
            threading.Thread(target=self._server.serve_forever, daemon=True).start()

    def stop(self):
        with self._lock:
            server, self._server = self._server, None
        if server is not None:
            server.shutdown()
            server.server_close()

    @property
    def port(self):
        return self._server.server_address[1] if self._server else None

    # ---------------------------------------------------------- cibles
    def add(self, key, target):
        self.start()
        with self._lock:
            self.targets[key] = target
        return "http://127.0.0.1:%d/%s/%s" % (self.port, self.token, urllib.parse.quote(key))

    def remove_prefix(self, prefix):
        with self._lock:
            for key in [k for k in self.targets if k.startswith(prefix)]:
                del self.targets[key]

    def get(self, key):
        with self._lock:
            return self.targets.get(key)


class _Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = False

    def handle_error(self, request, client_address):
        # Le lecteur coupe souvent ses connexions (saut dans la vidéo, fermeture) :
        # rien d'anormal, inutile de l'écrire sur la sortie d'erreur.
        if not isinstance(sys.exc_info()[1], (ConnectionError, TimeoutError)):
            super().handle_error(request, client_address)


class _Handler(http.server.BaseHTTPRequestHandler):
    owner = None
    protocol_version = "HTTP/1.1"

    def log_message(self, *_args):
        pass

    def do_HEAD(self):
        self._serve(head=True)

    def do_GET(self):
        self._serve(head=False)

    def _target(self):
        parts = self.path.split("?", 1)[0].lstrip("/").split("/", 1)
        if len(parts) != 2 or not secrets.compare_digest(parts[0], self.owner.token):
            return None
        return self.owner.get(urllib.parse.unquote(parts[1]))

    def _range(self, size):
        """(début, fin incluse ou None, partiel ?) d'après l'en-tête Range."""
        m = _RANGE.match((self.headers.get("Range") or "").strip())
        if not m or (not m.group(1) and not m.group(2)):
            return 0, None, False
        if not m.group(1):                       # bytes=-N : les N derniers octets
            if size is None:
                return 0, None, False
            n = int(m.group(2))
            return max(0, size - n), size - 1, True
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else None
        return start, end, True

    def _serve(self, head):
        target = self._target()
        if target is None:
            self.send_error(404)
            return
        try:
            if target.data is not None:
                self._headers(200, target.mime, len(target.data))
                if not head:
                    self.wfile.write(target.data)
            elif target.path:
                self._serve_file(target, head)
            else:
                self._serve_remote(target, head)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass   # le lecteur a sauté ailleurs ou s'est fermé

    def _headers(self, status, mime, length, start=None, end=None, size=None):
        self.send_response(status)
        self.send_header("Content-Type", mime or "application/octet-stream")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        if length is not None:
            self.send_header("Content-Length", str(length))
        if status == 206:
            self.send_header("Content-Range", "bytes %d-%d/%s" % (start, end, size if size is not None else "*"))
        self.end_headers()

    def _serve_file(self, target, head):
        size = os.path.getsize(target.path)
        start, end, partial = self._range(size)
        end = size - 1 if end is None else min(end, size - 1)
        if start >= size:
            self.send_response(416)
            self.send_header("Content-Range", "bytes */%d" % size)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        mime = target.mime or mimetypes.guess_type(target.path)[0]
        self._headers(206 if partial else 200, mime, end - start + 1, start, end, size)
        if head:
            return
        with open(target.path, "rb") as f:
            f.seek(start)
            remaining = end - start + 1
            while remaining > 0:
                buf = f.read(min(1 << 16, remaining))
                if not buf:
                    break
                self.wfile.write(buf)
                remaining -= len(buf)

    def _serve_remote(self, target, head):
        proxy, ipv4 = self.owner.network()
        with target.lock:
            url, headers, available_at = target.url, target.headers, target.available_at
        _wait_until(available_at)
        up = Upstream(url, headers, target.cookies, proxy, ipv4)
        renewed = False
        try:
            start, end, partial = self._range(target.size)
            # Premier morceau : donne la taille totale, nécessaire aux en-têtes de réponse.
            first_end = start + CHUNK - 1 if end is None else min(end, start + CHUNK - 1)
            while True:
                try:
                    resp, total = up.get(start, first_end)
                    break
                except UpstreamError as exc:
                    if exc.status in (403, 410) and target.renew and not renewed:
                        renewed = True
                        fresh = target.renew()
                        if fresh:
                            with target.lock:
                                target.url, target.headers, target.available_at = fresh
                            up.close()
                            _wait_until(fresh[2])
                            up = Upstream(fresh[0], fresh[1], target.cookies, proxy, ipv4)
                            continue
                    if exc.status == 416:
                        self.send_response(416)
                        self.send_header("Content-Length", "0")
                        self.end_headers()
                        return
                    self.send_error(502, "upstream %s" % exc.status)
                    return
            mime = target.mime or (resp.getheader("Content-Type") or "").split(";")[0] or None
            if resp.status == 200:
                # Serveur qui ignore les plages (les segments HLS de YouTube, par exemple) :
                # il renvoie tout d'un bloc, souvent sans taille. On relaie ce bloc une fois.
                if total is not None:
                    target.size = total
                if total is None or start >= total:
                    self.close_connection = True
                    self._headers(200, mime, None)
                else:
                    self._headers(206 if partial else 200, mime, total - start, start, total - 1, total)
                if not head:
                    self._pipe(resp, 0, skip=start)
                return
            if total is not None:
                target.size = total
                end = total - 1 if end is None else min(end, total - 1)
            length = None if end is None else end - start + 1
            if length is None:
                self.close_connection = True   # taille inconnue : la fin du flux = la fermeture
            self._headers(206 if partial else 200, mime, length, start, end, total)
            if head:
                resp.close()
                return
            pos = self._pipe(resp, start)
            # Morceaux suivants, de 10 Mio chacun, jusqu'à la fin demandée.
            while end is None or pos <= end:
                chunk_end = pos + CHUNK - 1 if end is None else min(end, pos + CHUNK - 1)
                try:
                    resp, _ = up.get(pos, chunk_end)
                except UpstreamError:
                    return
                got = self._pipe(resp, pos)
                if got == pos:
                    return
                pos = got
        finally:
            up.close()

    def _pipe(self, resp, pos, skip=0):
        """Recopie la réponse amont vers le client ; `skip` octets ignorés au début.
        Renvoie la position atteinte."""
        while True:
            buf = resp.read(1 << 16)
            if not buf:
                return pos
            if skip:
                cut = min(skip, len(buf))
                buf, skip = buf[cut:], skip - cut
                if not buf:
                    continue
            self.wfile.write(buf)
            pos += len(buf)
