[English](README.md) · **Français**

# YTDL Interface

Interface graphique complète pour [yt-dlp](https://github.com/yt-dlp/yt-dlp), le successeur maintenu de youtube-dl. Compatible YouTube et plus de 1000 autres sites.

## Lancement

**Version prête à l'emploi (recommandé) :** depuis la page [Releases](../../releases), téléchargez l'archive correspondant à votre système, extrayez-la où vous voulez, puis lancez l'exécutable dans le dossier extrait. Aucune installation, aucun prérequis.

- **Windows :** `YTDL-Interface-windows.zip`, puis lancez `YTDL-Interface.exe`.
- **Linux (x86_64) :** `YTDL-Interface-linux.tar.gz`, puis :
  ```bash
  tar -xzf YTDL-Interface-linux.tar.gz
  ./YTDL-Interface/YTDL-Interface
  ```
  Fonctionne sur les distributions avec glibc 2.35 ou plus récente (Ubuntu 22.04+, Debian 12+, Fedora 36+, Linux Mint 21+...).

> **SmartScreen de Windows :** au premier lancement, Windows peut afficher "Windows a protégé votre ordinateur". Ça signifie simplement que l'exe est récent et non signé, pas encore reconnu comme fiable par le système de réputation de SmartScreen : ce n'est pas une détection de virus. Cliquez sur **Informations complémentaires** puis **Exécuter quand même**.

**Depuis les sources :** nécessite Python 3.9+ et les dépendances de `requirements.txt` ([pywebview](https://pywebview.flowrl.com/), qui affiche l'interface dans une fenêtre native).
```bash
pip install -r requirements.txt
```
- **Windows :** double-cliquer sur `main.pyw`. L'interface s'appuie sur WebView2, déjà présent sur Windows 10 et 11.
- **Linux :** `python3 main.pyw`. pip installe le moteur Qt WebEngine ; le moteur GTK des paquets système (`python3-gi` et `gir1.2-webkit2-4.1` sur Debian/Ubuntu) convient aussi.

Dans les deux cas, si yt-dlp et/ou ffmpeg sont absents de la machine, l'application le détecte au démarrage et propose une fenêtre d'installation avec barre de progression par composant ; l'installation se fait en arrière-plan, sans quitter l'app. Accessible aussi à tout moment depuis la section Avancé ("Télécharger yt-dlp" / "Installer ffmpeg" / "Mettre à jour yt-dlp"), ou en cliquant sur l'état de yt-dlp / ffmpeg en bas du menu. [Deno](https://deno.com), facultatif mais conseillé pour YouTube (yt-dlp s'en sert pour obtenir tous les formats), s'installe de la même façon ("Installer Deno"). Les réglages et les binaires sont enregistrés dans ce même dossier (`settings.json`, `bin/`), à côté de l'exécutable, pas dans un dossier système : gardez le dossier entier ensemble.

## Langue et thème

En bas du menu latéral :
- **Thème** : l'interface suit le design system Cosmic (fond spatial, accents néon violets) en sombre, avec une variante claire. "Auto" (icône d'écran) suit le thème du système : celui de Windows (barre de titre comprise, aux couleurs de l'interface sous Windows 11), ou sous Linux le réglage clair/sombre de GNOME et des bureaux compatibles.
- **Langue** : 9 langues disponibles (français, anglais, espagnol, allemand, italien, portugais, néerlandais, polonais, russe), appliquées sans redémarrer. "Auto" suit la langue du système (langue de Windows, ou variables `LANGUAGE` / `LANG` sous Linux).

## Utilisation rapide

1. Coller un ou plusieurs liens (un par ligne) dans la section **Téléchargement** : bouton Coller, Ctrl+V n'importe où dans la page, ou glisser-déposer un lien depuis le navigateur.
2. Choisir un préréglage en un clic (Meilleure, 1080p, 720p, MP3, M4A) ou affiner dans les réglages. Le résumé sous les liens montre ce qui sera appliqué (format, sous-titres, playlist, simulation...) ; un clic sur une étiquette ouvre le réglage correspondant.
3. Cliquer sur **Télécharger** (ou Ctrl+Entrée). La file affiche miniature (YouTube), progression, vitesse, temps restant et taille.

Dans la file : clic pour sélectionner (Ctrl/Maj + clic pour plusieurs), clic droit pour réessayer, annuler, copier le lien ou réordonner, Suppr pour retirer la sélection, double-clic pour ouvrir le dossier.

Le bouton **Analyser la vidéo** affiche titre, durée, miniature et la liste complète des formats disponibles (filtrable vidéo / audio) ; on peut y choisir manuellement un format vidéo + un format audio précis.

## Découper avant de télécharger

Pour ne garder qu'un passage d'une vidéo (ou plusieurs), cliquez sur **Découper…** à côté des liens : l'option est facultative, le téléchargement normal n'en dépend pas. Le même éditeur s'ouvre depuis la fenêtre d'analyse ("Prévisualiser et découper") et depuis une ligne de la file pas encore lancée (icône ciseaux).

- L'éditeur prépare un aperçu, au plus en 720p, lu directement dans l'application. Si la lecture directe n'est pas possible, il crée un aperçu local en 720p (automatiquement pour une vidéo de moins de 30 minutes).
- La frise montre les vignettes de la vidéo, ses chapitres et, sur YouTube, les moments les plus revus. Glissez les poignées des passages, ou posez début et fin à la tête de lecture avec **I** et **O** ; **N** ajoute un passage, **Espace** lit ou met en pause, **,** et **.** avancent image par image (tous les raccourcis : bouton clavier de l'éditeur).
- Les temps se saisissent aussi au clavier (`1:30`, `01:02:03.250`...).
- Au choix : un fichier par passage, ou un seul fichier avec les passages bout à bout. "Coupes précises" coupe exactement aux temps choisis en ré-encodant (plus lent) ; sinon la coupe se cale sur l'image-clé la plus proche.
- Seuls les passages sont téléchargés, avec les réglages de format habituels (ffmpeg est nécessaire). Sur YouTube, l'application lit les variantes HLS de la vidéo, découpées en segments, pour ne télécharger que ce qu'il faut.

## Les sections

- **Téléchargement** : liens, destination, préréglages, file d'attente.
- **Format et qualité** : vidéo/audio seul, résolution max, conteneur (mp4/mkv/webm), codec, format audio (mp3, m4a, opus, flac...), qualité, sélecteur `-f` personnalisé.
- **Sous-titres** : officiels ou automatiques, langues, conversion srt, incrustation.
- **Playlist et filtres** : playlist entière ou vidéo seule, sélection d'éléments, filtres par date et taille, archive anti-doublons, tolérance aux erreurs.
- **Fichiers et métadonnées** : modèle de nom (avec sous-dossiers), miniature, métadonnées, chapitres, description, découpage par chapitres, SponsorBlock (marquer ou supprimer les pubs intégrées).
- **Réseau et comptes** : limite de vitesse, fragments parallèles (accélération), proxy, IPv4, cookies du navigateur (vidéos privées ou avec limite d'âge), identifiants.
- **Avancé** : téléchargement partiel par sections de temps, téléchargements simultanés, chemins des binaires, mise à jour de yt-dlp, simulation, arguments libres, et l'aperçu en direct de la commande yt-dlp générée (copiable).
- **Journal** : sortie complète de yt-dlp, colorée (erreurs, avertissements, étapes clés) et filtrable, pour le diagnostic.

Chaque option est expliquée directement sous son nom.

## Notes

- Les réglages sont mémorisés dans `settings.json`, à côté de l'exécutable (le mot de passe n'est jamais enregistré).
- En cas d'erreur "Sign in to confirm you're not a bot" sur YouTube : section Réseau et comptes, sélectionner son navigateur dans "Utiliser les cookies du navigateur".
- Toute option yt-dlp absente de l'interface peut être passée via "Arguments supplémentaires" (section Avancé).

## Avertissement

Cet outil télécharge du contenu depuis des sites tiers. À utiliser dans le respect des conditions d'utilisation de ces sites et des droits des ayants droit (usage personnel, contenus libres de droits ou dont vous détenez les droits).

## Licence et crédits

YTDL Interface est distribué sous licence MIT (voir [LICENSE](LICENSE)).

Au premier lancement, l'application télécharge pour son propre fonctionnement :
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (licence Unlicense / domaine public)
- [ffmpeg](https://github.com/BtbN/FFmpeg-Builds) (build GPL de BtbN)
- [Deno](https://github.com/denoland/deno) (licence MIT), facultatif, à la demande

L'interface utilise [pywebview](https://github.com/r0x0r/pywebview) (licence BSD), les polices [Audiowide](https://fonts.google.com/specimen/Audiowide) et [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (licence SIL Open Font, embarquées dans `ytdlgui/web/fonts/`) des tracés d'icônes [Lucide](https://lucide.dev) (licence ISC) et [hls.js](https://github.com/video-dev/hls.js) (licence Apache 2.0, embarqué dans `ytdlgui/web/vendor/`) pour l'aperçu de l'éditeur de passages. Son style suit le design system Cosmic d'Open Design.
