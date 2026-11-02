"""Mise à jour de l'application portable depuis les releases GitHub.

1. latest_release() lit la dernière release publiée ;
2. download() télécharge l'archive de la plateforme, la vérifie (SHA256SUMS.txt publié
   par la CI) et l'extrait dans _update/, à côté de l'application ;
3. launch_swap() lance un petit script qui attend la fermeture de l'application,
   échange son dossier _internal (par renommage, avec retour arrière en cas d'échec) et
   son exécutable, puis la relance : sous Windows, un programme en cours d'exécution ne
   peut pas remplacer ses propres fichiers.

Seuls l'exécutable et _internal/ sont remplacés : settings.json, bin/, archive.txt et
tout fichier que l'utilisateur aurait rangé dans le dossier restent intacts.
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import zipfile

from .binaries import CREATE_NO_WINDOW, IS_WINDOWS, app_dir

REPO = "MrGautier256/ytdl-interface"
# YTDL_UPDATE_URL remplace l'adresse de l'API (tests avec un faux serveur de releases).
API_URL = os.environ.get("YTDL_UPDATE_URL") or "https://api.github.com/repos/%s/releases/latest" % REPO
ASSET = "YTDL-Interface-windows.zip" if IS_WINDOWS else "YTDL-Interface-linux.tar.gz"
SUMS = "SHA256SUMS.txt"
APP_FOLDER = "YTDL-Interface"           # dossier racine des archives de release
EXE = APP_FOLDER + (".exe" if IS_WINDOWS else "")
STAGING = "_update"


def parse_version(text):
    m = re.match(r"v?(\d+)\.(\d+)\.(\d+)", str(text or "").strip())
    return tuple(int(g) for g in m.groups()) if m else None


def is_newer(latest, current):
    a, b = parse_version(latest), parse_version(current)
    return bool(a and b and a > b)


def _open(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "YTDL-Interface",
                                               "Accept": "application/vnd.github+json"})
    return urllib.request.urlopen(req, timeout=timeout)


def latest_release():
    """Dernière release : version, notes, page web et archive de cette plateforme."""
    with _open(API_URL) as resp:
        data = json.load(resp)
    assets = {a.get("name"): a for a in data.get("assets") or []}
    asset = assets.get(ASSET) or {}
    return {
        "version": (data.get("tag_name") or "").lstrip("v"),
        "notes": data.get("body") or "",
        "url": data.get("html_url") or "https://github.com/%s/releases/latest" % REPO,
        "asset_url": asset.get("browser_download_url"),
        "size": asset.get("size"),
        "sums_url": (assets.get(SUMS) or {}).get("browser_download_url"),
    }


def frozen():
    return bool(getattr(sys, "frozen", False))


def can_self_update():
    """Mise à jour en place possible : application packagée, dans un dossier modifiable
    (pas dans Program Files par exemple). Sinon, l'application renvoie vers la page."""
    if not frozen():
        return False
    probe = os.path.join(app_dir(), ".update-write-test")
    try:
        with open(probe, "w"):
            pass
        os.remove(probe)
        return True
    except OSError:
        return False


def staging_dir():
    return os.path.join(app_dir(), STAGING)


def clean_staging():
    shutil.rmtree(staging_dir(), ignore_errors=True)


def download(info, progress=None):
    """Télécharge, vérifie et extrait la nouvelle version ; renvoie son dossier."""
    if not info.get("asset_url"):
        raise RuntimeError("%s absent de la release." % ASSET)
    clean_staging()
    stage = staging_dir()
    os.makedirs(stage)
    archive = os.path.join(stage, ASSET)
    digest = hashlib.sha256()
    with _open(info["asset_url"], timeout=60) as resp, open(archive, "wb") as out:
        total = int(resp.headers.get("Content-Length") or info.get("size") or 0)
        done = 0
        while True:
            buf = resp.read(1 << 16)
            if not buf:
                break
            out.write(buf)
            digest.update(buf)
            done += len(buf)
            if progress and total:
                progress(min(90.0, done * 90.0 / total))
    if info.get("sums_url"):
        with _open(info["sums_url"]) as resp:
            sums = resp.read().decode("utf-8", "replace")
        expected = next((line.split()[0].lower() for line in sums.splitlines()
                         if line.strip().endswith(ASSET)), None)
        if expected != digest.hexdigest():
            raise RuntimeError("SHA-256 : l'archive téléchargée ne correspond pas à la release.")
    target = os.path.join(stage, "new")
    if ASSET.endswith(".zip"):
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(target)
    else:
        with tarfile.open(archive, "r:*") as tf:
            tf.extractall(target, filter="data")
    os.remove(archive)
    root = os.path.join(target, APP_FOLDER)
    if not os.path.isfile(os.path.join(root, EXE)) or not os.path.isdir(os.path.join(root, "_internal")):
        raise RuntimeError("Archive inattendue : %s introuvable." % EXE)
    if progress:
        progress(100.0)
    return root


_WINDOWS_SCRIPT = r"""@echo off
setlocal
set "PID=%~1"
set "SRC=%~2"
set "DST=%~3"
set "STAGE=%~4"
rem Attend la fermeture de l'application (ping sert de pause : timeout exige une console).
rem Toujours là après 20 s : on la termine (réglages déjà enregistrés, téléchargements arrêtés).
set /a WAITED=0
:wait
tasklist /FI "PID eq %PID%" 2>nul | find "%PID%" >nul || goto closed
set /a WAITED+=1
if %WAITED% equ 20 taskkill /F /T /PID %PID% >nul 2>&1
ping -n 2 127.0.0.1 >nul
goto wait
:closed
rem Échange par renommage (même disque : instantané), avec retour arrière en cas d'échec.
rem Plusieurs essais : un antivirus peut verrouiller le dossier quelques instants.
rmdir /s /q "%DST%\_internal.old" 2>nul
set /a TRIES=0
:rename
ren "%DST%\_internal" "_internal.old" 2>nul && goto swap
set /a TRIES+=1
if %TRIES% geq 15 goto done
ping -n 2 127.0.0.1 >nul
goto rename
:swap
move "%SRC%\_internal" "%DST%\_internal" >nul || (ren "%DST%\_internal.old" "_internal" & goto done)
copy /y "%SRC%\YTDL-Interface.exe" "%DST%\YTDL-Interface.exe" >nul || (rmdir /s /q "%DST%\_internal" & ren "%DST%\_internal.old" "_internal" & goto done)
rmdir /s /q "%DST%\_internal.old"
rmdir /s /q "%STAGE%"
:done
start "" "%DST%\YTDL-Interface.exe"
(goto) 2>nul & del "%~f0"
"""

_LINUX_SCRIPT = """#!/bin/sh
PID="$1"; SRC="$2"; DST="$3"; STAGE="$4"
# Attend la fermeture de l'application. Toujours là après 20 s : on la termine
# (réglages déjà enregistrés, téléchargements arrêtés).
n=0
while kill -0 "$PID" 2>/dev/null; do
  n=$((n + 1)); [ "$n" -eq 40 ] && kill -9 "$PID" 2>/dev/null
  sleep 0.5
done
# Même disque : on déplace (rapide) ; l'ancien _internal n'est supprimé qu'après réussite.
rm -rf "$DST/_internal.old"
if mv "$DST/_internal" "$DST/_internal.old" && mv "$SRC/_internal" "$DST/_internal" \\
   && cp -f "$SRC/YTDL-Interface" "$DST/YTDL-Interface.new" && mv -f "$DST/YTDL-Interface.new" "$DST/YTDL-Interface"; then
  rm -rf "$DST/_internal.old" "$STAGE"
elif [ -d "$DST/_internal.old" ] && [ ! -d "$DST/_internal" ]; then
  mv "$DST/_internal.old" "$DST/_internal"
fi
nohup "$DST/YTDL-Interface" >/dev/null 2>&1 &
rm -f "$0"
"""


def launch_swap(new_root):
    """Lance le script de remplacement ; l'application doit se fermer juste après."""
    dst, stage, pid = app_dir(), staging_dir(), str(os.getpid())
    # Le script vit hors de _update/, qu'il supprime une fois le remplacement fait.
    fd, script = tempfile.mkstemp(prefix="ytdl-update-", suffix=".cmd" if IS_WINDOWS else ".sh")
    with os.fdopen(fd, "w", encoding="utf-8", newline="\r\n" if IS_WINDOWS else "\n") as f:
        f.write(_WINDOWS_SCRIPT if IS_WINDOWS else _LINUX_SCRIPT)
    args = [script, pid, new_root, dst, stage]
    if IS_WINDOWS:
        # Console cachée héritée par robocopy ; nouveau groupe : survit à la fermeture.
        subprocess.Popen(["cmd", "/c"] + args, creationflags=CREATE_NO_WINDOW | 0x00000200,
                         stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, close_fds=True)
    else:
        subprocess.Popen(["/bin/sh"] + args, start_new_session=True, stdin=subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, close_fds=True)
