"""Raccourcis vers Lasso : menu Démarrer (et donc recherche Windows) et Bureau sous
Windows, menu des applications et Bureau sous Linux.

L'application reste portable : seul un raccourci est créé hors de son dossier, dans les
dossiers de l'utilisateur (aucun droit administrateur). Proposé, jamais imposé : la page
le demande au premier lancement et les réglages permettent de l'ajouter ou de le retirer.
Seulement pour l'exécutable packagé : depuis les sources, il n'y a pas de Lasso.exe à viser.
"""
import ctypes
import os
import subprocess
import sys

from .binaries import CREATE_NO_WINDOW, IS_WINDOWS, resource_path

KINDS = ("menu", "desktop")
NAME = "Lasso"


def supported():
    return getattr(sys, "frozen", False) and (IS_WINDOWS or sys.platform.startswith("linux"))


def _exe():
    return os.path.abspath(sys.executable)


# ------------------------------------------------------------------ Windows
def _win_folder(csidl):
    buf = ctypes.create_unicode_buffer(260)
    if ctypes.windll.shell32.SHGetFolderPathW(None, csidl, None, 0, buf) != 0:
        raise OSError("dossier système introuvable (CSIDL %#x)" % csidl)
    return buf.value


def _win_path(kind):
    # CSIDL_PROGRAMS : menu Démarrer de l'utilisateur, que la recherche Windows indexe ;
    # CSIDL_DESKTOPDIRECTORY : son Bureau, même redirigé vers OneDrive.
    return os.path.join(_win_folder(0x0002 if kind == "menu" else 0x0010), NAME + ".lnk")


def _powershell(script, env):
    """Les raccourcis .lnk passent par l'objet COM WScript.Shell ; les chemins vont par
    variables d'environnement, pour n'avoir aucun échappement à faire."""
    res = subprocess.run(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
        env=dict(os.environ, **env), capture_output=True, text=True, timeout=30,
        encoding="utf-8", errors="replace", creationflags=CREATE_NO_WINDOW)
    if res.returncode != 0:
        raise OSError((res.stderr or res.stdout or "PowerShell %d" % res.returncode).strip()[-300:])
    return res.stdout.strip()


def _win_create(path):
    exe = _exe()
    _powershell(
        "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:LASSO_LNK);"
        "$s.TargetPath = $env:LASSO_EXE; $s.WorkingDirectory = $env:LASSO_DIR;"
        "$s.IconLocation = $env:LASSO_EXE + ',0'; $s.Description = 'Lasso Video Downloader'; $s.Save()",
        {"LASSO_LNK": path, "LASSO_EXE": exe, "LASSO_DIR": os.path.dirname(exe)})


def _win_target(path):
    return _powershell("(New-Object -ComObject WScript.Shell).CreateShortcut($env:LASSO_LNK).TargetPath",
                       {"LASSO_LNK": path})


# ------------------------------------------------------------------ Linux
def _linux_path(kind):
    if kind == "menu":
        base = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
        return os.path.join(base, "applications", "lasso.desktop")
    desktop = ""
    try:
        desktop = subprocess.run(["xdg-user-dir", "DESKTOP"], capture_output=True, text=True,
                                 timeout=5).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        pass
    if not desktop or desktop == os.path.expanduser("~"):
        desktop = os.path.expanduser("~/Desktop")
    return os.path.join(desktop, "lasso.desktop")


def _linux_create(path, kind):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("[Desktop Entry]\n"
                "Type=Application\n"
                "Name=Lasso\n"
                "GenericName=Video Downloader\n"
                "Comment=Download and clip videos (yt-dlp)\n"
                'Exec="%s"\n'
                "Icon=%s\n"
                "Terminal=false\n"
                "Categories=AudioVideo;Video;Network;\n" % (_exe(), resource_path("assets", "icon.png")))
    os.chmod(path, 0o755)
    if kind == "desktop":
        # GNOME n'ouvre un lanceur posé sur le Bureau que s'il est marqué de confiance.
        try:
            subprocess.run(["gio", "set", path, "metadata::trusted", "true"], capture_output=True, timeout=5)
        except (OSError, subprocess.SubprocessError):
            pass


def _linux_target(path):
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith("Exec="):
                return line[5:].strip().strip('"')
    return ""


# ------------------------------------------------------------------ commun
def _path(kind):
    return _win_path(kind) if IS_WINDOWS else _linux_path(kind)


def status():
    """Quels raccourcis existent ; « os » choisit les libellés de la page."""
    out = {"supported": supported(), "os": "windows" if IS_WINDOWS else "linux"}
    for kind in KINDS:
        try:
            out[kind] = out["supported"] and os.path.exists(_path(kind))
        except OSError:
            out[kind] = False
    return out


def set_shortcut(kind, on):
    """Crée (ou recrée, vers ce Lasso-ci) ou retire un raccourci ; renvoie le nouvel état."""
    if kind not in KINDS or not supported():
        raise ValueError(kind)
    path = _path(kind)
    if on:
        if IS_WINDOWS:
            _win_create(path)
        else:
            _linux_create(path, kind)
    elif os.path.exists(path):
        os.remove(path)
    return status()


def repair():
    """Dossier de Lasso déplacé : ses raccourcis visent un exécutable qui n'existe plus.
    On les fait pointer vers celui-ci. Un raccourci vers une autre copie de Lasso, encore
    présente, n'est pas touché."""
    if not supported():
        return
    exe = _exe()
    for kind in KINDS:
        try:
            path = _path(kind)
            if not os.path.exists(path):
                continue
            target = _win_target(path) if IS_WINDOWS else _linux_target(path)
            if target and os.path.normcase(target) != os.path.normcase(exe) and not os.path.exists(target):
                set_shortcut(kind, True)
        except (OSError, ValueError, subprocess.SubprocessError):
            pass
