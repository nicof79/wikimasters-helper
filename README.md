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

Un badge interactif s'affiche sous chaque carte de la collection et sous
chaque enchère du marketplace. Il indique le prix moyen, l'ancienneté de
la donnée et la tendance sur 24h.

![Aperçu collection](assets/preview-collection.png)

#### Trois états du badge

Le badge peut prendre trois apparences distinctes selon la situation :

| État | Apparence | Signification |
|---|---|---|
| **Prix trouvé** | Fond coloré + tendance (`▲` `▼` `=` `—`) | Prix moyen connu et fiable |
| **Pas de ventes** | Fond gris neutre + `?` | Aucune vente enregistrée pour cette carte |
| **Erreur** | Fond sombre + contour rouge + `!` | Impossible de récupérer le prix (réseau) |

#### Code couleur selon la fraîcheur

Pour un badge "prix trouvé", la couleur de fond indique l'âge de la
donnée :

| Couleur | Âge de la donnée |
|---|---|
| 🟢 Vert | Moins de 3h |
| 🟡 Jaune | Entre 3h et 6h |
| 🟠 Orange | Entre 6h et 12h |
| 🔴 Rouge | Entre 12h et 24h |
| 🟤 Bordeaux | Plus de 24h |

#### Comparateur marketplace

Sur la page marketplace (liste), le tooltip de chaque badge affiche une
comparaison directe avec la mise en cours : `-1 500` (mise sous la
moyenne, bonne affaire), `+300` (mise au-dessus, plus cher que la
moyenne).

### Mise en valeur visuelle (halos)

Un halo coloré entoure les cartes selon leur statut :

- **Halo jaune** — carte marquée comme favorite
- **Halo coloré** — carte taguée dans une collection, dans la couleur du
  tag

![Aperçu marketplace](assets/preview-market.png)

> **Note** : en cas de multi-tag, la couleur utilisée est actuellement
> celle du **premier tag** retourné par l'API. Une évolution est prévue
> vers un halo multicolore (voir [`docs/TODO.md`](docs/TODO.md)).

### Aide à la décision sur le marché

#### Côté acheteur

Un comparateur affiche en permanence l'écart entre la mise saisie et le
prix moyen. Tape un montant dans le champ de mise : la comparaison se
recalcule instantanément à chaque frappe.

- `-1 500` en **vert** → ta mise est sous la moyenne, tu fais une bonne
  affaire
- `+300` en **rouge** → ta mise est au-dessus de la moyenne, tu payes
  plus cher

#### Côté vendeur

Le prix moyen de la carte est affiché à côté du prix actuel pour t'aider
à fixer ta mise de départ.

### Prix à l'ouverture des paquets

Sur la page d'ouverture de paquets (`/pulls`), chaque carte révélée
affiche son prix moyen. Tu repères d'un coup d'œil les tirages de valeur,
et les prix récupérés alimentent automatiquement le cache pour les
consultations futures.

### Performance et respect du serveur

Le script utilise un **rate limiter à fenêtre glissante** : il ne dépasse
jamais 25 requêtes par minute vers l'API. Les cartes visibles à l'écran
sont traitées en priorité, le reste au fur et à mesure du scroll. Si un
rate limit (403) survient malgré tout, le script bascule automatiquement
en mode ralenti pendant 60 secondes.



### Badge version & nouveautés

En haut à gauche de l'interface, un badge discret `WMH - vX.Y.Z` indique
la version actuelle du script.
Clique dessus pour ouvrir une modale **"Nouveautés"** qui affiche les
3 dernières versions publiées, avec leurs changements respectifs. Le
contenu est lu directement depuis le `CHANGELOG.md` du projet.
Le badge version affiche sur sa deuxième ligne le nombre de
403 et de rate limits rencontrés depuis le début de la session :
`⚠️ R:0 · 403:2`

### Cache et fiabilité données

- **Stockage local** (`localStorage`) pour réduire les requêtes vers
  l'API. Voir [Fonctionnement du cache](#fonctionnement-du-cache).
- **Protection contre le rate limit** : si l'API répond trop souvent
  `403` ou `429`, le script ralentit automatiquement le rythme de ses
  requêtes, puis reprend sa vitesse normale dès que tout va bien. Si
  trop d'erreurs consécutives s'accumulent, il s'arrête complètement
  pour éviter un blocage prolongé côté serveur.
- **Clic droit** (ou appui long sur mobile) sur n'importe quel badge
  pour forcer l'actualisation manuelle.

---

## Installation

1. Installe un gestionnaire de userscripts dans ton navigateur :
   [Tampermonkey](https://www.tampermonkey.net/),
   [Violentmonkey](https://violentmonkey.github.io/) ou
   [Greasemonkey](https://www.greasespot.net/).

2. Clique sur le lien d'installation :

   **➜ [Installer Wikimasters Helper](https://raw.githubusercontent.com/nicof79/wikimasters-helper/main/wikimasters-helper.user.js)**

3. La fenêtre du gestionnaire s'ouvre. Clique sur **Installer**.

4. Rafraîchis la page de Wikimasters.

### Mises à jour

Les mises à jour sont détectées automatiquement par Tampermonkey (toutes
les 24h par défaut). Tu peux forcer une vérification manuelle via le menu
de ton gestionnaire → **Vérifier les mises à jour**.

---

## Utilisation

| Page | Ce que tu vois |
|---|---|
| `/collection` | Badge prix sous chaque carte + halos favoris/tags |
| `/marketplace` | Badge prix sous chaque enchère, avec comparaison dans le tooltip |
| `/marketplace/{id}` | Comparateur live (acheteur) ou prix moyen (vendeur) |
| `/pulls` | Badge prix sur chaque carte révélée pendant l'ouverture |

### Interactions sur PC

- **Survol** d'un badge → tooltip avec prix exact, date du dernier
  rafraîchissement, tendances 24h et 7j.
- **Clic droit** sur un badge → force l'actualisation du prix.
- **Clic gauche** ailleurs sur la carte → comportement natif du jeu
  (ouverture de la carte).
- **Clic sur le badge version** (haut-gauche) → ouvre la modale
  "Nouveautés".

### Interactions sur mobile

Le script détecte automatiquement les petits écrans (moins de 768px de
large) et adapte son comportement.

- **Tap** sur un badge → ouvre un popup avec le prix, la date, les
  tendances, un bouton **Rafraîchir** et un bouton **✕**.
- **Appui long** (500ms) sur un badge → force l'actualisation directe,
  avec un feedback visuel.
- **Tap ailleurs sur la carte** → comportement natif du jeu (ouverture
  de la carte).
- **Tap sur le badge version** (haut-gauche) → ouvre la modale
  "Nouveautés".

### Interpréter un badge

| Apparence | Signification |
|---|---|
| Symbole `▲`/`▼`/`=`/`—` + prix | Prix moyen connu, fraîcheur selon la couleur de fond |
| `? —` sur fond gris | Aucune vente enregistrée pour cette carte |
| `! —` sur fond sombre | Erreur de récupération (clic droit ou appui long pour réessayer) |

---

## Outils annexes

Le dossier [`tools/`](tools/) contient plusieurs snippets à coller dans la
console DevTools pour gérer le cache (export, import, reset, statistiques,
migration) ainsi qu'un outil de diagnostic. Voir
[`tools/README.md`](tools/README.md).

---

## Compatibilité

| Cible | Statut |
|---|---|
| Firefox PC + Tampermonkey | ✅ Testé |
| Firefox mobile + Tampermonkey | ✅ Testé |
| Chrome / Edge / Brave + Tampermonkey | ⚠️ Compatible (non testé) |
| Firefox + Violentmonkey | ⚠️ Compatible (non testé) |
| Firefox + Greasemonkey | ⚠️ Compatible (non testé) |

---

## Structure du projet

```text
wikimasters-helper/
├── assets/                          # Captures pour la documentation
│   ├── preview-collection.png
│   └── preview-market.png
├── docs/                            # Documentation technique
│   ├── RELEASE.md                   # Workflow de publication
│   └── TODO.md                      # Évolutions envisagées
├── tools/                           # Snippets console
│   ├── cache-migration.js
│   ├── clear-trends.js
│   ├── export-cache.js
│   ├── health-check.js
│   ├── import-cache.js
│   ├── inspect-cache.js
│   ├── reset-cache.js
│   └── README.md
├── .github/
│   └── ISSUE_TEMPLATE/              # Templates d'issues GitHub
├── wikimasters-helper.user.js       # UserScript principal
├── .gitignore
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

---

## Fonctionnement du cache

Le script maintient un cache local dans `localStorage` sous la clé
`wikimasters-helper-cache`. Pour chaque carte croisée, il stocke :

- Le dernier prix moyen connu et son horodatage
- Un historique des prix observés, utilisé pour calculer les tendances

### Mécanique de rafraîchissement

À chaque fois qu'une carte est croisée (sur la collection ou le
marketplace) :

| Âge du cache | Comportement |
|---|---|
| Moins de 6h | Le prix du cache est utilisé. Aucun appel réseau. |
| Entre 6h et 24h | Le prix du cache est affiché instantanément, puis un rafraîchissement silencieux est lancé en arrière-plan. |
| Plus de 24h | Le prix est considéré comme trop vieux pour être fiable. Un appel réseau complet est fait en bloquant. |

### Historique des variations

Pour chaque carte, le script enregistre **un point d'historique** : le
prix moyen observé à un instant T. Un nouveau point n'est ajouté que si
le prix a changé **ou** si plus de 6h se sont écoulées depuis le dernier
point. Le but : ne pas saturer l'historique avec des valeurs identiques
prises à quelques minutes d'intervalle.

Chaque carte conserve au maximum **100 points**, ce qui correspond à
plusieurs semaines de suivi pour une carte active, ou à quelques jours
pour une carte très volatile. Au-delà, les points les plus anciens sont
supprimés en premier.

### À retenir

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

Voir [`CHANGELOG.md`](CHANGELOG.md) pour l'historique des versions, et
[`docs/RELEASE.md`](docs/RELEASE.md) pour le workflow de publication.
Les évolutions envisagées sont listées dans
[`docs/TODO.md`](docs/TODO.md).

---

## Licence

Distribué sous licence [MIT](LICENSE).

---

## Remerciements

Ce script s'inspire de deux userscripts existants pour Wikimasters :

- *WikiMasters - Affichage des prix moyens (KKH)*
- *WikiMasters, Instant Price Check*

Certaines idées et techniques d'injection (React Fiber, halos, file
d'attente de requêtes) en sont directement inspirées et adaptées.