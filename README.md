**English** · [Français](README.fr.md)

# Lasso

**Lasso Video Downloader** (formerly YTDL Interface): a full-featured graphical interface for [yt-dlp](https://github.com/yt-dlp/yt-dlp), the actively maintained successor to youtube-dl. Works with YouTube and 1000+ other sites.

## Getting started

**Ready-to-run build (recommended):** from the [Releases](../../releases) page, download the archive for your system, extract it anywhere, and run the executable inside the extracted folder. No install, no prerequisites.

- **Windows:** `Lasso-windows.zip`, then run `Lasso.exe`.
- **Linux (x86_64):** `Lasso-linux.tar.gz`, then:
  ```bash
  tar -xzf Lasso-linux.tar.gz
  ./Lasso/Lasso
  ```
  Works on distributions with glibc 2.35 or newer (Ubuntu 22.04+, Debian 12+, Fedora 36+, Linux Mint 21+...).

> **Windows SmartScreen:** on first launch, Windows may show "Windows protected your PC". This just means the exe is new and unsigned, not yet flagged as trustworthy by SmartScreen's reputation system — it's not a malware detection. Click **More info**, then **Run anyway**.

**From source:** requires Python 3.9+ and the dependencies in `requirements.txt` ([pywebview](https://pywebview.flowrl.com/), which shows the interface in a native window).
```bash
pip install -r requirements.txt
```
- **Windows:** double-click `main.pyw`. The interface relies on WebView2, already present on Windows 10 and 11.
- **Linux:** `python3 main.pyw`. pip installs the Qt WebEngine backend; the GTK backend from system packages (`python3-gi` and `gir1.2-webkit2-4.1` on Debian/Ubuntu) works too.

Either way, if yt-dlp and/or ffmpeg are missing on the machine, the app detects it on startup and offers an install window with a per-component progress bar; installation runs in the background without closing the app. Also reachable any time from the Advanced section ("Download yt-dlp" / "Install ffmpeg" / "Update yt-dlp"), or by clicking the yt-dlp / ffmpeg status at the bottom of the menu. [Deno](https://deno.com), optional but recommended for YouTube (yt-dlp uses it to get every format), is suggested at startup when it's missing ("Don't suggest again" if you don't want it), and can also be installed from Advanced ("Install Deno"). Settings and binaries are stored inside that same folder (`settings.json`, `bin/`), next to the executable, not in a system directory — keep the whole folder together.

## Updates

At startup, at most once a day, the app checks whether a new version is published on GitHub. If so, it offers it with the release notes: **Update**, **Later** or **Skip this version**. Nothing is installed without your approval.

The update downloads the new version's archive, checks its SHA-256 checksum, then restarts the app to replace its files. Your settings, `bin/` (yt-dlp, ffmpeg, Deno), `archive.txt` and anything else you keep in the folder are preserved. The folder must be writable: in a protected folder (such as Program Files) or when run from source, the app just opens the new version's page.

Settings in Advanced > Application: startup check (can be turned off) and a "Check for updates" button.

## Language and theme

At the bottom of the side menu:
- **Theme**: the interface follows the Clay design system (warm cream and terracotta, dashed outlines for what has not started yet) in light mode, with a warm dark variant. "Auto" (screen icon) follows the system theme: the Windows theme (title bar included, in the interface's colors on Windows 11), or on Linux the light/dark setting of GNOME and compatible desktops.
- **Language**: 9 languages available (French, English, Spanish, German, Italian, Portuguese, Dutch, Polish, Russian), applied without restarting. "Auto" follows the system language (Windows UI language, or the `LANGUAGE` / `LANG` variables on Linux).

## Quick start

1. Paste one or more links (one per line) in the **Download** section: Paste button, Ctrl+V anywhere on the page, or drag and drop a link from your browser. Each link shows up under the field with its thumbnail, title and duration (for a playlist: its title, number of videos and their total duration), and its own Analyze, Cut and Remove buttons.
2. Pick a preset in one click (Best, 1080p, 720p, MP3, M4A) or fine-tune in the settings. The summary under the links shows what will be applied (format, subtitles, playlist, simulation...); clicking a tag opens the matching setting.
3. Click **Download** (or Ctrl+Enter). The queue shows thumbnail (YouTube), progress, speed, time remaining and size.

In the queue: click to select (Ctrl/Shift + click for several), right-click to retry, cancel, copy the link or reorder, Delete to remove the selection, double-click to open the folder.

A link's **Analyze** button shows title, duration, thumbnail and the full list of available formats (filterable video / audio); you can manually pick a specific video format + audio format from there. On a playlist, it lists its videos with their duration.

## Cut before downloading

To keep only one part of a video (or several), click the link's scissors under the field (greyed out for a playlist or a live stream in progress): the option is optional, normal downloads don't depend on it. The same editor opens from the analysis window ("Preview and cut") and from a queue row that hasn't started yet (scissors icon).

- The editor prepares a preview, up to 720p, played right in the app. If direct playback isn't possible, it creates a local 720p preview (automatically for videos under 30 minutes).
- The timeline shows the video's thumbnails, its chapters and, on YouTube, the most replayed moments. Drag the part handles, or set start and end at the playhead with **I** and **O**; **N** adds a part, **Space** plays or pauses, **,** and **.** step frame by frame (all shortcuts: keyboard button in the editor).
- Times can also be typed (`1:30`, `01:02:03.250`...).
- Your choice: one file per part, or a single file with the parts joined. "Precise cuts" cuts exactly at the chosen times by re-encoding (slower); otherwise the cut snaps to the nearest keyframe.
- Only the parts are downloaded, with the usual format settings (ffmpeg is required). On YouTube, the app reads the video's HLS variants, split into segments, to download only what's needed.

## The sections

- **Download**: links, destination, presets, download queue.
- **Format and quality**: video/audio-only, max resolution, container (mp4/mkv/webm), codec, audio format (mp3, m4a, opus, flac...), quality, custom `-f` selector.
- **Subtitles**: official or auto-generated, languages, srt conversion, embedding.
- **Playlist and filters**: whole playlist or single video, item selection, date/size filters, duplicate-skip archive, error tolerance.
- **Files and metadata**: filename template (with subfolders), thumbnail, metadata, chapters, description, split by chapters, SponsorBlock (mark or remove embedded ads).
- **Network and accounts**: rate limit, parallel fragments (speed-up), proxy, IPv4, browser cookies (private or age-restricted videos), credentials.
- **Advanced**: partial download by time sections, concurrent downloads, binary paths, yt-dlp update, simulate mode, free-form arguments, and a live preview of the generated yt-dlp command (copyable).
- **Log**: full yt-dlp output, color-coded (errors, warnings, key steps) and filterable, for troubleshooting.

Every option is explained right under its name.

## Notes

- Settings are saved in `settings.json`, next to the executable (the password is never saved).
- On a YouTube "Sign in to confirm you're not a bot" error: Network and accounts section, pick your browser under "Use browser cookies".
- Any yt-dlp option not covered by the interface can be passed via "Extra arguments" (Advanced section).

## Disclaimer

This tool downloads content from third-party sites. Use it in accordance with those sites' terms of service and rights holders' rights (personal use, royalty-free content, or content you own the rights to).

## License and credits

Lasso is distributed under the MIT license (see [LICENSE](LICENSE)).

On first launch, the app downloads for its own operation:
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (Unlicense / public domain)
- [ffmpeg](https://github.com/BtbN/FFmpeg-Builds) (GPL build by BtbN)
- [Deno](https://github.com/denoland/deno) (MIT license), optional, on demand

The interface uses [pywebview](https://github.com/r0x0r/pywebview) (BSD license), the [Inter](https://rsms.me/inter/) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/) fonts (SIL Open Font License, bundled in `ytdlgui/web/fonts/`) [Lucide](https://lucide.dev) icon paths (ISC license) and [hls.js](https://github.com/video-dev/hls.js) (Apache 2.0 license, bundled in `ytdlgui/web/vendor/`) for the clip editor preview. Its style follows the Open Design Clay design system.
