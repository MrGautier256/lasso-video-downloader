"""Construction de la ligne de commande yt-dlp à partir des réglages."""
import re
import shlex


def _digits(s):
    m = re.search(r"\d+", str(s or ""))
    return m.group(0) if m else ""


# ------------------------------------------------------------------ temps et passages
_TIME = re.compile(r"^(?:(\d+):)?(?:(\d+):)?(\d+(?:[.,]\d*)?)$")


def parse_time(text):
    """Secondes (float) depuis "90", "1:30", "01:30.5", "1:02:03,250". ValueError sinon.
    Mêmes règles que parseTime() dans web/app.js."""
    m = _TIME.match(str(text or "").strip())
    if not m:
        raise ValueError("invalid time: %r" % text)
    a, b, sec = m.groups()
    hours, minutes = (int(a), int(b)) if b is not None else (0, int(a or 0))
    return hours * 3600 + minutes * 60 + float(sec.replace(",", "."))


def format_time(seconds):
    """"hh:mm:ss.mmm" (mêmes règles que fmtTime() dans web/app.js)."""
    ms = int(round(max(0.0, float(seconds)) * 1000))
    h, rem = divmod(ms, 3600000)
    m, rem = divmod(rem, 60000)
    s, ms = divmod(rem, 1000)
    return "%02d:%02d:%02d.%03d" % (h, m, s, ms)


def normalize_sections(sections):
    """Passages [début, fin] triés, sans chevauchement (ceux qui se recouvrent sont
    réunis), en secondes ; ignore les passages vides."""
    out = []
    for start, end in sorted((float(a), float(b)) for a, b in sections):
        if end <= start:
            continue
        if out and start <= out[-1][1]:
            out[-1][1] = max(out[-1][1], end)
        else:
            out.append([start, end])
    return out


def format_sections(sections):
    """Argument de --download-sections : "*83.250-97.000,600.000-645.500"."""
    return "*" + ",".join("%.3f-%.3f" % (a, b) for a, b in normalize_sections(sections))


# Ré-encodage rapide des coupes précises : sans encodeur imposé, ffmpeg prendrait celui
# par défaut du conteneur (très lent en WebM/VP9).
_PRECISE_H264 = "-c:v libx264 -preset veryfast -crf 18 -c:a aac -b:a 192k"
_PRECISE_VP9 = "-c:v libvpx-vp9 -deadline realtime -cpu-used 8 -crf 32 -b:v 0 -c:a libopus"
# Sur un passage, yt-dlp garde les chapitres et segments SponsorBlock aux horaires de la
# vidéo entière : intégrés, un chapitre de 3 h donne à un extrait d'une minute une durée
# affichée de 3 h ; découper par chapitre ou retirer des segments viserait les mauvais
# moments. Placées après les réglages globaux, ces options les annulent pour le passage.
_SECTION_OVERRIDES = ["--no-embed-chapters", "--no-split-chapters", "--no-sponsorblock"]


def build_network_args(cfg):
    """Options réseau/authentification, réutilisées aussi pour l'analyse."""
    args = []
    proxy = cfg.get("proxy", "").strip()
    if proxy:
        args += ["--proxy", proxy]
    browser = cfg.get("cookies_browser", "").strip()
    if browser and not browser.startswith("("):
        args += ["--cookies-from-browser", browser]
    elif cfg.get("cookies_file", "").strip():
        args += ["--cookies", cfg["cookies_file"].strip()]
    if cfg.get("username", "").strip():
        args += ["--username", cfg["username"].strip()]
        if cfg.get("password", ""):
            args += ["--password", cfg["password"]]
    if cfg.get("force_ipv4"):
        args += ["--force-ipv4"]
    if cfg.get("geo_bypass"):
        args += ["--geo-bypass"]
    # Moteur JavaScript dont yt-dlp a besoin pour YouTube. "_deno" est fourni par
    # l'application (chemin trouvé) : ce n'est pas un réglage enregistré.
    if cfg.get("_deno"):
        args += ["--js-runtimes", "deno:%s" % cfg["_deno"]]
    return args


def needs_ffmpeg(cfg, clip=None):
    """Estime si les réglages actuels nécessitent ffmpeg pour aboutir sans erreur.

    Couvre les cas certains (extraction audio, embed, recode, découpage...) ainsi
    que le cas le plus courant en pratique : un mode "vidéo" sans format personnalisé
    finit presque toujours par fusionner un flux vidéo et un flux audio séparés
    (DASH), ce que yt-dlp ne peut faire sans ffmpeg.
    """
    if clip:
        return True   # --download-sections passe toujours par ffmpeg
    mode = cfg.get("mode", "video")
    if mode == "audio":
        return True
    custom = cfg.get("custom_format", "").strip()
    if custom:
        if "+" in custom:
            return True
    elif mode == "video":
        return True
    if cfg.get("embed_thumbnail") or cfg.get("embed_metadata") or cfg.get("embed_chapters"):
        return True
    if cfg.get("recode"):
        return True
    cont = cfg.get("container", "auto").strip()
    if cont and cont != "auto":
        return True
    if cfg.get("split_chapters"):
        return True
    if cfg.get("sb_mode") in ("mark", "remove"):
        return True
    if cfg.get("sections", "").strip():
        return True
    if cfg.get("convert_subs", "").strip().lower() in ("srt", "vtt", "ass", "lrc"):
        return True
    if cfg.get("embed_subs"):
        return True
    return False


def format_args(cfg, clip=None):
    """Options de choix du format (et d'extraction audio) : servent au téléchargement
    et à l'estimation de taille de l'éditeur de passages."""
    args = []
    mode = cfg.get("mode", "video")
    custom = cfg.get("custom_format", "").strip()
    if custom:
        args += ["-f", custom]
    elif mode == "video_only":
        args += ["-f", "bestvideo/best"]
    elif mode == "audio":
        args += ["-f", "bestaudio/best"]

    if mode == "audio":
        args += ["-x"]
        # Les libellés localisés ("Meilleure", "Best"...) ne sont jamais passés
        # à yt-dlp : seules les valeurs techniques connues le sont.
        af = cfg.get("audio_format", "").strip().lower()
        if af in ("mp3", "m4a", "opus", "flac", "wav", "aac", "vorbis", "alac"):
            args += ["--audio-format", af]
        aq = cfg.get("audio_quality", "").strip()
        if aq:
            args += ["--audio-quality", aq if any(c.isdigit() for c in aq) else "0"]
    else:
        sort = []
        res = _digits(cfg.get("max_res", ""))
        if res:
            sort.append("res:%s" % res)
        if clip:
            # Passage : préférer les variantes HLS, découpées en segments, dont ffmpeg ne
            # lit que ceux du passage (d'un flux DASH, il lit tout le fichier).
            sort.append("proto:m3u8")
        vc = cfg.get("vcodec", "auto").strip()
        if vc and vc != "auto":
            sort.append("vcodec:%s" % vc)
        elif cfg.get("container", "auto").strip() == "mp4":
            # MP4 est choisi pour être lu partout : à résolution égale, image H.264 et son
            # AAC plutôt que VP9, AV1 ou Opus, qui dans un MP4 saccadent ou ne se lisent
            # pas sur bien des lecteurs, TV et décodeurs matériels. La résolution reste
            # prioritaire ; la langue d'origine du son aussi (pistes AAC dans chaque langue).
            if not res:
                sort.insert(0, "res")
            sort += ["vcodec:h264", "acodec:aac"]
        if sort:
            args += ["-S", ",".join(sort)]
    return args


def output_template(cfg, clip=None):
    tmpl = cfg.get("output_template", "").strip() or "%(title)s.%(ext)s"
    if clip and "section_" not in tmpl:
        # Un fichier par passage : sans le début dans le nom, le deuxième passage
        # porterait le nom du premier et serait sauté.
        mark = " [%(section_start>%H-%M-%S)s]"
        if tmpl.endswith(".%(ext)s"):
            tmpl = tmpl[:-len(".%(ext)s")] + mark + ".%(ext)s"
        else:
            tmpl += mark
    return tmpl


def build_command(cfg, url, ytdlp_path, ffmpeg_path=None, clip=None, info_json=None, extra_args=None):
    """Commande yt-dlp. `clip` ({"sections": [[début, fin], ...], "precise": bool,
    "merge": bool}) limite le téléchargement à ces passages ; `info_json` remplace l'URL
    par --load-info-json (passages YouTube, cf. ytdlgui/clips.py)."""
    args = [ytdlp_path, "--newline", "--progress"]
    if ffmpeg_path:
        args += ["--ffmpeg-location", ffmpeg_path]

    # ----- Format et qualité -----
    args += format_args(cfg, clip)
    if cfg.get("mode", "video") != "audio":
        cont = cfg.get("container", "auto").strip()
        if cont and cont != "auto":
            args += ["--recode-video" if cfg.get("recode") else "--remux-video", cont]

    # ----- Sous-titres -----
    if cfg.get("write_subs"):
        args += ["--write-subs"]
    if cfg.get("auto_subs"):
        args += ["--write-auto-subs"]
    if cfg.get("write_subs") or cfg.get("auto_subs") or cfg.get("embed_subs"):
        langs = "all" if cfg.get("all_subs") else cfg.get("sub_langs", "").strip()
        if langs:
            args += ["--sub-langs", langs]
    cs = cfg.get("convert_subs", "").strip().lower()
    if cs in ("srt", "vtt", "ass", "lrc"):
        args += ["--convert-subs", cs]
    if cfg.get("embed_subs"):
        args += ["--embed-subs"]

    # ----- Playlist et filtres -----
    # Des passages visent une vidéo précise : ni playlist, ni filtres, ni archive
    # (l'archive marquerait la vidéo comme prise et sauterait l'extrait suivant).
    if clip or cfg.get("playlist_mode", "single") == "single":
        args += ["--no-playlist"]
    else:
        args += ["--yes-playlist"]
    for key, flag in (
        ("playlist_items", "--playlist-items"),
        ("date_after", "--dateafter"),
        ("date_before", "--datebefore"),
        ("max_filesize", "--max-filesize"),
    ):
        v = cfg.get(key, "").strip()
        if v and not clip:
            args += [flag, v]
    md = cfg.get("max_downloads", "").strip()
    if md.isdigit() and int(md) > 0 and not clip:
        args += ["--max-downloads", md]
    if cfg.get("use_archive") and not clip:
        ap = cfg.get("archive_path", "").strip() or "archive.txt"
        args += ["--download-archive", ap]
    if cfg.get("ignore_errors"):
        args += ["--ignore-errors"]

    # ----- Fichiers et métadonnées -----
    dest = cfg.get("dest_dir", "").strip()
    if dest:
        args += ["-P", dest]
    args += ["-o", output_template(cfg, clip)]
    if cfg.get("restrict_filenames"):
        args += ["--restrict-filenames"]
    if cfg.get("no_mtime"):
        args += ["--no-mtime"]
    for key, flag in (
        ("embed_thumbnail", "--embed-thumbnail"),
        ("write_thumbnail", "--write-thumbnail"),
        ("embed_metadata", "--embed-metadata"),
        ("embed_chapters", "--embed-chapters"),
        ("write_description", "--write-description"),
        ("write_infojson", "--write-info-json"),
        ("split_chapters", "--split-chapters"),
    ):
        if cfg.get(key):
            args += [flag]
    sb = cfg.get("sb_mode", "non")
    if sb in ("mark", "remove"):
        cats = cfg.get("sb_cats", "").strip() or "sponsor"
        args += ["--sponsorblock-mark" if sb == "mark" else "--sponsorblock-remove", cats]

    # ----- Réseau et performances -----
    lr = cfg.get("limit_rate", "").strip()
    if lr:
        args += ["--limit-rate", lr]
    rt = cfg.get("retries", "").strip()
    if rt.isdigit():
        args += ["--retries", rt]
    ncf = cfg.get("concurrent_fragments", "").strip()
    if ncf.isdigit() and int(ncf) > 1:
        args += ["--concurrent-fragments", ncf]
    si = cfg.get("sleep_interval", "").strip()
    if si:
        try:
            float(si)
            args += ["--sleep-interval", si]
        except ValueError:
            pass
    args += build_network_args(cfg)

    # ----- Avancé -----
    if clip:
        args += clip_args(cfg, clip)
    else:
        sec = cfg.get("sections", "").strip()
        if sec:
            args += ["--download-sections", sec] + _SECTION_OVERRIDES
            if cfg.get("force_keyframes"):
                args += ["--force-keyframes-at-cuts"]
    if cfg.get("simulate"):
        args += ["--simulate"]
    if cfg.get("verbose"):
        args += ["--verbose"]
    extra = cfg.get("custom_args", "").strip()
    if extra:
        try:
            args += [t.strip('"') for t in shlex.split(extra, posix=False)]
        except ValueError:
            args += extra.split()

    args += list(extra_args or [])
    if info_json:
        args += ["--load-info-json", info_json]
    else:
        args.append(url)
    return args


def clip_args(cfg, clip):
    """Options propres aux passages d'une tâche (remplacent pour elle le réglage global
    "Découpage")."""
    args = ["--download-sections", format_sections(clip["sections"]),
            # ffmpeg sans bannière ni métadonnées : seules ses statistiques (time=...)
            # restent, et servent à la progression (cf. engine.py).
            "--downloader-args", "ffmpeg_i:-hide_banner -loglevel warning -stats"] + _SECTION_OVERRIDES
    if clip_is_precise(clip):
        args += ["--force-keyframes-at-cuts"]
        if cfg.get("mode", "video") != "audio":
            cont = cfg.get("container", "auto").strip()
            if cont == "webm":
                args += ["--downloader-args", "ffmpeg_o:" + _PRECISE_VP9]
            else:
                args += ["--merge-output-format", cont if cont in ("mp4", "mkv") else "mp4",
                         "--downloader-args", "ffmpeg_o:" + _PRECISE_H264]
    return args


def clip_is_precise(clip):
    """La fusion de plusieurs passages impose des coupes précises : des morceaux copiés
    tels quels (coupés à l'image-clé) se raccordent mal."""
    return bool(clip.get("precise") or (clip.get("merge") and len(clip["sections"]) > 1))
