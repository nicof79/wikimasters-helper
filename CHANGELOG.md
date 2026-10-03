# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le
versionnage suit [Semantic Versioning](https://semver.org/lang/fr/).

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
  (au lieu de l'absence de badge, qui laissait un doute sur le fonctionnement
  du script)
- Outil console `tools/health-check.js` pour un diagnostic rapide de l'état
  du script (version, cache, badges, halos, erreurs)

### Changed
- `fetchPriceForCard` distingue maintenant trois cas : prix trouvé (number),
  pas de ventes (null), erreur réseau (undefined). Le worker utilise cette
  distinction pour afficher soit le prix, soit un badge neutre, soit rien.

### Fixed
- Les cartes sans ventes enregistrées sur la collection n'ont plus
  l'apparence d'un bug silencieux : elles affichent un badge gris
  identifiable

---

## [1.2.9] — 2026-09-29

### Changed
- **Renommage du projet** : "WikiMasters - Prix & Highlights" → **Wikimasters Helper**
- Métadonnées Tampermonkey harmonisées (`@name`, `@namespace`, `@author`, `@license`, `@updateURL`, `@downloadURL`)
- Badge de version affiché : `Wikimasters Helper • vX.Y.Z`
- Clé de cache renommée : **`wikimasters-helper-cache`**
- Les logs internes utilisent le préfixe `[Wikimasters Helper]`

### Added
- Dossier `tools/` contenant des snippets console (voir `tools/README.md`)
- Fichier `CHANGELOG.md`

### Note
- Une migration manuelle du cache est proposée dans `tools/cache-migration.js`
  pour les utilisateurs qui passent de la v1.2.7 à la v1.2.9.

---

## [1.2.8] — 2026-09-28

### Added
- Migration automatique du cache depuis l'ancienne clé (retirée en 1.2.9
  au profit d'une migration manuelle)

### Changed
- Renommage interne du badge de version

### Removed
- Aucun

---

## [1.2.7] — 2026-09-28

### Removed
- `console.log` résiduel dans le handler `contextmenu` des badges marketplace.
  Les autres logs (`console.warn` sur erreurs, `console.log` sur init/route)
  sont conservés pour faciliter le debug.

---

## [1.2.6] — 2026-09-28

### Added
- Flash visuel sur les badges marketplace lors d'un refresh manuel
  (vert = prix trouvé, jaune = pas de ventes, rouge = erreur)
- Mémorisation et affichage de la date du dernier essai infructueux dans le
  tooltip des badges "aucune vente"

### Changed
- Le refresh manuel garantit 400 ms de visibilité minimum

---

## [1.2.5] — 2026-09-28

### Added
- Clic droit sur les badges marketplace pour forcer le rafraîchissement du prix
- Badge neutre (`? —`) affiché pour les enchères sans ventes enregistrées
- Tooltip enrichi pour les badges sans ventes

### Changed
- Renommage de `showMarketplaceListBadge` → `renderMarketplaceListBadge`

---

## [1.2.4] — 2026-09-28

### Fixed
- **Bug critique** : lors d'une recherche marketplace, l'historique persistant
  de `performance.getEntriesByType()` faisait que la page générale se croyait
  encore filtrée par l'ancienne recherche → aucun badge ne s'affichait au
  retour sur la liste générale.

### Changed
- Détection de la recherche marketplace via interception de `window.fetch`
  au lieu de la lecture des entrées Performance

---

## [1.2.3] — 2026-09-28

### Added
- Détection des recherches sur `/marketplace` (paramètre `q` dans l'API)
- Re-déclenchement automatique du traitement quand la recherche change

### Known Issues
- Bug de l'historique persistant corrigé en 1.2.4

---

## [1.2.2] — 2026-09-28

### Changed
- Badge marketplace aligné sur le style du badge collection :
  fond coloré par fraîcheur, blur backdrop, texte blanc, symbole de tendance
- La comparaison "sous/au-dessus de la moyenne" est déplacée dans le tooltip

---

## [1.2.1] — 2026-09-28

### Changed
- Badge marketplace réorganisé sur 2 lignes pour plus de lisibilité

---

## [1.2.0] — 2026-09-28

### Added
- **Mode marketplace liste** : badge prix moyen et comparaison mise/moyenne
  sous chaque enchère de `/marketplace`
- Appel batch à `/api/marketplace?page=1&limit=50&sort=recent`
- File d'attente séquentielle avec backoff exponentiel pour les fetch de prix
- Cache partagé entre collection et marketplace

---

## [1.1.0] — 2026-09-28

### Added
- **Indicateur de tendance** dans le badge collection :
  - Symbole coloré (▼▼ ▼ = ▲ ▲▲) selon variation sur 24h
  - Détail des tendances 24h et 7j dans le tooltip
- Historique des prix par carte (max 100 points, un point tous les 6h minimum
  ou à chaque changement de prix)
- Seuils de tendance : ±3 % (stable), 3-10 % (léger), > 10 % (fort)

### Changed
- Badge prix allégé (poids de police 800 → 700)
- Suppression de l'icône Wikibidou colorée à côté de la rareté (redondante
  avec le badge prix)

---

## [1.0.3] — 2026-09-28

### Fixed
- Icône Wikibidou à côté de la rareté : positionnement en absolu sur le root
  (au lieu de `insertAdjacentElement` sur le badge de rareté, qui la faisait
  passer à la ligne)

---

## [1.0.2] — 2026-09-28

### Added
- Badge de version discret en bas à gauche

### Changed
- **API en source primaire** pour les favoris (`card.starred`) et tags
  (`card.tags`) : fini la détection fragile par DOM
- Le fallback DOM reste en secours

---

## [1.0.1] — 2026-09-28

### Fixed
- Liste des raretés corrigée : `['C', 'PC', 'R', 'SR', 'UR', 'L']`
- Badge prix : styles inline (fond coloré + blur + texte blanc) robustes
  contre les règles CSS du site
- Clic droit sur le badge prix fonctionnel (propagation stoppée)
- `refreshPriceInBackground` prend désormais la rareté en compte
- Double incrément de `collectionGeneration` corrigé

### Removed
- Code mort (`fetchAveragePrice`, `detectCardData`, états fantômes)

---

## [1.0.0] — 2026-09-28

### Added
- Version initiale
- Affichage du prix moyen sur les cartes de la collection
- Halos colorés pour favoris (jaune) et tags (couleur du tag)
- Badge de version
- Cache localStorage avec TTL 24h
- File d'attente de requêtes avec gestion du rate-limit
- Détection de la pagination de la collection via API `/my-collection`
- Support du marketplace détail (vue vendeur + acheteur)

---