"""Journal conservé sur le disque (lasso.log, à côté de settings.json) : il survit à la
fermeture de l'application et permet de comprendre une erreur après coup.

Deux fichiers au plus : passé MAX_BYTES, lasso.log devient lasso.log.1. Rien de secret n'y
est écrit, même avec --verbose : ni mot de passe, ni cookies, ni identifiants de proxy.
"""
import os
import re
import time

from .binaries import app_dir, format_command

MAX_BYTES = 2 * 1024 * 1024
MAX_LINE = 2000

# Options dont la valeur reste secrète : celles que yt-dlp masque dans son propre affichage
# (_hide_login_info), plus la double authentification et les en-têtes.
_SECRET_OPTS = {"-u", "--username", "-p", "--password", "--video-password", "--ap-username",
                "--ap-password", "-2", "--twofactor", "--client-certificate-password",
                "--add-header", "--add-headers"}
_SECRETS = (
    # En-têtes : « Cookie: ... », « Authorization: ... »
    (re.compile(r"(?i)\b((?:set-)?cookie|(?:proxy-)?authorization)\s*:.*"), r"\1: ***"),
    # Option -cookies de ffmpeg, un cookie par ligne : « nom=valeur; path=/; domain=.site; »
    (re.compile(r"(?i)[^\s;=\"']+=[^;]*;\s*path=[^;]*;\s*domain=[^;]*;?"), "***"),
    # Adresse de proxy : http://identifiant:mot-de-passe@hôte
    (re.compile(r"(?<=://)[^/\s@]+@"), "***@"),
)
# Progression : sans intérêt après coup, elle chasserait les erreurs du fichier.
_NOISE = re.compile(r"\[download\]\s+[\d.]+% of .* ETA |(?:frame|size)=.*time=.*speed=")


def clean(line):
    for pattern, mask in _SECRETS:
        line = pattern.sub(mask, line)
    return line


def command_line(cmd):
    """La commande d'une tâche, sans les valeurs des options secrètes."""
    shown, hide = [], False
    for arg in cmd:
        name = arg.split("=", 1)[0]
        if hide:
            arg = "***"
        elif "=" in arg and name in _SECRET_OPTS:
            arg = name + "=***"
        hide = not hide and name in _SECRET_OPTS and "=" not in arg
        shown.append(arg)
    return format_command(shown)


def write(lines):
    stamp = time.strftime("%Y-%m-%d %H:%M:%S ")
    text = "".join(stamp + clean(line)[:MAX_LINE] + "\n" for line in lines if not _NOISE.search(line))
    if not text:
        return
    path = os.path.join(app_dir(), "lasso.log")
    try:
        with open(path, "a", encoding="utf-8", errors="replace") as f:
            f.write(text)
        if os.path.getsize(path) > MAX_BYTES:
            os.replace(path, path + ".1")
    except OSError:
        pass  # dossier en lecture seule, fichier verrouillé : le journal reste facultatif
