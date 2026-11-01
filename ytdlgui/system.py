"""Intégration au système : thème clair/sombre, barre de titre, presse-papiers, notifications."""
import ctypes
import os
import shutil
import subprocess

IS_WINDOWS = os.name == "nt"

# Couleurs de la barre de titre Windows, identiques au fond de fenêtre (--bg dans
# web/app.css) : la barre se fond dans l'interface au lieu de rester grise/blanche.
TITLEBAR = {
    "dark": dict(caption="#0b0b1a", text="#f8f7ff", border="#26263e"),
    "light": dict(caption="#efecfb", text="#111126", border="#d9d4f0"),
}


def system_prefers_dark():
    if IS_WINDOWS:
        try:
            import winreg
            key = r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key) as k:
                value, _ = winreg.QueryValueEx(k, "AppsUseLightTheme")
            return value == 0
        except Exception:
            return False
    return _linux_prefers_dark()


def _linux_prefers_dark():
    """Préférence sombre du bureau Linux : réglage GNOME (repris par la plupart des
    bureaux GTK, et par KDE via sa synchronisation GTK), puis nom du thème GTK."""
    for gkey in ("color-scheme", "gtk-theme"):
        try:
            out = subprocess.run(
                ["gsettings", "get", "org.gnome.desktop.interface", gkey],
                capture_output=True, text=True, timeout=3).stdout
        except Exception:
            return False
        if "dark" in out.lower():
            return True
    return False


def resolve_theme(mode):
    if mode in ("light", "dark"):
        return mode
    return "dark" if system_prefers_dark() else "light"


# ------------------------------------------------------------------ fenêtre (Windows)
def find_main_hwnd():
    """Handle de la fenêtre principale du process (fenêtre visible de premier niveau).

    Passe par EnumWindows plutôt que par l'objet WinForms de pywebview : lire
    Form.Handle hors du thread de l'interface lève une exception de thread croisé.
    """
    if not IS_WINDOWS:
        return None
    try:
        from ctypes import wintypes
        user32 = ctypes.windll.user32
        pid = os.getpid()
        found = []

        @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        def callback(hwnd, _lparam):
            owner = wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(owner))
            if owner.value == pid and user32.IsWindowVisible(hwnd) and not user32.GetWindow(hwnd, 4):  # GW_OWNER
                found.append(hwnd)
                return False
            return True

        user32.EnumWindows(callback, 0)
        return found[0] if found else None
    except Exception:
        return None


def _colorref(hex_color):
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
    return r | (g << 8) | (b << 16)


def style_titlebar(hwnd, theme_name):
    """Barre de titre sombre (Windows 10 1809+) et, sous Windows 11, couleurs de la
    légende et de la bordure assorties au fond de l'interface. Sans effet ailleurs."""
    if not IS_WINDOWS or not hwnd:
        return
    dark = theme_name == "dark"
    try:
        dwm = ctypes.windll.dwmapi

        def set_attr(attr, value):
            v = ctypes.c_int(value)
            return dwm.DwmSetWindowAttribute(hwnd, attr, ctypes.byref(v), ctypes.sizeof(v))

        for attr in (20, 19):  # DWMWA_USE_IMMERSIVE_DARK_MODE selon la version
            if set_attr(attr, 1 if dark else 0) == 0:
                break
        colors = TITLEBAR["dark" if dark else "light"]
        set_attr(35, _colorref(colors["caption"]))   # DWMWA_CAPTION_COLOR (Windows 11)
        set_attr(36, _colorref(colors["text"]))      # DWMWA_TEXT_COLOR
        set_attr(34, _colorref(colors["border"]))    # DWMWA_BORDER_COLOR
    except Exception:
        pass


def notify_done(hwnd, had_errors):
    """Petit signal (son + clignotement de la barre des tâches) quand une file se termine
    naturellement, utile si la fenêtre tourne en arrière-plan pendant une longue playlist.
    Le clignotement n'a lieu que si la fenêtre n'a pas déjà le focus."""
    if not IS_WINDOWS:
        return
    try:
        import winsound
        winsound.MessageBeep(winsound.MB_ICONHAND if had_errors else winsound.MB_ICONASTERISK)
    except Exception:
        pass
    if not hwnd:
        return
    try:
        from ctypes import wintypes

        class FLASHWINFO(ctypes.Structure):
            _fields_ = [
                ("cbSize", wintypes.UINT),
                ("hwnd", wintypes.HWND),
                ("dwFlags", wintypes.DWORD),
                ("uCount", wintypes.UINT),
                ("dwTimeout", wintypes.DWORD),
            ]

        if ctypes.windll.user32.GetForegroundWindow() == hwnd:
            return
        FLASHW_ALL = 0x00000003
        FLASHW_TIMERNOFG = 0x0000000C
        info = FLASHWINFO(ctypes.sizeof(FLASHWINFO), hwnd, FLASHW_ALL | FLASHW_TIMERNOFG, 5, 0)
        ctypes.windll.user32.FlashWindowEx(ctypes.byref(info))
    except Exception:
        pass


def screen_bounds():
    """Rectangle (x, y, largeur, hauteur) de l'ensemble des écrans, ou None si inconnu."""
    if not IS_WINDOWS:
        return None
    try:
        gsm = ctypes.windll.user32.GetSystemMetrics
        return gsm(76), gsm(77), gsm(78), gsm(79)   # SM_X/YVIRTUALSCREEN, SM_CX/CYVIRTUALSCREEN
    except Exception:
        return None


# ------------------------------------------------------------------ presse-papiers
# Lu et écrit côté Python : dans WebView2, navigator.clipboard.readText() déclenche
# une demande d'autorisation, peu adaptée à une application de bureau.
_CF_UNICODETEXT = 13
_GMEM_MOVEABLE = 0x0002


def _win_clipboard_api():
    from ctypes import wintypes
    user32, kernel32 = ctypes.windll.user32, ctypes.windll.kernel32
    user32.OpenClipboard.argtypes = [wintypes.HWND]
    user32.GetClipboardData.restype = wintypes.HANDLE
    user32.SetClipboardData.argtypes = [wintypes.UINT, wintypes.HANDLE]
    user32.SetClipboardData.restype = wintypes.HANDLE
    kernel32.GlobalLock.argtypes = [wintypes.HGLOBAL]
    kernel32.GlobalLock.restype = ctypes.c_void_p
    kernel32.GlobalUnlock.argtypes = [wintypes.HGLOBAL]
    kernel32.GlobalAlloc.argtypes = [wintypes.UINT, ctypes.c_size_t]
    kernel32.GlobalAlloc.restype = wintypes.HGLOBAL
    return user32, kernel32


def _open_clipboard(user32):
    import time
    for _ in range(10):   # une autre application peut le tenir ouvert un court instant
        if user32.OpenClipboard(None):
            return True
        time.sleep(0.02)
    return False


def clipboard_get():
    if IS_WINDOWS:
        try:
            user32, kernel32 = _win_clipboard_api()
            if not _open_clipboard(user32):
                return ""
            try:
                handle = user32.GetClipboardData(_CF_UNICODETEXT)
                if not handle:
                    return ""
                ptr = kernel32.GlobalLock(handle)
                try:
                    return ctypes.wstring_at(ptr) if ptr else ""
                finally:
                    kernel32.GlobalUnlock(handle)
            finally:
                user32.CloseClipboard()
        except Exception:
            return ""
    for cmd in (["wl-paste", "--no-newline"], ["xclip", "-o", "-selection", "clipboard"],
                ["xsel", "--clipboard", "--output"]):
        if shutil.which(cmd[0]):
            try:
                return subprocess.run(cmd, capture_output=True, text=True, timeout=3).stdout
            except Exception:
                continue
    return ""


def clipboard_set(text):
    text = text or ""
    if IS_WINDOWS:
        try:
            user32, kernel32 = _win_clipboard_api()
            data = text.encode("utf-16-le") + b"\0\0"
            handle = kernel32.GlobalAlloc(_GMEM_MOVEABLE, len(data))
            ptr = kernel32.GlobalLock(handle)
            ctypes.memmove(ptr, data, len(data))
            kernel32.GlobalUnlock(handle)
            if not _open_clipboard(user32):
                return False
            try:
                user32.EmptyClipboard()
                return bool(user32.SetClipboardData(_CF_UNICODETEXT, handle))
            finally:
                user32.CloseClipboard()
        except Exception:
            return False
    for cmd in (["wl-copy"], ["xclip", "-selection", "clipboard"], ["xsel", "--clipboard", "--input"]):
        if shutil.which(cmd[0]):
            try:
                subprocess.run(cmd, input=text, text=True, timeout=3)
                return True
            except Exception:
                continue
    return False
