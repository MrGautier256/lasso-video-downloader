"""File de téléchargement : exécution de yt-dlp et suivi de progression."""
import os
import re
import signal
import subprocess
import threading

from .binaries import CREATE_NO_WINDOW, IS_WINDOWS
from .journal import command_line

# Codes internes ; la traduction pour l'affichage se fait dans app.py (st.*)
ST_PENDING = "pending"
ST_RUNNING = "running"
ST_DONE = "done"
ST_ERROR = "error"
ST_CANCELLED = "cancelled"

FINAL_STATES = (ST_DONE, ST_ERROR, ST_CANCELLED)

RE_PROGRESS = re.compile(
    r"\[download\]\s+(?P<pct>[\d.]+)%"
    r"(?:\s+of\s+~?\s*(?P<size>\S+))?"
    r"(?:\s+at\s+(?P<speed>\S+))?"
    r"(?:\s+ETA\s+(?P<eta>\S+))?"
)
RE_ITEM = re.compile(r"\[download\][^\S\n]*Downloading item (\d+) of (\d+)")
RE_DEST = re.compile(r"\[(?:download|ExtractAudio)\] Destination: (.+)")
RE_MERGE = re.compile(r'\[Merger\] Merging formats into "(.+)"')
RE_ALREADY = re.compile(r"\[download\] (.+) has already been downloaded")
# Tâches à passages : yt-dlp annonce le nombre de plages, puis ffmpeg (--download-sections)
# écrit ses statistiques au lieu des lignes "[download] x%".
RE_RANGES = re.compile(r"\[info\] .*: Downloading (\d+) time ranges?")
RE_FFTIME = re.compile(r"time=\s*(\d+):(\d\d):(\d\d(?:\.\d+)?)")
RE_FFSPEED = re.compile(r"speed=\s*([\d.]+x)")
RE_FFSIZE = re.compile(r"\b(?:L?size)=\s*(\d+(?:\.\d+)?\s*[KMG]i?B)")

PHASE_PREPARE = "prepare"
PHASE_DOWNLOAD = "download"
PHASE_MERGE = "merge"


class Job:
    _next_id = 1

    def __init__(self, url, cmd, dest_dir, clip=None, prepare=None, finish=None, cleanup=None):
        self.id = Job._next_id
        Job._next_id += 1
        self.url = url
        self.cmd = cmd
        self.dest_dir = dest_dir
        # Passages ({"sections": [[début, fin], ...], "precise", "merge"}) ou None.
        # prepare(job) -> commande, appelée juste avant le lancement (dans le thread de
        # la tâche) ; finish(job) -> code retour, appelée après un succès de yt-dlp.
        # Toutes deux peuvent lancer un processus : elles le rangent dans job.proc pour
        # que l'annulation le tue.
        self.clip = clip
        self.prepare = prepare
        self.finish = finish
        self.phase = ""
        self.part_index = 0
        self.part_total = len(clip["sections"]) if clip else 0
        self.work_dir = None
        self.cleanup = cleanup     # cleanup(job), appelée une fois la tâche finie
        self.title = url
        self.status = ST_PENDING
        self.percent = 0.0
        self.speed = ""
        self.eta = ""
        self.size = ""      # taille annoncée par yt-dlp ("45.20MiB", "~1.2GiB")
        self.item = ""      # "2/10" pour les playlists
        self.proc = None
        self.cancelled = False
        self.log = []


class Engine:
    """Gère la file : démarre les jobs, lit la sortie, publie des événements.

    Événements postés dans ui_queue (tuples) :
      ("status", job_id), ("progress", job_id), ("title", job_id),
      ("log", job_id, ligne), ("journal", job_id, ligne), ("done", job_id, code_retour)
    ("journal" va seulement dans lasso.log, pas dans la page Journal.)
    """

    def __init__(self, ui_queue):
        self.ui_queue = ui_queue
        self.jobs = {}
        self.order = []
        self.lock = threading.Lock()
        self.max_concurrent = 1
        self.running = False

    def _post(self, *event):
        self.ui_queue.put(event)

    def add_job(self, url, cmd, dest_dir, clip=None, prepare=None, finish=None, cleanup=None):
        job = Job(url, cmd, dest_dir, clip, prepare, finish, cleanup)
        with self.lock:
            self.jobs[job.id] = job
            self.order.append(job.id)
        if self.running:
            self._fill_slots()
        return job

    def start(self, max_concurrent=1):
        self.max_concurrent = max(1, int(max_concurrent))
        self.running = True
        self._fill_slots()

    def _active_count(self):
        return sum(1 for j in self.jobs.values() if j.status == ST_RUNNING)

    def _fill_slots(self):
        to_start = []
        with self.lock:
            if not self.running:
                return
            free = self.max_concurrent - self._active_count()
            for jid in self.order:
                if free <= 0:
                    break
                job = self.jobs[jid]
                if job.status == ST_PENDING and not job.cancelled:
                    job.status = ST_RUNNING
                    to_start.append(job)
                    free -= 1
        for job in to_start:
            self._post("status", job.id)
            threading.Thread(target=self._run, args=(job,), daemon=True).start()

    def _run(self, job):
        self._post("journal", job.id, job.url)
        if job.prepare is not None:
            job.phase = PHASE_PREPARE
            self._post("status", job.id)
            try:
                job.cmd = job.prepare(job)
            except Exception as exc:
                if not job.cancelled:
                    self._post("log", job.id, str(exc))
                self._finish(job, -1)
                return
            if job.cancelled:
                self._finish(job, -1)
                return
        job.phase = PHASE_DOWNLOAD
        job.part_index = 0
        self._post("journal", job.id, command_line(job.cmd))
        try:
            job.proc = subprocess.Popen(
                job.cmd,
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                text=True, encoding="utf-8", errors="replace",
                creationflags=CREATE_NO_WINDOW,
                # Linux : groupe de processus dédié, pour que l'annulation tue aussi
                # les ffmpeg lancés par yt-dlp (équivalent du /T de taskkill).
                start_new_session=not IS_WINDOWS,
            )
        except Exception as exc:
            self._post("log", job.id, "Impossible de lancer yt-dlp : %s" % exc)
            self._finish(job, -1)
            return

        try:
            for line in job.proc.stdout:
                line = line.rstrip()
                if not line:
                    continue
                job.log.append(line)
                self._post("log", job.id, line)
                self._parse_line(job, line)
        except Exception as exc:
            self._post("log", job.id, "Erreur de lecture de la sortie de yt-dlp : %s" % exc)

        rc = job.proc.wait()
        if rc in (0, 101) and job.finish is not None and not job.cancelled:
            job.phase = PHASE_MERGE
            job.speed = job.eta = ""
            self._post("status", job.id)
            try:
                rc = job.finish(job)
            except Exception as exc:
                self._post("log", job.id, str(exc))
                rc = -1
        self._finish(job, rc)

    def _finish(self, job, rc):
        if job.cancelled:
            job.status = ST_CANCELLED
        elif rc == 0 or rc == 101:  # 101 = --max-downloads atteint
            job.status = ST_DONE
            job.percent = 100.0
            job.speed = ""
            job.eta = ""
        else:
            job.status = ST_ERROR
        job.phase = ""
        self._post("journal", job.id, "code de sortie : %s" % rc)
        if job.cleanup is not None:
            try:
                job.cleanup(job)
            except Exception:
                pass
        self._post("status", job.id)
        self._post("done", job.id, rc)
        self._fill_slots()

    def _parse_line(self, job, line):
        if job.clip and self._parse_clip_line(job, line):
            return
        m = RE_PROGRESS.match(line)
        if m:
            try:
                job.percent = float(m.group("pct"))
            except ValueError:
                pass
            job.speed = m.group("speed") or ""
            job.eta = m.group("eta") or ""
            job.size = m.group("size") or job.size
            self._post("progress", job.id)
            return
        m = RE_ITEM.search(line)
        if m:
            job.item = "%s/%s" % (m.group(1), m.group(2))
            self._post("status", job.id)
            return
        m = RE_DEST.search(line) or RE_MERGE.search(line) or RE_ALREADY.search(line)
        if m:
            job.title = os.path.basename(m.group(1).strip())
            self._post("title", job.id)

    def _parse_clip_line(self, job, line):
        """Progression d'une tâche à passages : (passages finis + avancée de celui en
        cours d'après le time= de ffmpeg) / nombre de passages."""
        sections = job.clip["sections"]
        m = RE_RANGES.search(line)
        if m:
            job.part_total = int(m.group(1))
            return True
        m = RE_DEST.search(line)
        if m and line.startswith("[download]"):
            job.part_index = min(job.part_index + 1, max(job.part_total, 1))
            job.title = os.path.basename(m.group(1).strip())
            job.item = "%d/%d" % (job.part_index, job.part_total) if job.part_total > 1 else ""
            self._post("title", job.id)
            return True
        m = RE_FFTIME.search(line)
        if m and job.part_index:
            elapsed = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
            idx = job.part_index - 1
            span = sections[idx][1] - sections[idx][0] if idx < len(sections) else 0
            frac = min(1.0, elapsed / span) if span > 0 else 0.0
            job.percent = min(99.9, (idx + frac) * 100.0 / max(job.part_total, 1))
            sp = RE_FFSPEED.search(line)
            job.speed = sp.group(1) if sp else job.speed
            sz = RE_FFSIZE.search(line)
            job.size = sz.group(1).replace(" ", "") if sz else job.size
            job.eta = ""
            self._post("progress", job.id)
            return True
        if RE_PROGRESS.match(line):
            # "[download] 100% of ..." clôt chaque passage : ne pas afficher 100 % trop tôt.
            if job.part_index:
                job.percent = min(99.9, job.part_index * 100.0 / max(job.part_total, 1))
                self._post("progress", job.id)
            return True
        return False

    def cancel(self, job_id):
        with self.lock:
            job = self.jobs.get(job_id)
            if not job or job.status in FINAL_STATES:
                return
            job.cancelled = True
            if job.status == ST_PENDING:
                job.status = ST_CANCELLED
                self._post("status", job.id)
                return
            proc = job.proc
        if proc and proc.poll() is None:
            try:
                if IS_WINDOWS:
                    subprocess.run(
                        ["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                        capture_output=True, creationflags=CREATE_NO_WINDOW,
                    )
                else:
                    os.killpg(proc.pid, signal.SIGKILL)
            except Exception:
                pass

    def cancel_all(self):
        self.running = False
        for jid in list(self.order):
            self.cancel(jid)

    def move(self, job_id, offset):
        """Déplace un job de `offset` positions dans l'ordre de la file (réordonnancement manuel).

        Retourne le nouvel index, ou None si le déplacement est impossible
        (job inconnu ou déjà en bout de file).
        """
        with self.lock:
            if job_id not in self.order:
                return None
            i = self.order.index(job_id)
            j = i + offset
            if j < 0 or j >= len(self.order):
                return None
            self.order[i], self.order[j] = self.order[j], self.order[i]
            return j

    def remove(self, job_id):
        """Retire un job non actif de la file. Retourne True si retiré."""
        with self.lock:
            job = self.jobs.get(job_id)
            if not job or job.status == ST_RUNNING:
                return False
            self.jobs.pop(job_id, None)
            if job_id in self.order:
                self.order.remove(job_id)
        return True
