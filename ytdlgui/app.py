"""Fenêtre principale de YTDL Interface (interface graphique pour yt-dlp).

L'interface est une page web (ytdlgui/web/) affichée dans une fenêtre native par
pywebview (WebView2 sous Windows, WebKitGTK ou Qt WebEngine sous Linux). Toute la
logique reste ici et dans les autres modules Python : la page appelle les méthodes
publiques de Api via window.pywebview.api et interroge poll() pour suivre la file.
"""
import collections
import json as jsonmod
import os
import queue
import re
import subprocess
import threading
import time
import webbrowser

import webview

from . import __version__
from . import clips
from . import command as cmdmod
from . import engine as eng
from . import i18n
from . import preview
from . import system
from . import updater
from .binaries import (
    CREATE_NO_WINDOW, app_dir, download_deno, download_ffmpeg, download_ytdlp, find_deno,
    find_ffmpeg, find_ytdlp, format_command, get_version, open_folder, resource_path,
)
from .streamproxy import StreamProxy
from .config import load_settings, save_settings
from .i18n import T

PRESET_KEYS = ["preset.best", "preset.1080", "preset.720", "preset.mp3", "preset.m4a"]
PRESETS = {
    "preset.best": dict(
        mode="video", max_res="best", container="auto", vcodec="auto", recode=False,
        custom_format=""),
    "preset.1080": dict(
        mode="video", max_res="1080", container="mp4", vcodec="auto",
        recode=False, custom_format=""),
    "preset.720": dict(
        mode="video", max_res="720", container="mp4", vcodec="auto",
        recode=False, custom_format=""),
    "preset.mp3": dict(
        mode="audio", audio_format="mp3", audio_quality="320K",
        embed_thumbnail=True, embed_metadata=True, custom_format=""),
    "preset.m4a": dict(
        mode="audio", audio_format="m4a", audio_quality="best",
        embed_thumbnail=True, embed_metadata=True, custom_format=""),
}

THEME_CODES = ["auto", "light", "dark"]
AUDIO_FORMATS = ("mp3", "m4a", "opus", "flac", "wav")
SUB_FORMATS = ("srt", "vtt", "ass", "lrc")
BROWSERS = ("firefox", "chrome", "edge", "brave", "opera", "vivaldi", "chromium")

UPDATE_INTERVAL = 20 * 3600   # vérification automatique : au plus une fois par jour
DEFAULT_SIZE = (1100, 780)
MIN_SIZE = (900, 640)
LOG_KEEP = 5000


def default_settings(base_dir):
    """Valeurs par défaut. Les listes à libellé traduit (meilleure qualité, sans
    conversion...) sont stockées sous une valeur technique stable ("best", "original",
    "no", "") : l'interface les affiche dans la langue courante."""
    return {
        "ui_lang": "auto",
        "ui_theme": "auto",
        # Téléchargement
        "dest_dir": os.path.join(os.path.expanduser("~"), "Downloads"),
        "preset": "preset.1080",
        # Format
        "mode": "video",
        "max_res": "1080",
        "container": "mp4",
        "vcodec": "auto",
        "recode": False,
        "audio_format": "mp3",
        "audio_quality": "best",
        "custom_format": "",
        # Sous-titres
        "write_subs": False,
        "auto_subs": False,
        "all_subs": False,
        "sub_langs": "fr,en",
        "convert_subs": "srt",
        "embed_subs": False,
        # Playlist
        "playlist_mode": "single",
        "playlist_items": "",
        "date_after": "",
        "date_before": "",
        "max_downloads": "",
        "use_archive": False,
        "archive_path": os.path.join(base_dir, "archive.txt"),
        "ignore_errors": True,
        "max_filesize": "",
        # Fichiers et métadonnées
        "output_template": "%(title)s.%(ext)s",
        "restrict_filenames": False,
        "no_mtime": True,
        "embed_thumbnail": False,
        "write_thumbnail": False,
        "embed_metadata": True,
        "embed_chapters": True,
        "write_description": False,
        "write_infojson": False,
        "split_chapters": False,
        "sb_mode": "non",
        "sb_cats": "sponsor",
        # Réseau
        "limit_rate": "",
        "retries": "10",
        "concurrent_fragments": "1",
        "sleep_interval": "",
        "proxy": "",
        "cookies_browser": "",
        "cookies_file": "",
        "username": "",
        "password": "",
        "force_ipv4": False,
        "geo_bypass": False,
        # Avancé
        "sections": "",
        "force_keyframes": True,
        "custom_args": "",
        "simulate": False,
        "verbose": False,
        "max_concurrent": "1",
        "ytdlp_path": "",
        "ffmpeg_path": "",
        "autoscroll_log": True,
        # Application
        "update_check": True,     # vérifier les mises à jour au démarrage
        "update_skip": "",        # version que l'utilisateur a choisi d'ignorer
        "deno_prompt": True,      # proposer Deno au démarrage s'il manque
    }


def normalize_settings(values):
    """Ramène les anciennes valeurs (libellés traduits enregistrés par la version
    Tkinter : "Meilleure", "(aucun)", "non"...) vers les valeurs techniques."""
    v = values
    if not any(c.isdigit() for c in v["max_res"]):
        v["max_res"] = "best"
    if not any(c.isdigit() for c in v["audio_quality"]):
        v["audio_quality"] = "best"
    if v["audio_format"].strip().lower() not in AUDIO_FORMATS:
        v["audio_format"] = "original"
    else:
        v["audio_format"] = v["audio_format"].strip().lower()
    if v["convert_subs"].strip().lower() not in SUB_FORMATS:
        v["convert_subs"] = "no"
    if v["cookies_browser"].strip().lower() not in BROWSERS:
        v["cookies_browser"] = ""
    if v["preset"] not in PRESET_KEYS:
        v["preset"] = "preset.1080"
    if v["ui_theme"] not in THEME_CODES:
        v["ui_theme"] = "auto"
    if v["max_concurrent"] not in ("1", "2", "3", "4"):
        v["max_concurrent"] = "1"
    if v["mode"] not in ("video", "audio", "video_only"):
        v["mode"] = "video"
    if v["playlist_mode"] not in ("single", "full"):
        v["playlist_mode"] = "single"
    if v["sb_mode"] not in ("non", "mark", "remove"):
        v["sb_mode"] = "non"
    return v


def _coerce(default, value):
    if isinstance(default, bool):
        return bool(value)
    return "" if value is None else str(value)


class Api:
    """Méthodes appelées par la page (window.pywebview.api.<nom>).

    pywebview expose aussi les attributs publics : tout l'état interne est donc préfixé
    par "_". Chaque appel arrive sur son propre thread, d'où le verrou sur les réglages.
    """

    def __init__(self):
        self._dir = app_dir()
        self._lock = threading.RLock()
        self._defaults = default_settings(self._dir)
        stored = load_settings(self._dir)
        values = dict(self._defaults)
        for name, value in stored.items():
            if name in values and name != "password":
                values[name] = _coerce(self._defaults[name], value)
        self._settings = normalize_settings(values)
        self._geometry = stored.get("_geometry", "")
        self._maximized = bool(stored.get("_maximized", False))
        self._update_checked = float(stored.get("_update_checked") or 0)
        self._updated_to = str(stored.get("_updated_to") or "")
        i18n.set_lang(self._settings["ui_lang"])

        self._q = queue.Queue()
        self._engine = eng.Engine(self._q)
        self._events = []
        self._log = collections.deque(maxlen=LOG_KEEP)
        self._busy_binary = False
        self._force_close = False
        self._window = None
        self._hwnd = None
        # Proxy local (aperçu et passages YouTube) et sessions d'aperçu de l'éditeur
        self._proxy = StreamProxy(network=self._network)
        self._previews = preview.Previews(self._proxy, self._push, self._paths, self._cfg)
        threading.Thread(target=clips.purge_stale_dirs, daemon=True).start()
        self._update = None          # release proposée (dict de updater.latest_release)
        self._update_root = None     # nouvelle version extraite, prête à remplacer l'app
        self._update_busy = False
        if updater.frozen():
            # Reste d'une mise à jour téléchargée mais jamais appliquée (ou échouée)
            threading.Thread(target=updater.clean_staging, daemon=True).start()

    # ---------------------------------------------------------- fenêtre
    def _attach(self, window):
        self._window = window
        window.events.shown += self._on_shown
        window.events.closing += self._on_closing
        window.events.maximized += lambda *_: setattr(self, "_maximized", True)
        window.events.restored += lambda *_: setattr(self, "_maximized", False)

    def _on_shown(self, *_args):
        self._hwnd = system.find_main_hwnd()
        system.style_titlebar(self._hwnd, system.resolve_theme(self._settings["ui_theme"]))

    def _on_closing(self, *_args):
        if not self._force_close and any(
                j.status == eng.ST_RUNNING for j in self._engine.jobs.values()):
            # Confirmation dans la page : la boucle poll() la récupère et affiche la
            # question ; "Oui" rappelle quit(). Fermeture annulée en attendant.
            self._push({"type": "confirm_quit"})
            return False
        self._shutdown()
        self._save(with_geometry=True)
        return True

    def _shutdown(self):
        self._engine.cancel_all()
        self._previews.close_all()
        self._proxy.stop()

    def quit(self):
        self._force_close = True
        self._shutdown()
        if self._window is not None:
            self._window.destroy()

    def _save(self, with_geometry=False):
        with self._lock:
            data = {k: v for k, v in self._settings.items() if k != "password"}
        if with_geometry and self._window is not None:
            try:
                w = self._window
                if not self._maximized and w.width and w.height:
                    self._geometry = "%dx%d+%d+%d" % (w.width, w.height, w.x, w.y)
            except Exception:
                pass
        if self._geometry:
            data["_geometry"] = self._geometry
        data["_maximized"] = self._maximized
        data["_update_checked"] = self._update_checked
        if self._updated_to:
            data["_updated_to"] = self._updated_to
        save_settings(self._dir, data)

    def _push(self, event):
        with self._lock:
            self._events.append(event)

    # ---------------------------------------------------------- état initial
    def init(self):
        ytdlp, ffmpeg = self._paths()
        with self._lock:
            settings = dict(self._settings)
        self._check_version(ytdlp)
        updated = ""
        if self._updated_to:
            # Premier lancement après une mise à jour : la page l'annonce une fois.
            updated = __version__ if self._updated_to == __version__ else ""
            self._updated_to = ""
            self._save()
        self._auto_update_check()
        return {
            "version": __version__,
            "updated": updated,
            "frozen": updater.frozen(),
            "settings": settings,
            "strings": i18n.strings(),
            "lang": i18n.get_lang(),
            "langs": i18n.LANGS,
            "presets": PRESETS,
            "preset_keys": PRESET_KEYS,
            "system_dark": system.system_prefers_dark(),
            "binaries": self._binaries(ytdlp, ffmpeg),
            "preview": self._preview(ytdlp, ffmpeg),
            "jobs": self._jobs(),
            "running": self._engine.running,
            "log": list(self._log),
        }

    # ---------------------------------------------------------- mise à jour de l'application
    def _auto_update_check(self):
        """Au démarrage de l'application packagée, au plus une fois par jour. Depuis les
        sources, la version du dépôt n'est pas celle des releases : vérification manuelle."""
        if not updater.frozen() or not self._settings["update_check"]:
            return
        if time.time() - self._update_checked < UPDATE_INTERVAL:
            return

        def worker():
            result = self._find_update()
            if result.get("version") and result["version"] != self._settings["update_skip"]:
                self._push(dict(result, type="update_available"))
        threading.Thread(target=worker, daemon=True).start()

    def _find_update(self):
        try:
            info = updater.latest_release()
        except Exception as exc:
            return {"error": str(exc)}
        self._update_checked = time.time()
        self._save()
        if not updater.is_newer(info["version"], __version__):
            return {"current": __version__}
        self._update = info
        return {"version": info["version"], "current": __version__, "notes": info["notes"],
                "url": info["url"], "size": info["size"],
                "can_install": updater.can_self_update() and bool(info["asset_url"])}

    def update_check(self):
        """Vérification manuelle (section Avancé)."""
        return self._find_update()

    def update_skip(self, version):
        self.set_setting("update_skip", str(version))

    def update_install(self):
        """Télécharge et prépare la nouvelle version, en arrière-plan ; la page suit avec
        les événements update_progress, puis update_ready ou update_failed."""
        if self._update is None or self._update_busy or not updater.can_self_update():
            return False
        self._update_busy = True

        def worker():
            try:
                self._update_root = updater.download(
                    self._update, lambda pct: self._push({"type": "update_progress", "pct": round(pct, 1)}))
                self._push({"type": "update_ready", "version": self._update["version"]})
            except Exception as exc:
                updater.clean_staging()
                self._push({"type": "update_failed", "error": str(exc)})
            finally:
                self._update_busy = False
        threading.Thread(target=worker, daemon=True).start()
        return True

    def update_restart(self):
        """Ferme l'application et laisse le script de mise à jour la remplacer et la relancer."""
        if not self._update_root:
            return False
        self._updated_to = self._update["version"]
        self._force_close = True
        self._shutdown()
        self._save(with_geometry=True)
        updater.launch_swap(self._update_root)
        if self._window is not None:
            self._window.destroy()
        return True

    def open_url(self, url):
        """Ouvre une page (release, documentation) dans le navigateur du système."""
        if str(url).startswith("https://"):
            webbrowser.open(url)

    def _paths(self):
        with self._lock:
            return find_ytdlp(self._settings["ytdlp_path"]), find_ffmpeg(self._settings["ffmpeg_path"])

    def _cfg(self):
        """Copie des réglages pour construire une commande, avec le chemin de Deno."""
        with self._lock:
            cfg = dict(self._settings)
        cfg["_deno"] = find_deno() or ""
        return cfg

    def _network(self):
        """(proxy HTTP(S) de l'utilisateur ou "", forcer l'IPv4) pour le proxy local."""
        with self._lock:
            proxy, ipv4 = self._settings["proxy"].strip(), self._settings["force_ipv4"]
        if not proxy.lower().startswith(("http://", "https://")):
            proxy = ""
        return proxy, ipv4

    @staticmethod
    def _binaries(ytdlp, ffmpeg):
        deno = find_deno()
        return {"ytdlp": bool(ytdlp), "ffmpeg": bool(ffmpeg), "deno": bool(deno),
                "ytdlp_path": ytdlp or "", "ffmpeg_path": ffmpeg or "", "deno_path": deno or ""}

    def _check_version(self, ytdlp):
        if ytdlp:
            threading.Thread(
                target=lambda: self._push({"type": "version", "version": get_version(ytdlp)}),
                daemon=True).start()

    def _refresh_binaries(self):
        ytdlp, ffmpeg = self._paths()
        event = {"type": "binaries", "preview": self._preview(ytdlp, ffmpeg)}
        event.update(self._binaries(ytdlp, ffmpeg))
        self._push(event)
        self._check_version(ytdlp)

    # ---------------------------------------------------------- réglages
    def set_setting(self, name, value):
        if name not in self._defaults or name in ("ui_lang",):
            return None
        with self._lock:
            self._settings[name] = _coerce(self._defaults[name], value)
        if name == "ui_theme":
            system.style_titlebar(self._hwnd, system.resolve_theme(self._settings["ui_theme"]))
        if name != "password":
            self._save()
        if name in ("ytdlp_path", "ffmpeg_path"):
            self._refresh_binaries()
        return {"preview": self.get_preview()}

    def apply_preset(self, key):
        preset = PRESETS.get(key)
        if preset is None:
            return None
        with self._lock:
            self._settings.update(preset)
            self._settings["preset"] = key
            settings = dict(self._settings)
        self._save()
        return {"settings": settings, "preview": self.get_preview()}

    def set_lang(self, code):
        with self._lock:
            self._settings["ui_lang"] = code
        i18n.set_lang(code)
        self._save()
        if self._window is not None:
            try:
                self._window.set_title(T("app.title"))
            except Exception:
                pass
        return {"strings": i18n.strings(), "lang": i18n.get_lang()}

    def _preview(self, ytdlp, ffmpeg):
        cfg = self._cfg()
        try:
            return format_command(cmdmod.build_command(cfg, "<URL>", ytdlp or "yt-dlp", ffmpeg))
        except Exception as exc:
            return "%s %s" % (T("msg.cmderror"), exc)

    def get_preview(self):
        return self._preview(*self._paths())

    def browse(self, name, kind):
        if self._window is None or name not in self._defaults:
            return None
        with self._lock:
            current = self._settings.get(name, "")
        start = current if kind == "dir" else os.path.dirname(current)
        try:
            result = self._window.create_file_dialog(
                webview.FileDialog.FOLDER if kind == "dir" else webview.FileDialog.OPEN,
                directory=start if start and os.path.isdir(start) else "")
        except Exception:
            return None
        if not result:
            return None
        path = result[0] if isinstance(result, (list, tuple)) else result
        self.set_setting(name, path)
        return path

    # ---------------------------------------------------------- file
    def _job_dict(self, job):
        return {"id": job.id, "url": job.url, "title": job.title, "status": job.status,
                "percent": job.percent, "speed": job.speed, "eta": job.eta,
                "item": job.item, "size": job.size, "clip": job.clip, "phase": job.phase}

    def _jobs(self):
        engine = self._engine
        with engine.lock:
            return [self._job_dict(engine.jobs[jid]) for jid in engine.order if jid in engine.jobs]

    def _queue_state(self, **extra):
        state = {"jobs": self._jobs(), "running": self._engine.running}
        state.update(extra)
        return state

    def add_urls(self, urls, start, force=False):
        ytdlp, ffmpeg = self._paths()
        if not ytdlp:
            return {"need": "ytdlp"}
        cfg = self._cfg()
        if not ffmpeg and not force and cmdmod.needs_ffmpeg(cfg):
            return {"need": "ffmpeg"}
        dest, error = self._dest(cfg)
        if error:
            return error
        pending = {j.url for j in self._engine.jobs.values()
                   if j.status not in eng.FINAL_STATES and not j.clip}
        added = skipped = 0
        for url in urls:
            url = str(url).strip()
            if not url:
                continue
            if url in pending:
                skipped += 1
                continue
            self._engine.add_job(url, cmdmod.build_command(cfg, url, ytdlp, ffmpeg), dest)
            pending.add(url)
            added += 1
        if start and added:
            self._start()
        return self._queue_state(added=added, skipped=skipped)

    def _dest(self, cfg):
        dest = cfg.get("dest_dir", "").strip()
        if dest:
            try:
                os.makedirs(dest, exist_ok=True)
            except OSError:
                return dest, {"error": "%s\n%s" % (T("msg.nodest"), dest)}
        return dest, None

    # ---------------------------------------------------------- passages
    @staticmethod
    def _clean_clip(clip):
        """Passages venus de la page, revalidés ici : liste de [début, fin] en secondes."""
        try:
            sections = cmdmod.normalize_sections(
                [float(a), float(b)] for a, b in (clip or {}).get("sections") or [])
        except (TypeError, ValueError):
            return None
        if not sections or sections[0][0] < 0:
            return None
        return {"sections": sections, "precise": bool(clip.get("precise")),
                "merge": bool(clip.get("merge")) and len(sections) > 1}

    def add_clip(self, url, clip, start):
        """Ajoute une tâche qui ne télécharge que les passages choisis dans l'éditeur."""
        clip = self._clean_clip(clip)
        if clip is None:
            return {"error": T("ed.order")}
        ytdlp, ffmpeg = self._paths()
        if not ytdlp:
            return {"need": "ytdlp"}
        if not ffmpeg:
            return {"need": "ffmpeg", "required": True}   # --download-sections passe par ffmpeg
        dest, error = self._dest(self._cfg())
        if error:
            return error
        for job in self._engine.jobs.values():
            if (job.status not in eng.FINAL_STATES and job.url == url and job.clip
                    and job.clip["sections"] == clip["sections"]):
                return self._queue_state(added=0, skipped=1)
        self._add_clip_job(url, clip, dest)
        if start:
            self._start()
        return self._queue_state(added=1, skipped=0)

    def set_job_clip(self, job_id, clip):
        """Change les passages d'une tâche pas encore lancée, finie ou en erreur."""
        clip = self._clean_clip(clip)
        job = self._engine.jobs.get(int(job_id))
        if clip is None or job is None or job.status == eng.ST_RUNNING:
            return self._queue_state()
        if job.status == eng.ST_PENDING:
            # Une tâche ordinaire en attente devient une tâche à passages : sa commande
            # sera construite à son lancement, par _prepare_clip.
            job.clip = clip
            job.part_total = len(clip["sections"])
            job.prepare = self._prepare_clip
            job.cleanup = self._cleanup_clip
            job.finish = self._finish_clip if clip["merge"] else None
        elif self._engine.remove(job.id):
            self._add_clip_job(job.url, clip, job.dest_dir)
        return self._queue_state()

    def _add_clip_job(self, url, clip, dest):
        return self._engine.add_job(
            url, None, dest, clip=clip, prepare=self._prepare_clip,
            finish=self._finish_clip if clip["merge"] else None, cleanup=self._cleanup_clip)

    def _prepare_clip(self, job):
        """Juste avant le lancement : résout la vidéo, fait passer les flux YouTube par le
        proxy local (cf. ytdlgui/clips.py) et construit la commande."""
        ytdlp, ffmpeg = self._paths()
        if not ytdlp:
            raise RuntimeError(T("msg.ytdlpnotfound"))
        cfg = self._cfg()
        job.work_dir = clips.make_work_dir(clips.CLIP_PREFIX)
        try:
            info = clips.resolve(ytdlp, cfg, job.url, on_proc=lambda p: setattr(job, "proc", p))
            clips.check_clippable(info)
        except clips.ClipError as exc:
            raise RuntimeError(T(exc.key) if exc.key else exc.detail)
        job.title = info.get("title") or job.url
        self._q.put(("title", job.id))
        info_json = None
        proxy, _ = self._network()
        socks = cfg.get("proxy", "").strip() and not proxy
        if not socks and clips.route_through_proxy(info, self._proxy, "c%d" % job.id,
                                                    clips.renewer(ytdlp, cfg, job.url)):
            info_json = os.path.join(job.work_dir, "info.json")
            with open(info_json, "w", encoding="utf-8") as f:
                jsonmod.dump(info, f)
        extra = []
        if job.finish is not None:
            job.parts_file = os.path.join(job.work_dir, "parts.txt")
            extra = ["--print-to-file", "after_move:filepath", job.parts_file]
        return cmdmod.build_command(cfg, job.url, ytdlp, ffmpeg, clip=job.clip,
                                    info_json=info_json, extra_args=extra)

    def _finish_clip(self, job):
        """Fusion des passages en un seul fichier (option de l'éditeur)."""
        try:
            with open(job.parts_file, encoding="utf-8") as f:
                parts = [line.strip() for line in f if line.strip() and os.path.isfile(line.strip())]
        except (OSError, AttributeError):
            return 0
        if len(parts) < 2:
            return 0
        _, ffmpeg = self._paths()
        output = clips.merged_name(parts[0], T("clip.merged"))
        rc, message = clips.concat(ffmpeg, parts, output, on_proc=lambda p: setattr(job, "proc", p))
        if rc == 0:
            for part in parts:
                try:
                    os.remove(part)
                except OSError:
                    pass
            job.title = os.path.basename(output)
            self._q.put(("title", job.id))
        elif message:
            self._q.put(("log", job.id, message))
        return rc

    def _cleanup_clip(self, job):
        self._proxy.remove_prefix("c%d/" % job.id)
        clips.remove_work_dir(job.work_dir)
        job.work_dir = None

    # ---------------------------------------------------------- aperçu (éditeur de passages)
    def preview_open(self, url, caps):
        return self._previews.open(str(url).strip(), caps or {})

    def preview_local(self, sid, caps):
        return self._previews.local(sid, caps or {})

    def preview_close(self, sid):
        self._previews.close(sid)

    def _start(self):
        with self._lock:
            try:
                n = int(self._settings["max_concurrent"])
            except ValueError:
                n = 1
        self._engine.start(n)

    def start_queue(self):
        self._start()
        return self._queue_state()

    def cancel(self, ids):
        for jid in ids:
            self._engine.cancel(int(jid))
        return self._queue_state()

    def cancel_all(self):
        self._engine.cancel_all()
        return self._queue_state()

    def remove(self, ids):
        for jid in ids:
            self._engine.remove(int(jid))
        return self._queue_state()

    def clear_finished(self):
        for job in list(self._engine.jobs.values()):
            if job.status in eng.FINAL_STATES:
                self._engine.remove(job.id)
        return self._queue_state()

    def move(self, job_id, offset):
        self._engine.move(int(job_id), int(offset))
        return self._queue_state()

    def retry(self, ids):
        ytdlp, ffmpeg = self._paths()
        if not ytdlp:
            return {"need": "ytdlp"}
        cfg = self._cfg()
        restart = False
        for jid in ids:
            job = self._engine.jobs.get(int(jid))
            if job is None or job.status not in eng.FINAL_STATES:
                continue
            if self._engine.remove(job.id):
                if job.clip:   # une relance garde les passages de la tâche
                    self._add_clip_job(job.url, job.clip, cfg.get("dest_dir", ""))
                else:
                    self._engine.add_job(job.url, cmdmod.build_command(cfg, job.url, ytdlp, ffmpeg),
                                         cfg.get("dest_dir", ""))
                restart = True
        if restart and not self._engine.running:
            self._start()
        return self._queue_state()

    def open_dest(self, job_id=None):
        dest = ""
        if job_id is not None:
            job = self._engine.jobs.get(int(job_id))
            if job is not None:
                dest = job.dest_dir
        if not dest or not os.path.isdir(dest):
            with self._lock:
                dest = self._settings["dest_dir"].strip()
        if dest and os.path.isdir(dest):
            open_folder(dest)
            return {}
        return {"error": "msg.nodestdir"}

    # ---------------------------------------------------------- suivi (appelé en boucle par la page)
    def poll(self):
        log, dirty, finished = [], False, False
        try:
            while len(log) < 2000:
                event = self._q.get_nowait()
                kind = event[0]
                if kind == "log":
                    log.append("[%s] %s" % (event[1], event[2]))
                elif kind in ("status", "progress", "title"):
                    dirty = True
                elif kind == "done":
                    dirty = finished = True
        except queue.Empty:
            pass
        if log:
            self._log.extend(log)
        if finished:
            self._check_queue_done()
        with self._lock:
            events, self._events = self._events, []
        result = {"log": log, "events": events, "running": self._engine.running}
        if dirty:
            result["jobs"] = self._jobs()
        return result

    def _check_queue_done(self):
        jobs = list(self._engine.jobs.values())
        if not jobs or not all(j.status in eng.FINAL_STATES for j in jobs):
            return
        errors = sum(1 for j in jobs if j.status == eng.ST_ERROR)
        cancelled = sum(1 for j in jobs if j.status == eng.ST_CANCELLED)
        if cancelled < len(jobs):
            self._push({"type": "queue_done", "errors": errors})
            system.notify_done(self._hwnd, errors > 0)

    def clear_log(self):
        self._log.clear()

    # ---------------------------------------------------------- presse-papiers
    def clipboard_get(self):
        return system.clipboard_get()

    def clipboard_set(self, text):
        return system.clipboard_set(text)

    # ---------------------------------------------------------- binaires
    def install(self, components):
        if self._busy_binary:
            return False
        self._busy_binary = True
        threading.Thread(target=self._install_worker, args=(list(components),), daemon=True).start()
        return True

    def _install_worker(self, components):
        results = {}
        for comp in components:
            def progress(pct, comp=comp):
                self._push({"type": "install_progress", "comp": comp, "pct": round(pct, 1)})
            try:
                if comp == "ytdlp":
                    download_ytdlp(progress)
                elif comp == "deno":
                    download_deno(
                        progress_cb=progress,
                        status_cb=lambda phase, comp=comp: self._push(
                            {"type": "install_status", "comp": comp, "phase": phase}))
                else:
                    download_ffmpeg(
                        progress_cb=progress,
                        status_cb=lambda phase, comp=comp: self._push(
                            {"type": "install_status", "comp": comp, "phase": phase}))
                results[comp] = None
            except Exception as exc:
                results[comp] = str(exc)
            self._push({"type": "install_step_done", "comp": comp, "error": results[comp]})
        self._busy_binary = False
        self._push({"type": "install_all_done", "results": results})
        self._refresh_binaries()

    def update_ytdlp(self):
        ytdlp, _ = self._paths()
        if not ytdlp:
            return {"need": "ytdlp"}
        if self._busy_binary:
            return {"busy": True}
        self._busy_binary = True
        try:
            out = subprocess.run(
                [ytdlp, "-U"], capture_output=True, text=True, timeout=300,
                encoding="utf-8", errors="replace", creationflags=CREATE_NO_WINDOW)
            msg = ((out.stdout or "") + (out.stderr or "")).strip()
        except Exception as exc:
            msg = str(exc)
        finally:
            self._busy_binary = False
        self._q.put(("log", "upd", msg))
        self._check_version(ytdlp)
        return {"output": msg}

    # ---------------------------------------------------------- analyse
    def analyze(self, url):
        ytdlp, _ = self._paths()
        if not ytdlp:
            return {"need": "ytdlp"}
        cfg = self._cfg()
        cmd = [ytdlp, "-J", "--no-warnings"]
        if cfg.get("playlist_mode") == "full":
            cmd += ["--yes-playlist", "--flat-playlist"]
        else:
            cmd += ["--no-playlist"]
        cmd += cmdmod.build_network_args(cfg)
        cmd.append(url)
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=180,
                                 encoding="utf-8", errors="replace", creationflags=CREATE_NO_WINDOW)
            if out.returncode == 0 and out.stdout.strip():
                return {"info": _trim_info(jsonmod.loads(out.stdout))}
            return {"error": (out.stderr or "").strip()[-800:] or T("an.nodata")}
        except Exception as exc:
            return {"error": str(exc)}


def _trim_info(info):
    """Ne garde que ce que la fenêtre d'analyse affiche (le JSON complet de yt-dlp
    peut peser plusieurs Mo)."""
    if info.get("_type") == "playlist":
        entries = [{"title": e.get("title"), "url": e.get("url"), "duration": e.get("duration")}
                   for e in (info.get("entries") or []) if e]
        return {"type": "playlist", "title": info.get("title"),
                "uploader": info.get("uploader") or info.get("channel"), "entries": entries}
    formats = []
    for f in reversed(info.get("formats") or []):
        vcodec, acodec = f.get("vcodec") or "", f.get("acodec") or ""
        audio_only = vcodec in ("", "none") and acodec not in ("", "none")
        formats.append({
            "id": f.get("format_id") or "", "ext": f.get("ext") or "",
            "res": f.get("resolution") or ("%sx%s" % (f.get("width"), f.get("height"))
                                           if f.get("width") else ""),
            "fps": f.get("fps") or "", "vcodec": vcodec, "acodec": acodec,
            "tbr": f.get("tbr"), "size": f.get("filesize") or f.get("filesize_approx"),
            "note": f.get("format_note") or "",
            "kind": "a" if audio_only else ("v" if acodec in ("", "none") else "av"),
        })
    return {"type": "video", "title": info.get("title"),
            "uploader": info.get("uploader") or info.get("channel"),
            "duration": info.get("duration"), "view_count": info.get("view_count"),
            "upload_date": info.get("upload_date"), "thumbnail": info.get("thumbnail"),
            "formats": formats}


def _initial_geometry(geo):
    """Taille et position sauvegardées, ignorées si la fenêtre retomberait hors écran
    (ex : second écran débranché depuis la dernière fermeture)."""
    m = re.match(r"(\d+)x(\d+)([+-]\d+)([+-]\d+)", geo or "")
    if not m:
        return DEFAULT_SIZE + (None, None)
    w, h, x, y = (int(g) for g in m.groups())
    w, h = max(w, MIN_SIZE[0]), max(h, MIN_SIZE[1])
    bounds = system.screen_bounds()
    if bounds:
        vx, vy, vw, vh = bounds
        margin = 60
        if x + w < vx + margin or x > vx + vw - margin or y + h < vy + margin or y > vy + vh - margin:
            return (w, h, None, None)
    return (w, h, x, y)


def run():
    api = Api()
    theme_name = system.resolve_theme(api._settings["ui_theme"])
    w, h, x, y = _initial_geometry(api._geometry)
    window = webview.create_window(
        T("app.title"), url=resource_path("ytdlgui", "web", "index.html"), js_api=api,
        width=w, height=h, x=x, y=y, min_size=MIN_SIZE, maximized=api._maximized,
        background_color=system.TITLEBAR[theme_name]["caption"], text_select=True,
    )
    api._attach(window)
    # Windows (WinForms) lit un .ico ; GTK et Qt, un .png
    icon = resource_path("assets", "icon.ico" if os.name == "nt" else "icon.png")
    webview.start(http_server=True, icon=icon if os.path.isfile(icon) else None)
