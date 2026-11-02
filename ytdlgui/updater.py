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

# Ancien nom du dépôt : MrGautier256/ytdl-interface (GitHub redirige vers le nouveau).
REPO = "MrGautier256/lasso-video-downloader"
# YTDL_UPDATE_URL remplace l'adresse de l'API (tests avec un faux serveur de releases).
API_URL = os.environ.get("YTDL_UPDATE_URL") or "https://api.github.com/repos/%s/releases/latest" % REPO
SUMS = "SHA256SUMS.txt"
# L'archive (<nom>-windows.zip, <nom>-linux.tar.gz), son dossier racine et l'exécutable
# portent le nom de l'application : "Lasso" à partir de la 1.7, "YTDL-Interface" avant.
# Les deux sont acceptés, le plus récent d'abord, pour franchir le changement de nom.
NAMES = ("Lasso", "YTDL-Interface")
ARCHIVE_SUFFIX = "-windows.zip" if IS_WINDOWS else "-linux.tar.gz"
EXE_SUFFIX = ".exe" if IS_WINDOWS else ""
STAGING = "_update"


def parse_version(text):
    m = re.match(r"v?(\d+)\.(\d+)\.(\d+)", str(text or "").strip())
    return tuple(int(g) for g in m.groups()) if m else None


def is_newer(latest, current):
    a, b = parse_version(latest), parse_version(current)
    return bool(a and b and a > b)


def _open(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": "Lasso",
                                               "Accept": "application/vnd.github+json"})
    return urllib.request.urlopen(req, timeout=timeout)


def latest_release():
    """Dernière release : version, notes, page web et archive de cette plateforme."""
    with _open(API_URL) as resp:
        data = json.load(resp)
    assets = {a.get("name"): a for a in data.get("assets") or []}
    name = next((n + ARCHIVE_SUFFIX for n in NAMES if n + ARCHIVE_SUFFIX in assets), None)
    asset = assets.get(name) or {}
    return {
        "version": (data.get("tag_name") or "").lstrip("v"),
        "notes": data.get("body") or "",
        "url": data.get("html_url") or "https://github.com/%s/releases/latest" % REPO,
        "asset": name,
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
    name = info.get("asset")
    if not name or not info.get("asset_url"):
        raise RuntimeError("Aucune archive %s dans la release." % ARCHIVE_SUFFIX)
    clean_staging()
    stage = staging_dir()
    os.makedirs(stage)
    archive = os.path.join(stage, name)
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
                         if line.split() and line.split()[-1].lstrip("*") == name), None)
        if expected != digest.hexdigest():
            raise RuntimeError("SHA-256 : l'archive téléchargée ne correspond pas à la release.")
    target = os.path.join(stage, "new")
    if name.endswith(".zip"):
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(target)
    else:
        with tarfile.open(archive, "r:*") as tf:
            tf.extractall(target, filter="data")
    os.remove(archive)
    root = next((os.path.join(target, n) for n in NAMES
                 if os.path.isfile(os.path.join(target, n, n + EXE_SUFFIX))
                 and os.path.isdir(os.path.join(target, n, "_internal"))), None)
    if root is None:
        raise RuntimeError("Archive inattendue : application introuvable.")
    if progress:
        progress(100.0)
    return root


def installed_exe(dst):
    """Nom de l'exécutable installé : celui qui tourne, sinon le premier trouvé dans dst."""
    if frozen():
        return os.path.basename(sys.executable)
    return next((n + EXE_SUFFIX for n in NAMES if os.path.isfile(os.path.join(dst, n + EXE_SUFFIX))),
                NAMES[0] + EXE_SUFFIX)


_WINDOWS_SCRIPT = r"""@echo off
setlocal
set "PID=%~1"
set "SRC=%~2"
set "DST=%~3"
set "STAGE=%~4"
set "NEWEXE=%~5"
set "OLDEXE=%~6"
rem Relancé à la fin : le nouvel exécutable si l'échange réussit, l'ancien sinon.
set "RUN=%OLDEXE%"
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
copy /y "%SRC%\%NEWEXE%" "%DST%\%NEWEXE%" >nul || (rmdir /s /q "%DST%\_internal" & ren "%DST%\_internal.old" "_internal" & goto done)
set "RUN=%NEWEXE%"
rem Changement de nom de l'application (YTDL-Interface -> Lasso) : l'ancien exécutable part.
if /i not "%OLDEXE%"=="%NEWEXE%" del /f /q "%DST%\%OLDEXE%" 2>nul
rmdir /s /q "%DST%\_internal.old"
rmdir /s /q "%STAGE%"
:done
start "" "%DST%\%RUN%"
(goto) 2>nul & del "%~f0"
"""

_LINUX_SCRIPT = """#!/bin/sh
PID="$1"; SRC="$2"; DST="$3"; STAGE="$4"; NEW="$5"; OLD="$6"
# Relancé à la fin : le nouvel exécutable si l'échange réussit, l'ancien sinon.
RUN="$OLD"
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
   && cp -f "$SRC/$NEW" "$DST/$NEW.new" && mv -f "$DST/$NEW.new" "$DST/$NEW"; then
  RUN="$NEW"
  # Changement de nom de l'application (YTDL-Interface -> Lasso) : l'ancien exécutable part.
  [ "$OLD" != "$NEW" ] && rm -f "$DST/$OLD"
  rm -rf "$DST/_internal.old" "$STAGE"
elif [ -d "$DST/_internal.old" ]; then
  # Échec en cours de route : on remet l'ancien _internal, que le nouveau soit déjà là ou non.
  rm -rf "$DST/_internal" "$DST/$NEW.new"
  mv "$DST/_internal.old" "$DST/_internal"
fi
nohup "$DST/$RUN" >/dev/null 2>&1 &
rm -f "$0"
"""


def launch_swap(new_root):
    """Lance le script de remplacement ; l'application doit se fermer juste après."""
    dst, stage, pid = app_dir(), staging_dir(), str(os.getpid())
    new_exe = os.path.basename(new_root) + EXE_SUFFIX
    # Le script vit hors de _update/, qu'il supprime une fois le remplacement fait.
    fd, script = tempfile.mkstemp(prefix="ytdl-update-", suffix=".cmd" if IS_WINDOWS else ".sh")
    with os.fdopen(fd, "w", encoding="utf-8", newline="\r\n" if IS_WINDOWS else "\n") as f:
        f.write(_WINDOWS_SCRIPT if IS_WINDOWS else _LINUX_SCRIPT)
    args = [script, pid, new_root, dst, stage, new_exe, installed_exe(dst)]
    if IS_WINDOWS:
        # Console cachée héritée par robocopy ; nouveau groupe : survit à la fermeture.
        subprocess.Popen(["cmd", "/c"] + args, creationflags=CREATE_NO_WINDOW | 0x00000200,
                         stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, close_fds=True)
    else:
        subprocess.Popen(["/bin/sh"] + args, start_new_session=True, stdin=subprocess.DEVNULL,
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, close_fds=True)
