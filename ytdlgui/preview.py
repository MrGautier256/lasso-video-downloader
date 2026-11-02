"""Aperçu d'une vidéo pour l'éditeur de passages.

Ordre des solutions (cf. README) :
1. lecture en flux par le proxy local, au plus 720p, dans un format que le moteur de la
   page déclare lire : variante HLS (YouTube : saut rapide, segments courts) jouée par
   hls.js avec le son à part, sinon un format progressif image + son, sinon image et son
   séparés ;
2. aperçu local : yt-dlp télécharge une version 720p lisible, servie ensuite par le proxy ;
3. sans lecture : vignettes, chapitres et saisie des temps restent utilisables.
"""
import json
import os
import re
import secrets
import signal
import subprocess
import threading
import time
import urllib.parse

from . import clips
from . import command as cmdmod
from .binaries import CREATE_NO_WINDOW, IS_WINDOWS
from .engine import RE_PROGRESS
from .streamproxy import Target, Upstream

MAX_HEIGHT = 720
RE_FORMATS = re.compile(r"Downloading \d+ format\(s\): (\S+)")


# ------------------------------------------------------------------ codecs
def codec_family(codec):
    c = (codec or "").lower()
    if not c:
        return None            # inconnu (beaucoup de sites ne le précisent pas)
    if c == "none":
        return "none"
    for prefix, fam in (("avc", "h264"), ("h264", "h264"), ("vp09", "vp9"), ("vp9", "vp9"), ("vp8", "vp9"),
                        ("av01", "av1"), ("hev", "hevc"), ("hvc", "hevc"), ("mp4a", "aac"), ("aac", "aac"),
                        ("opus", "opus"), ("vorbis", "opus"), ("mp3", "mp3")):
        if c.startswith(prefix):
            return fam
    return c


def playable(codec, caps):
    fam = codec_family(codec)
    if fam is None or fam == "mp3":
        return True
    if fam == "none":
        return False
    return bool(caps.get(fam))


def _height(f):
    return f.get("height") or 0


def _has_video(f):
    return f.get("vcodec") != "none" and (f.get("vcodec") or f.get("height") or f.get("width"))


def _has_audio(f):
    return f.get("acodec") != "none"


def _video_key(f, caps):
    pref = {"h264": 3, "vp9": 2, "av1": 1}.get(codec_family(f.get("vcodec")), 0)
    return (_height(f), pref, f.get("fps") or 0)


def _audio_key(f):
    note = (f.get("format_note") or "").lower()
    abr = f.get("abr") or f.get("tbr") or 128
    return (f.get("language_preference") or 0, "drc" not in note, -abs(abr - 128))


def _mime(f, audio=False):
    ext = (f.get("ext") or "").lower()
    kind = "audio" if audio else "video"
    if ext in ("m4a", "mp4", "m4v"):
        return "%s/mp4" % kind
    if ext in ("webm", "weba"):
        return "%s/webm" % kind
    if ext == "mp3":
        return "audio/mpeg"
    return None


def pick_sources(info, caps):
    """Choisit les formats de l'aperçu ; renvoie (mode, vidéo, audio) avec mode parmi
    "hls", "progressive", "dual" ou "none"."""
    formats = [f for f in info.get("formats") or []
               if f.get("url") and not f.get("has_drm") and f.get("protocol") != "mhtml"
               and not str(f.get("format_id", "")).startswith("sb")]

    def video_ok(f):
        return _has_video(f) and playable(f.get("vcodec"), caps) and _height(f) <= MAX_HEIGHT

    audios = [f for f in formats if not _has_video(f) and _has_audio(f)
              and f.get("protocol") in ("https", "http") and playable(f.get("acodec"), caps)]
    audio = max(audios, key=_audio_key) if audios else None

    https = [f for f in formats if f.get("protocol") in ("https", "http") and video_ok(f)]
    prog = [f for f in https if _has_audio(f) and playable(f.get("acodec"), caps)]
    best_prog = max(prog, key=lambda f: _video_key(f, caps)) if prog else None

    hls = []
    if caps.get("mse"):
        hls = [f for f in formats if f.get("protocol") in ("m3u8", "m3u8_native") and video_ok(f)
               and (_has_audio(f) and playable(f.get("acodec"), caps) or audio is not None)]
    best_hls = max(hls, key=lambda f: _video_key(f, caps)) if hls else None

    if best_prog and (not best_hls or _height(best_prog) >= _height(best_hls)):
        return "progressive", best_prog, None
    if best_hls:
        return "hls", best_hls, (None if _has_audio(best_hls) else audio)
    vonly = [f for f in https if not _has_audio(f)]
    if vonly and audio:
        return "dual", max(vonly, key=lambda f: _video_key(f, caps)), audio
    return "none", None, None


def storyboard(info):
    """Planches de vignettes (formats sb* de yt-dlp) : la plus détaillée."""
    boards = [f for f in info.get("formats") or []
              if str(f.get("format_id", "")).startswith("sb") and f.get("fragments") and f.get("fps")]
    if not boards:
        return None
    sb = max(boards, key=lambda f: f.get("width") or 0)
    return {"w": sb.get("width"), "h": sb.get("height"), "cols": sb.get("columns") or 1,
            "rows": sb.get("rows") or 1, "fps": sb.get("fps"),
            "sheets": [{"url": fr.get("url"), "duration": fr.get("duration")} for fr in sb["fragments"]]}


def light_info(info):
    return {
        "title": info.get("title"), "duration": info.get("duration"),
        "uploader": info.get("uploader") or info.get("channel"), "thumbnail": info.get("thumbnail"),
        "live_status": info.get("live_status"),
        "chapters": [{"start": c.get("start_time"), "end": c.get("end_time"), "title": c.get("title")}
                     for c in info.get("chapters") or [] if c.get("end_time") is not None],
        "heatmap": [[h.get("start_time"), h.get("end_time"), h.get("value")] for h in info.get("heatmap") or []],
    }


def local_format(caps):
    """Format de l'aperçu local : 720p au plus, dans des codecs lisibles par la page."""
    if caps.get("h264") and caps.get("aac"):
        return ("bv*[height<=720][vcodec^=avc1]+ba[acodec^=mp4a]/b[height<=720][vcodec^=avc1]"
                "/bv*[height<=720]+ba/b[height<=720]/b", "mp4")
    if caps.get("vp9") and caps.get("opus"):
        return ("bv*[height<=720][vcodec^=vp9]+ba[acodec=opus]/bv*[height<=720][vcodec^=vp09]+ba[acodec=opus]"
                "/bv*[height<=720]+ba/b[height<=720]/b", "webm/mkv")
    return "bv*[height<=720]+ba/b[height<=720]/b", "mp4"


# ------------------------------------------------------------------ sessions
class Session:
    def __init__(self, sid, url):
        self.sid = sid
        self.url = url
        self.info = None
        self.work_dir = None
        self.proc = None
        self.closed = False


class Previews:
    """Sessions d'aperçu ouvertes par l'éditeur. `push` envoie un événement à la page,
    `paths()` donne (yt-dlp, ffmpeg) et `config()` une copie des réglages."""

    def __init__(self, proxy, push, paths, config):
        self._proxy = proxy
        self._push = push
        self._paths = paths
        self._config = config
        self._sessions = {}
        self._lock = threading.Lock()

    def open(self, url, caps):
        ytdlp, _ = self._paths()
        if not ytdlp:
            return {"need": "ytdlp"}
        cfg = self._config()
        s = Session(secrets.token_hex(6), url)
        with self._lock:
            self._sessions[s.sid] = s
        try:
            info = clips.resolve(ytdlp, cfg, url, on_proc=lambda p: setattr(s, "proc", p))
            clips.check_clippable(info)
        except clips.ClipError as exc:
            self.close(s.sid)
            return {"error_key": exc.key} if exc.key else {"error": exc.detail}
        except Exception as exc:
            self.close(s.sid)
            return {"error": str(exc)}
        if s.closed:
            return None
        s.info = info
        s.work_dir = clips.make_work_dir(clips.PREVIEW_PREFIX)
        with open(os.path.join(s.work_dir, "info.json"), "w", encoding="utf-8") as f:
            json.dump(info, f)
        try:
            sources = self._sources(s, caps, ytdlp, cfg)
        except Exception:
            sources = {"mode": "none"}
        threading.Thread(target=self._estimate, args=(s, ytdlp, cfg), daemon=True).start()
        return {"sid": s.sid, "url": url, "info": light_info(info), "storyboard": storyboard(info),
                "sources": sources}

    def _key(self, s, name):
        return "p%s/%s" % (s.sid, name)

    def _sources(self, s, caps, ytdlp, cfg):
        proxy_url = (cfg.get("proxy") or "").strip()
        if proxy_url and not proxy_url.lower().startswith(("http://", "https://")):
            return {"mode": "none", "reason": "socks"}   # le proxy local ne sait pas relayer en SOCKS
        mode, video, audio = pick_sources(s.info, caps)
        if mode == "none":
            return {"mode": "none"}
        renew = clips.renewer(ytdlp, cfg, s.url)
        out = {"mode": mode, "fps": video.get("fps") or s.info.get("fps") or 25,
               "height": _height(video), "vcodec": video.get("vcodec")}
        if mode == "hls":
            out["video"] = {"url": self._hls(s, video), "hls": True}
        else:
            out["video"] = {"url": self._proxy.add(self._key(s, "v"), Target(
                video["url"], video.get("http_headers"), video.get("cookies"), mime=_mime(video),
                renew=lambda fid=str(video.get("format_id")): renew(fid))), "mime": _mime(video)}
        if audio is not None:
            out["audio"] = {"url": self._proxy.add(self._key(s, "a"), Target(
                audio["url"], audio.get("http_headers"), audio.get("cookies"), mime=_mime(audio, True),
                renew=lambda fid=str(audio.get("format_id")): renew(fid))), "mime": _mime(audio, True)}
        return out

    def _hls(self, s, fmt):
        """Playlist HLS réécrite pour que chaque segment passe par le proxy : la page ne
        peut pas les lire directement (CORS, en-têtes)."""
        headers, cookies = fmt.get("http_headers") or {}, fmt.get("cookies")
        counter = [0]
        proxy_net = self._config().get("proxy", "").strip()

        def register(url, depth):
            if urllib.parse.urlsplit(url).path.endswith(".m3u8") and depth < 2:
                return rewrite(url, depth + 1)
            counter[0] += 1
            return self._proxy.add(self._key(s, "h/%d" % counter[0]), Target(url, headers, cookies))

        def rewrite(url, depth):
            up = Upstream(url, headers, cookies or "", proxy_net)
            try:
                resp, _ = up.get(0)
                text = resp.read().decode("utf-8", "replace")
            finally:
                up.close()
            lines = []
            for line in text.splitlines():
                if line.startswith("#"):
                    line = re.sub(r'URI="([^"]+)"', lambda m: 'URI="%s"' % register(
                        urllib.parse.urljoin(url, m.group(1)), depth), line)
                elif line.strip():
                    line = register(urllib.parse.urljoin(url, line.strip()), depth)
                lines.append(line)
            counter[0] += 1
            return self._proxy.add(self._key(s, "m/%d.m3u8" % counter[0]), Target(
                data="\n".join(lines).encode("utf-8"), mime="application/vnd.apple.mpegurl"))

        return rewrite(fmt["url"], 0)

    def _estimate(self, s, ytdlp, cfg):
        """Taille du téléchargement complet avec les réglages actuels (choix du format sans
        réseau, depuis le JSON déjà obtenu) : l'éditeur la répartit au prorata des passages."""
        cmd = [ytdlp, "--load-info-json", os.path.join(s.work_dir, "info.json"), "-j", "--no-warnings",
               "--no-playlist"] + cmdmod.format_args(cfg, {"sections": [[0, 1]]})
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=60, encoding="utf-8",
                                 errors="replace", creationflags=CREATE_NO_WINDOW).stdout
            data = json.loads(out.splitlines()[-1])
        except Exception:
            return
        total = 0
        for f in data.get("requested_formats") or [data]:
            size = f.get("filesize") or f.get("filesize_approx")
            if not size and f.get("tbr") and s.info.get("duration"):
                size = f["tbr"] * 125 * s.info["duration"]
            total += size or 0
        if total and not s.closed:
            self._push({"type": "preview_estimate", "sid": s.sid, "bytes": int(total)})

    # ---------------------------------------------------------- aperçu local
    def local(self, sid, caps):
        s = self._sessions.get(sid)
        if s is None or s.closed:
            return False
        threading.Thread(target=self._local_worker, args=(s, caps), daemon=True).start()
        return True

    def _local_worker(self, s, caps):
        ytdlp, ffmpeg = self._paths()
        cfg = self._config()
        fmt, merge = local_format(caps)
        cmd = [ytdlp, "--newline", "--progress", "--no-playlist", "--no-warnings", "-f", fmt,
               "--merge-output-format", merge, "-P", s.work_dir, "-o", "preview.%(ext)s"]
        if ffmpeg:
            cmd += ["--ffmpeg-location", ffmpeg]
        cmd += cmdmod.build_network_args(cfg) + [s.url]
        parts, index, last, tail = 1, 0, 0.0, []
        try:
            s.proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                      stdin=subprocess.DEVNULL, text=True, encoding="utf-8", errors="replace",
                                      creationflags=CREATE_NO_WINDOW, start_new_session=not IS_WINDOWS)
            for line in s.proc.stdout:
                line = line.rstrip()
                tail = (tail + [line])[-5:]
                m = RE_FORMATS.search(line)
                if m:
                    parts = m.group(1).count("+") + 1
                if "[download] Destination:" in line:
                    index += 1
                m = RE_PROGRESS.match(line)
                if m and time.time() - last > 0.25:
                    last = time.time()
                    pct = (max(index, 1) - 1 + float(m.group("pct")) / 100.0) * 100.0 / parts
                    self._push({"type": "preview_progress", "sid": s.sid, "pct": round(min(pct, 99.0), 1)})
            rc = s.proc.wait()
        except Exception as exc:
            rc, tail = -1, [str(exc)]
        if s.closed:
            return
        path = None
        if rc == 0:
            for name in os.listdir(s.work_dir):
                if name.startswith("preview.") and not name.endswith((".part", ".ytdl", ".json")):
                    path = os.path.join(s.work_dir, name)
        if not path:
            self._push({"type": "preview_failed", "sid": s.sid, "error": "\n".join(tail)[-500:]})
            return
        ext = os.path.splitext(path)[1].lower()
        mime = {".mp4": "video/mp4", ".webm": "video/webm", ".mkv": "video/x-matroska"}.get(ext, "video/mp4")
        url = self._proxy.add(self._key(s, "local"), Target(path=path, mime=mime))
        self._push({"type": "preview_ready", "sid": s.sid, "url": url, "mime": mime})

    # ---------------------------------------------------------- fermeture
    def close(self, sid):
        with self._lock:
            s = self._sessions.pop(sid, None)
        if s is None:
            return
        s.closed = True
        proc = s.proc
        if proc is not None and proc.poll() is None:
            try:
                if IS_WINDOWS:
                    subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                                   capture_output=True, creationflags=CREATE_NO_WINDOW)
                else:
                    os.killpg(proc.pid, signal.SIGKILL)   # groupe : ffmpeg compris
            except Exception:
                pass
        self._proxy.remove_prefix("p%s/" % sid)
        clips.remove_work_dir(s.work_dir)

    def close_all(self):
        for sid in list(self._sessions):
            self.close(sid)
