# -*- mode: python ; coding: utf-8 -*-
# Build : pyinstaller lasso.spec (à lancer sur la plateforme cible : Windows
# ou Linux, PyInstaller ne fait pas de compilation croisée).
# Produit un dossier portable (dist/Lasso/) contenant l'exécutable
# Lasso(.exe) : aucun installeur, settings.json et bin/ (yt-dlp, ffmpeg) sont
# créés à côté de l'exécutable, dans ce même dossier, au premier lancement. Le dossier
# est archivé tel quel pour la release (zip sous Windows, tar.gz sous Linux).
import os
import re
import sys

# Numéro de version : celui de ytdlgui/__init__.py (la CI l'y écrit avant de compiler).
with open(os.path.join('ytdlgui', '__init__.py'), encoding='utf-8') as _f:
    VERSION = re.search(r'__version__ = "([^"]+)"', _f.read()).group(1)

# ytdlgui.i18n charge ytdlgui.locales.<code> via importlib.import_module() avec un nom
# construit dynamiquement : l'analyse statique de PyInstaller ne le détecte pas, d'où
# la liste explicite ci-dessous (sinon l'exe démarre mais affiche les clés de traduction
# brutes au lieu du texte, faute de pouvoir importer les modules de langue).
LOCALE_MODULES = ['ytdlgui.locales.' + code for code in
                   ('fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'ru')]

# L'interface (pywebview) : sa propre collecte (scripts JS, DLL WebView2 sous Windows,
# backend Qt ou GTK sous Linux) est assurée par les hooks de pyinstaller-hooks-contrib.
# Tkinter ne sert plus qu'aux messages d'erreur sous Linux (main.pyw) : inutile de
# l'embarquer sous Windows, où ils passent par MessageBoxW.
EXCLUDES = ['tkinter', '_tkinter'] if sys.platform == 'win32' else []

a = Analysis(
    ['main.pyw'],
    pathex=[],
    binaries=[],
    datas=[
        ('assets', 'assets'),             # icônes, lues via ytdlgui.binaries.resource_path()
        ('ytdlgui/web', 'ytdlgui/web'),   # page de l'interface (HTML, CSS, JS, polices)
    ],
    hiddenimports=LOCALE_MODULES,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=EXCLUDES,
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)


def version_info():
    """Nom et version inscrits dans Lasso.exe (propriétés du fichier sous Windows) :
    les mêmes à chaque compilation d'une version donnée."""
    from PyInstaller.utils.win32.versioninfo import (
        FixedFileInfo, StringFileInfo, StringStruct, StringTable, VarFileInfo, VarStruct, VSVersionInfo)
    nums = tuple(int(n) for n in VERSION.split('.')) + (0,)
    strings = [
        StringStruct('CompanyName', 'Gautier Mekhelian'),
        StringStruct('FileDescription', 'Lasso Video Downloader'),
        StringStruct('FileVersion', VERSION),
        StringStruct('InternalName', 'Lasso'),
        StringStruct('LegalCopyright', 'Copyright (c) 2026 Gautier Mekhelian. MIT License.'),
        StringStruct('OriginalFilename', 'Lasso.exe'),
        StringStruct('ProductName', 'Lasso'),
        StringStruct('ProductVersion', VERSION),
    ]
    return VSVersionInfo(
        ffi=FixedFileInfo(filevers=nums, prodvers=nums, mask=0x3f, flags=0x0, OS=0x40004,
                          fileType=0x1, subtype=0x0, date=(0, 0)),
        kids=[StringFileInfo([StringTable('040904B0', strings)]),
              VarFileInfo([VarStruct('Translation', [0x0409, 1200])])])


exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Lasso',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    # Icône de l'exécutable : Windows uniquement (PyInstaller l'ignore sous Linux, où
    # l'icône de fenêtre est passée à pywebview depuis assets/icon.png, cf. ytdlgui/app.py).
    icon='assets/icon.ico' if sys.platform == 'win32' else None,
    version=version_info() if sys.platform == 'win32' else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='Lasso',
)

# Zip téléchargé avec un navigateur : Windows marque les fichiers extraits comme venus
# d'Internet, et .NET refuse alors de charger Python.Runtime.dll (l'interface ne démarre
# pas). Ce fichier, lu par .NET au démarrage de Lasso.exe, l'autorise à charger ses
# propres DLL malgré la marque, sans la retirer.
if sys.platform == 'win32':
    with open(os.path.join(DISTPATH, 'Lasso', 'Lasso.exe.config'), 'w', encoding='utf-8') as _f:
        _f.write('<?xml version="1.0" encoding="utf-8"?>\n'
                 '<configuration>\n'
                 '  <runtime>\n'
                 '    <loadFromRemoteSources enabled="true"/>\n'
                 '  </runtime>\n'
                 '</configuration>\n')
