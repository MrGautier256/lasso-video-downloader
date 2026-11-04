[English](README.md) · **Français**

# Lasso

**Lasso Video Downloader** (anciennement YTDL Interface) : interface graphique complète pour [yt-dlp](https://github.com/yt-dlp/yt-dlp), le successeur maintenu de youtube-dl. Compatible YouTube et plus de 1000 autres sites.

## Sites compatibles

Lasso télécharge depuis tous les sites que reconnaît yt-dlp, plus de 1 700 : YouTube, Twitch, Vimeo, Dailymotion, X (Twitter), Reddit, TikTok, Instagram, Facebook, SoundCloud, Bandcamp, Bilibili, Kick, Arte, France TV… ([liste complète](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)). Ce qui varie d'un site à l'autre, ce sont les fonctions autour du téléchargement :

- **YouTube :** tout fonctionne.
  - Vidéos, playlists et chaînes, SponsorBlock.
  - L'éditeur de passages montre des vignettes le long de la frise, les chapitres et les « moments les plus revus ».
  - Un extrait ne télécharge que les morceaux du passage.
- **Twitch :** rediffusions (VOD), temps forts et clips. L'éditeur fonctionne, sans vignettes ni « moments les plus revus », et un extrait ne télécharge que le passage.
- **Autres sites :** le téléchargement fonctionne de la même façon.
  - L'éditeur affiche directement la vidéo quand le site fournit un flux lisible. Sinon, il propose de télécharger d'abord un aperçu en 720p.
  - Les chapitres apparaissent quand le site en fournit.
- **Directs :** ils ne peuvent pas être découpés tant qu'ils sont en cours.
- **Contenus réservés aux comptes** (vidéos privées, limitées par l'âge, souvent Instagram et Facebook) : utilisez les cookies de votre navigateur, dans la page de réglages *Réseau et comptes*.
- **Non pris en charge :** les services protégés par DRM (Netflix, Disney+, Prime Video, Spotify, Deezer…).

## Lancement

**Version prête à l'emploi (recommandé) :** depuis la page [Releases](../../releases), téléchargez l'archive correspondant à votre système, extrayez-la où vous voulez, puis lancez l'exécutable dans le dossier extrait. Aucune installation, aucun prérequis.

- **Windows :** `Lasso-windows.zip`, puis lancez `Lasso.exe`.
- **Linux (x86_64) :** `Lasso-linux.tar.gz`, puis :
  ```bash
  tar -xzf Lasso-linux.tar.gz
  ./Lasso/Lasso
  ```
  Fonctionne sur les distributions avec glibc 2.35 ou plus récente (Ubuntu 22.04+, Debian 12+, Fedora 36+, Linux Mint 21+...).

> **SmartScreen de Windows :** au premier lancement, Windows peut afficher "Windows a protégé votre ordinateur". Ça signifie simplement que l'exe est récent et non signé, pas encore reconnu comme fiable par le système de réputation de SmartScreen : ce n'est pas une détection de virus. Cliquez sur **Informations complémentaires** puis **Exécuter quand même**.

**Depuis les sources :** nécessite Python 3.9+ et les dépendances de `requirements.txt` ([pywebview](https://pywebview.flowrl.com/), qui affiche l'interface dans une fenêtre native).
```bash
pip install -r requirements.txt
```
- **Windows :** double-cliquer sur `main.pyw`. L'interface s'appuie sur WebView2, déjà présent sur Windows 10 et 11.
- **Linux :** `python3 main.pyw`. pip installe le moteur Qt WebEngine ; le moteur GTK des paquets système (`python3-gi` et `gir1.2-webkit2-4.1` sur Debian/Ubuntu) convient aussi.

Dans les deux cas, si yt-dlp et/ou ffmpeg sont absents de la machine, l'application le détecte au démarrage et propose une fenêtre d'installation avec barre de progression par composant ; l'installation se fait en arrière-plan, sans quitter l'app. Accessible aussi à tout moment depuis la section Avancé ("Télécharger yt-dlp" / "Installer ffmpeg" / "Mettre à jour yt-dlp"), ou en cliquant sur l'état de yt-dlp / ffmpeg en bas du menu. [Deno](https://deno.com), facultatif mais conseillé pour YouTube (yt-dlp s'en sert pour obtenir tous les formats), est proposé au démarrage s'il manque (bouton "Ne plus proposer" si vous n'en voulez pas), et s'installe aussi depuis Avancé ("Installer Deno"). Les réglages et les binaires sont enregistrés dans ce même dossier (`settings.json`, `bin/`), à côté de l'exécutable, pas dans un dossier système : gardez le dossier entier ensemble.

## Mises à jour

L'application vérifie au démarrage, une fois par jour au plus, si une nouvelle version est publiée sur GitHub. Si c'est le cas, elle le propose avec les nouveautés : **Mettre à jour**, **Plus tard** ou **Ignorer cette version**. Rien ne s'installe sans votre accord.

La mise à jour télécharge l'archive de la nouvelle version, vérifie son empreinte SHA-256, puis redémarre l'application pour remplacer ses fichiers. Vos réglages, `bin/` (yt-dlp, ffmpeg, Deno), `archive.txt` et tout ce que vous avez rangé dans le dossier sont conservés. Le dossier doit être modifiable : dans un dossier protégé (Program Files par exemple) ou lancée depuis les sources, l'application ouvre simplement la page de la nouvelle version.

Réglages dans Avancé > Application : vérification au démarrage (désactivable) et bouton "Rechercher une mise à jour".

## Langue et thème

En bas du menu latéral :
- **Thème** : l'interface suit le design system Clay (crème chaude et terracotta, pointillés pour ce qui n'a pas encore commencé) en clair, avec une variante sombre chaude. "Auto" (icône d'écran) suit le thème du système : celui de Windows (barre de titre comprise, aux couleurs de l'interface sous Windows 11), ou sous Linux le réglage clair/sombre de GNOME et des bureaux compatibles.
- **Langue** : 9 langues disponibles (français, anglais, espagnol, allemand, italien, portugais, néerlandais, polonais, russe), appliquées sans redémarrer. "Auto" suit la langue du système (langue de Windows, ou variables `LANGUAGE` / `LANG` sous Linux).

## Utilisation rapide

1. Coller un ou plusieurs liens (un par ligne) dans la section **Téléchargement** : bouton Coller, Ctrl+V n'importe où dans la page, ou glisser-déposer un lien depuis le navigateur. Chaque lien s'affiche sous le champ avec sa miniature, son titre et sa durée (pour une playlist : son titre, son nombre de vidéos et leur durée totale), et ses propres boutons Analyser, Découper et Retirer.
2. Choisir un préréglage en un clic (Meilleure, 1080p, 720p, MP3, M4A) ou affiner dans les réglages. Le résumé sous les liens montre ce qui sera appliqué (format, sous-titres, playlist, simulation...) ; un clic sur une étiquette ouvre le réglage correspondant.
3. Cliquer sur **Télécharger** (ou Ctrl+Entrée). La file affiche miniature (YouTube), progression, vitesse, temps restant et taille.

Dans la file : clic pour sélectionner (Ctrl/Maj + clic pour plusieurs), clic droit pour réessayer, annuler, copier le lien ou réordonner, Suppr pour retirer la sélection, double-clic pour ouvrir le dossier.

Le bouton **Analyser** d'un lien affiche titre, durée, miniature et la liste complète des formats disponibles (filtrable vidéo / audio) ; on peut y choisir manuellement un format vidéo + un format audio précis. Sur une playlist, il liste ses vidéos avec leur durée.

## Découper avant de télécharger

Pour ne garder qu'un passage d'une vidéo (ou plusieurs), cliquez sur les ciseaux du lien, sous le champ (grisés pour une playlist ou un direct en cours) : l'option est facultative, le téléchargement normal n'en dépend pas. Le même éditeur s'ouvre depuis la fenêtre d'analyse ("Prévisualiser et découper") et depuis une ligne de la file pas encore lancée (icône ciseaux).

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

## Désinstaller

Lasso n'installe rien dans le système : ses réglages, ses outils (dossier `bin`) et son historique sont rangés dans son propre dossier. Pour le désinstaller, supprimez ce dossier.

Au premier lancement, Lasso propose d'ajouter un raccourci au menu Démarrer (et donc à la recherche Windows) ou, sous Linux, au menu des applications, avec en option un raccourci sur le Bureau. Ces raccourcis se gèrent dans Réglages › Avancé › Application. Avant de supprimer le dossier, décochez-les, ou supprimez-les à la main.

## Politique de signature du code (code signing policy)

Signature du code gratuite fournie par [SignPath.io](https://about.signpath.io/), certificat de la [SignPath Foundation](https://signpath.org/).

- Auteurs et relecteurs : [Gautier Mekhelian](https://github.com/MrGautier256)
- Approbateurs : [Gautier Mekhelian](https://github.com/MrGautier256)

La version Windows est compilée par GitHub Actions à partir de ce dépôt, et chaque version signée est approuvée à la main. Seul `Lasso.exe` est signé par ce projet : les bibliothèques tierces incluses dans l'archive (Python, pywebview, WebView2) et les outils téléchargés au premier lancement (yt-dlp, FFmpeg, Deno) ne le sont pas par ce projet.

### Confidentialité

Lasso n'envoie aucune donnée personnelle et ne contient ni statistiques ni télémétrie. Il ne se connecte qu'à :

- **les sites des vidéos** que vous lui demandez d'analyser ou de télécharger, y compris pour afficher leurs miniatures ;
- **GitHub**, pour vérifier au plus une fois par jour si une nouvelle version de Lasso existe (désactivable : *Vérifier les mises à jour au démarrage*, page de réglages *Avancé*, section *Application*), et pour télécharger yt-dlp, FFmpeg et Deno quand vous le demandez ([déclaration de confidentialité de GitHub](https://docs.github.com/fr/site-policy/privacy-policies/github-general-privacy-statement)) ;
- **SponsorBlock** (sponsor.ajay.app), par yt-dlp, seulement si vous activez cette option dans la page de réglages *Fichiers et métadonnées*.

Les cookies de votre navigateur ne sont lus, sur votre ordinateur, que si vous activez *Utiliser les cookies du navigateur* (page *Réseau et comptes*), et ne sont envoyés qu'au site de la vidéo téléchargée.

Lasso tient un journal dans `lasso.log`, à côté de l'exécutable (4 Mo environ au plus, avec `lasso.log.1`), pour comprendre une erreur après coup. Il reste sur votre ordinateur : Lasso ne l'envoie nulle part. Il contient les adresses et les titres de ce que vous téléchargez, mais ni votre mot de passe ni vos cookies : relisez-le avant de le partager. Vous pouvez le supprimer à tout moment.

## Notes

- Les réglages sont mémorisés dans `settings.json`, à côté de l'exécutable (le mot de passe n'est jamais enregistré).
- En cas d'erreur "Sign in to confirm you're not a bot" sur YouTube : section Réseau et comptes, sélectionner son navigateur dans "Utiliser les cookies du navigateur".
- Toute option yt-dlp absente de l'interface peut être passée via "Arguments supplémentaires" (section Avancé).

## Avertissement

Cet outil télécharge du contenu depuis des sites tiers. À utiliser dans le respect des conditions d'utilisation de ces sites et des droits des ayants droit (usage personnel, contenus libres de droits ou dont vous détenez les droits).

## Licence et crédits

Lasso est distribué sous licence MIT (voir [LICENSE](LICENSE)).

Au premier lancement, l'application télécharge pour son propre fonctionnement :
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) (licence Unlicense / domaine public)
- [ffmpeg](https://github.com/BtbN/FFmpeg-Builds) (build GPL de BtbN)
- [Deno](https://github.com/denoland/deno) (licence MIT), facultatif, à la demande

L'interface utilise [pywebview](https://github.com/r0x0r/pywebview) (licence BSD), les polices [Inter](https://rsms.me/inter/) et [JetBrains Mono](https://www.jetbrains.com/lp/mono/) (licence SIL Open Font, embarquées dans `ytdlgui/web/fonts/`) des tracés d'icônes [Lucide](https://lucide.dev) (licence ISC) et [hls.js](https://github.com/video-dev/hls.js) (licence Apache 2.0, embarqué dans `ytdlgui/web/vendor/`) pour l'aperçu de l'éditeur de passages. Son style suit le design system Clay d'Open Design.
