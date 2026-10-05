# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le
versionnage suit [Semantic Versioning](https://semver.org/lang/fr/).

---

## [1.5.0] — 2026-10-06

### Added
- **Prix à l'ouverture des paquets** : sur `/pulls`, chaque carte révélée
  affiche son prix moyen, permettant de repérer immédiatement les tirages
  de valeur
- **Rate limiter à fenêtre glissante** : le script respecte désormais un
  quota mesuré de requêtes par minute (60s), au lieu d'un intervalle fixe
  entre les fetchs
- **Mode panique** : si un 403 survient malgré tout, le débit est
  automatiquement réduit pendant 60 secondes
- **Scan viewport-first** : seules les cartes visibles à l'écran sont
  fetchées en priorité. Les autres sont observées et fetchées à l'entrée
  dans le viewport (via IntersectionObserver)
- **Badge de version sur 2 lignes** : affiche le compteur de 403 et de
  rate limits depuis le début de la session
- **Cooldown par carte** : une carte ayant reçu un 403 est mise de côté
  pendant 30 secondes avant nouvel essai
- Préchargement des cartes de paquet en parallèle de l'animation

### Changed
- **Concurrency réduite à 3** (au lieu de 5) : la limite serveur a été
  mesurée et le seuil de sécurité est à 3 requêtes simultanées
- **Traitement par dispatcher** : remplace le worker à délai fixe par un
  dispatcher qui vérifie le quota en permanence (tick 100ms)
- **Cache-first strict** : 0 fetch si les données sont valides
- **Suppression du blocage définitif** : les cartes précédemment marquées
  "permanently blocked" sont réessayées après le cooldown de 30s
- Compteur de 403 et rate limits affiché sur la deuxième ligne du badge
  version

### Fixed
- **Filtre collection** : les badges s'affichent désormais correctement
  quand un filtre de recherche est actif (utilisation du Fiber React
  comme source principale)
- **Boucle de fetch** sur certaines cartes après changement de route
- Cartes marquées "pas de ventes" désormais mises en cache pour éviter
  les fetchs répétés

---

## [1.4.0] — 2026-10-03

### Added
- Badge version cliquable avec modale "What's new" affichant les 3
  dernières versions du changelog
- Nouveau style pour le badge version (discret, sans accent de couleur)

### Changed
- Position du badge version : haut-gauche, aligné avec les boutons
  Wikibidous de droite
- Badge visible en permanence mais discret (opacité réduite au repos)

---

## [1.3.0] — 2026-10-03

### Added
- **Support mobile** : le script s'adapte aux petits écrans (moins de 768px)
- Badge version déplacé en haut-gauche sur mobile (au lieu de bas-gauche)
- **Popup tactile** : tap sur un badge ouvre une modale avec prix, date,
  tendances et bouton "Rafraîchir"
- **Refresh par appui long** (500ms) sur un badge, avec feedback visuel
- Neutralisation de la sélection de texte et du menu contextuel natif sur
  les badges pour une expérience tactile propre

### Changed
- Sur PC, le comportement reste inchangé (survol → tooltip, clic droit →
  rafraîchissement)

---

## [1.2.11] — 2026-09-30

### Added
- Badge d'erreur `! —` (fond rouge) sur les cartes dont le prix n'a pas
  pu être récupéré (erreur réseau, timeout). Distinct du badge `? —` (gris)
  qui signale simplement l'absence de ventes.

### Changed
- `showPriceBadge` prend désormais un paramètre d'état explicite
  (`'ok'` / `'nosales'` / `'error'`) pour gérer les trois cas visuellement
- Le health-check affiche la répartition des badges par état

---

## [1.2.10] — 2026-09-30

### Added
- Badge neutre `? —` sur les cartes de la collection sans ventes enregistrées
- Outil console `tools/health-check.js` pour un diagnostic rapide

### Changed
- `fetchPriceForCard` distingue prix trouvé (number), pas de ventes (null),
  erreur réseau (undefined)