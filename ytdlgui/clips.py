"""Tâches à passages : préparation (résolution, routage par le proxy local) et fusion.

Une tâche à passages télécharge seulement les plages choisies dans l'éditeur, avec
--download-sections. yt-dlp confie alors la lecture du flux à ffmpeg, ce qui pose un
problème sur YouTube : ses flux DASH lus d'un seul tenant n'avancent plus (yt-dlp, lui,
les lit par morceaux de 10 Mio). La préparation résout donc la vidéo avec `yt-dlp -J`,
fait passer les flux googlevideo par le proxy local (qui découpe les requêtes) et lance
yt-dlp sur ce JSON avec --load-info-json. Les autres sites gardent le chemin normal.
"""
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import urllib.parse

from . import command as cmdmod
from .binaries import CREATE_NO_WINDOW, IS_WINDOWS
from .streamproxy import Target

CLIP_PREFIX = "ytdl-clip-"
PREVIEW_PREFIX = "ytdl-preview-"


class ClipError(Exception):
    """Erreur affichable : `key` est une clé de traduction, `detail` un texte brut."""

    def __init__(self, key=None, detail=""):
        super().__init__(detail or key or "")
        self.key = key
        self.detail = detail


def resolve(ytdlp, cfg, url, on_proc=None, timeout=180):
    """Informations complètes d'une vidéo (`yt-dlp -J`), URL de flux comprises."""
    # --flat-playlist : sur une playlist ou une chaîne, ne pas analyser chaque vidéo
    # (elle sera refusée par check_clippable) ; sans effet sur une vidéo seule.
    cmd = [ytdlp, "-J", "--no-playlist", "--flat-playlist", "--no-warnings"] + cmdmod.build_network_args(cfg) + [url]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL,
                            text=True, encoding="utf-8", errors="replace", creationflags=CREATE_NO_WINDOW,
                            start_new_session=not IS_WINDOWS)
    if on_proc:
        on_proc(proc)
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        raise ClipError(detail="yt-dlp -J : timeout")
    if proc.returncode != 0 or not out.strip():
        raise ClipError(detail=(err or "").strip()[-800:] or "yt-dlp -J : %s" % proc.returncode)
    return json.loads(out)


def check_clippable(info):
    """Refuse ce qui ne peut pas être découpé (ClipError avec une clé ed.err.*)."""
    if info.get("_type") == "playlist":
        raise ClipError("ed.err.playlist")
    status = info.get("live_status")
    if info.get("is_live") or status == "is_live":
        raise ClipError("ed.err.live")
    if status == "is_upcoming":
        raise ClipError("ed.err.upcoming")
    formats = info.get("formats") or []
    if formats and all(f.get("has_drm") for f in formats):
        raise ClipError("ed.err.drm")


def is_googlevideo(url):
    host = (urllib.parse.urlsplit(url or "").hostname or "").lower()
    return host.endswith(".googlevideo.com")


def route_through_proxy(info, proxy, prefix, renew_url=None):
    """Remplace les URL googlevideo (flux HTTPS, donc DASH ou progressifs) par des URL du
    proxy local. Les variantes HLS restent directes : leurs segments sont courts.
    Renvoie le nombre de flux routés."""
    count = 0
    entries = list(info.get("formats") or []) + list(info.get("requested_formats") or [])
    for f in entries:
        url = f.get("url") or ""
        if f.get("protocol") not in ("https", "http") or not is_googlevideo(url):
            continue
        fid = str(f.get("format_id") or count)
        renew = (lambda fid=fid: renew_url(fid)) if renew_url else None
        f["url"] = proxy.add("%s/%s" % (prefix, fid),
                             Target(url, f.get("http_headers"), f.get("cookies"), renew=renew,
                                    available_at=f.get("available_at")))
        count += 1
    if count and is_googlevideo(info.get("url")):
        info.pop("url", None)
    return count


def renewer(ytdlp, cfg, url):
    """Fonction qui renouvelle l'URL d'un format expiré (403 en amont) par un nouveau
    `yt-dlp -J`, en gardant le même format_id : renvoie (url, en-têtes, available_at)."""
    cache = {}

    def renew(fid):
        if not cache.get("info") or time.time() - cache.get("at", 0) > 60:
            cache["info"] = resolve(ytdlp, cfg, url)
            cache["at"] = time.time()
        for f in cache["info"].get("formats") or []:
            if str(f.get("format_id")) == fid and f.get("url"):
                return f["url"], f.get("http_headers") or {}, f.get("available_at")
        return None
    return renew


# ------------------------------------------------------------------ fusion
_SECTION_MARK = re.compile(r" \[\d\d-\d\d-\d\d - \d\d-\d\d-\d\d\](?=\.[^.]+$)")


def merged_name(first_part, suffix):
    """Nom du fichier fusionné : celui du premier passage, sans ses heures, suivi du
    mot « extraits » (traduit). Ne remplace jamais un fichier existant."""
    folder, base = os.path.split(first_part)
    stem, ext = os.path.splitext(_SECTION_MARK.sub("", base))
    candidate = os.path.join(folder, "%s [%s]%s" % (stem, suffix, ext))
    n = 2
    while os.path.exists(candidate):
        candidate = os.path.join(folder, "%s [%s %d]%s" % (stem, suffix, n, ext))
        n += 1
    return candidate


def concat(ffmpeg, parts, output, on_proc=None):
    """Assemble les passages bout à bout sans ré-encodage (ffmpeg concat)."""
    list_path = output + ".txt"
    with open(list_path, "w", encoding="utf-8") as f:
        for part in parts:
            f.write("file '%s'\n" % part.replace("'", "'\\''"))
    try:
        proc = subprocess.Popen(
            [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
             "-i", list_path, "-map", "0", "-c", "copy", output],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
            text=True, encoding="utf-8", errors="replace", creationflags=CREATE_NO_WINDOW,
            start_new_session=not IS_WINDOWS)
        if on_proc:
            on_proc(proc)
        out, _ = proc.communicate()
        return proc.returncode, (out or "").strip()
    finally:
        try:
            os.remove(list_path)
        except OSError:
            pass


# ------------------------------------------------------------------ dossiers temporaires
def make_work_dir(prefix):
    return tempfile.mkdtemp(prefix=prefix)


def remove_work_dir(path):
    if path and os.path.basename(path).startswith((CLIP_PREFIX, PREVIEW_PREFIX)):
        shutil.rmtree(path, ignore_errors=True)


def purge_stale_dirs(max_age=86400):
    """Supprime les dossiers temporaires laissés par un arrêt brutal (plus d'un jour)."""
    base = tempfile.gettempdir()
    try:
        names = os.listdir(base)
    except OSError:
        return
    now = time.time()
    for name in names:
        if name.startswith((CLIP_PREFIX, PREVIEW_PREFIX)):
            path = os.path.join(base, name)
            try:
                if now - os.path.getmtime(path) > max_age:
                    shutil.rmtree(path, ignore_errors=True)
            except OSError:
                pass
