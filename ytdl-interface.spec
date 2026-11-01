# -*- mode: python ; coding: utf-8 -*-
# Build : pyinstaller ytdl-interface.spec (à lancer sur la plateforme cible : Windows
# ou Linux, PyInstaller ne fait pas de compilation croisée).
# Produit un dossier portable (dist/YTDL-Interface/) contenant l'exécutable
# YTDL-Interface(.exe) : aucun installeur, settings.json et bin/ (yt-dlp, ffmpeg) sont
# créés à côté de l'exécutable, dans ce même dossier, au premier lancement. Le dossier
# est archivé tel quel pour la release (zip sous Windows, tar.gz sous Linux).
import sys

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

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='YTDL-Interface',
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
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='YTDL-Interface',
)
