# Wikimasters Helper

> UserScript Tampermonkey qui enrichit l'interface du jeu par navigateur
> [Wikimasters](https://www.wiki-masters.com/) : prix moyens, tendances,
> halos de favoris/tags et aide à la décision sur le marché.

[![GitHub release](https://img.shields.io/github/v/release/nicof79/wikimasters-helper?logo=github&style=plastic&label=Version)](https://github.com/nicof79/wikimasters-helper/releases)
[![Release Date](https://img.shields.io/github/release-date/nicof79/wikimasters-helper?logo=github&style=plastic)](https://github.com/nicof79/wikimasters-helper/releases)
[![Last Commit](https://img.shields.io/github/last-commit/nicof79/wikimasters-helper?logo=github&style=plastic)](https://github.com/nicof79/wikimasters-helper/commits/main)
[![License](https://img.shields.io/github/license/nicof79/wikimasters-helper?logo=github&style=plastic)](https://github.com/nicof79/wikimasters-helper/blob/main/LICENSE)
[![Language](https://img.shields.io/github/languages/top/nicof79/wikimasters-helper?logo=javascript&style=plastic)](https://github.com/nicof79/wikimasters-helper)
[![Issues](https://img.shields.io/github/issues/nicof79/wikimasters-helper?logo=github&style=plastic)](https://github.com/nicof79/wikimasters-helper/issues)

[![Installer Wikimasters Helper](https://img.shields.io/badge/Installer-Tampermonkey-ff6b35?style=for-the-badge&logo=tampermonkey)](https://raw.githubusercontent.com/nicof79/wikimasters-helper/main/wikimasters-helper.user.js)

---

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Outils annexes](#outils-annexes)
- [Compatibilité](#compatibilité)
- [Structure du projet](#structure-du-projet)
- [Fonctionnement du cache](#fonctionnement-du-cache)
- [Développement](#développement)
- [Licence](#licence)
- [Remerciements](#remerciements)

---

## Fonctionnalités

### Prix moyens et tendances

- **Collection** et **Marketplace (liste)** : badge interactif affichant le
  prix moyen de la carte, l'ancienneté de la donnée et la tendance sur
  24h et 7 jours.
- **Marketplace (détail d'une enchère)** :
  - Côté **acheteur** : comparaison en direct entre l'enchère courante et le
    prix moyen (par exemple `+1 500 sous la moyenne`).
  - Côté **vendeur** : affichage du prix moyen pour t'aider à fixer ta mise
    de départ.

### Mise en valeur visuelle (halos)

- **Halo jaune** autour des cartes marquées comme favorites
- **Halo coloré** (couleur du tag) autour des cartes taguées

### Cache et fiabilité

- Stockage local (`localStorage`) pour réduire les requêtes API
- Code couleur des badges selon la fraîcheur des données
- Gestion automatique du rate limit (backoff exponentiel)
- Clic droit sur un badge pour forcer l'actualisation manuelle

---

## Installation

### Prérequis

Installe un gestionnaire de userscripts dans ton navigateur :

- [Tampermonkey](https://www.tampermonkey.net/) (recommandé)
- [Violentmonkey](https://violentmonkey.github.io/)
- [Greasemonkey](https://www.greasespot.net/)

### Installation du script

Clique sur le lien ci-dessous :

**➜ [Installer Wikimasters Helper](https://raw.githubusercontent.com/nicof79/wikimasters-helper/main/wikimasters-helper.user.js)**

La fenêtre de ton gestionnaire s'ouvre. Clique sur **Installer**, puis
rafraîchis la page de Wikimasters.

### Mises à jour

Les mises à jour sont détectées automatiquement par Tampermonkey (toutes
les 24h par défaut). Tu peux forcer une vérification manuelle via le menu
de ton gestionnaire → **Vérifier les mises à jour**.

---

## Utilisation

| Page | Ce que tu vois |
|---|---|
| `/collection` | Badge prix sous chaque carte + halos favoris/tags |
| `/marketplace` | Badge prix sous chaque enchère + comparaison avec la mise |
| `/marketplace/{id}` | Comparateur live (acheteur) ou prix moyen (vendeur) |

**Clic droit** sur un badge → force l'actualisation du prix.

**Survol** d'un badge → tooltip avec prix exact, date du dernier
rafraîchissement, tendances 24h et 7j.

---

## Outils annexes

Le dossier [`tools/`](tools/) contient plusieurs snippets à coller dans la
console DevTools pour gérer le cache (export, import, reset, statistiques,
migration). Voir [`tools/README.md`](tools/README.md).

---

## Compatibilité

### Navigateurs

| Navigateur | Statut |
|---|---|
| Firefox (dernière version) | ✅ Testé |
| Chrome / Edge / Brave | ⚠️ Compatible (non testé) |
| Safari | ⚠️ Compatible (non testé) |

### Gestionnaires de userscripts

| Gestionnaire | Statut |
|---|---|
| Tampermonkey | ✅ Testé |
| Violentmonkey | ⚠️ Compatible (non testé) |
| Greasemonkey | ⚠️ Compatible (non testé) |

---

## Structure du projet

```text
wikimasters-helper/
├── assets/                          # Captures pour la documentation
├── tools/                           # Snippets console (voir tools/README.md)
│   ├── cache-migration.js
│   ├── clear-trends.js
│   ├── export-cache.js
│   ├── import-cache.js
│   ├── inspect-cache.js
│   ├── reset-cache.js
│   └── README.md
├── wikimasters-helper.user.js       # UserScript principal
├── .gitignore
├── CHANGELOG.md
├── LICENSE
└── README.md
```

---

## Fonctionnement du cache

Le script maintient un cache local dans `localStorage` sous la clé
`wikimasters-helper-cache`. Pour chaque carte croisée, il stocke :

- Le dernier prix moyen connu et son horodatage
- Un historique des variations (100 points max par carte, un point tous les
  6h minimum ou à chaque changement de prix)

### Conséquences

- **Vider le cache** = perdre l'historique des tendances (les prix seront
  re-fetchés au prochain passage)
- Le cache n'est **pas synchronisé** entre navigateurs ou comptes
- Pour **sauvegarder / restaurer**, utilise les outils
  [`export-cache.js`](tools/export-cache.js) et
  [`import-cache.js`](tools/import-cache.js)

---

## Développement

Les contributions, signalements de bugs et suggestions sont bienvenus.

- **Signaler un bug ou proposer une amélioration** →
  [ouvrir une issue](https://github.com/nicof79/wikimasters-helper/issues)
- **Contribuer au code** → créer un fork, une branche dédiée, puis une Pull
  Request

Voir [`CHANGELOG.md`](CHANGELOG.md) pour l'historique des versions.

---

## Licence

Distribué sous licence [MIT](LICENSE).

---