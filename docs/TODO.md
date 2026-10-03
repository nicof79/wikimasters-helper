# TODO — Évolutions envisagées

Ce document liste les idées, améliorations et corrections envisagées pour
les prochaines versions de Wikimasters Helper.

Rien n'est engageant : chaque item peut être priorisé, reporté ou
abandonné selon l'usage réel et les retours.

---

## 🔴 Prioritaire

### Compatibilité mobile — dernier reliquat

Le support mobile (badge version déplacé, tap → popup, appui long →
refresh) a été livré en **v1.3.0**. Le chevauchement du badge version sur
Firefox mobile est résolu.

Reste un point à vérifier :

- [ ] **Taille des badges sur écrans très petits** (< 400px de large).
      À observer concrètement :
  - Le badge tient-il dans la largeur de la carte sans déborder ?
  - Le prix reste-t-il lisible (police actuelle en 11px) ?
  - Le badge masque-t-il la zone ATK/DEF de manière gênante ?
  
  Si les 3 points sont OK → retirer ce TODO. Sinon → ajuster padding,
  taille de police ou position.

---

## 🟡 À investiguer / En cours de cadrage

### 📦 Prix à l'ouverture des paquets

**Objectif** : Afficher le prix moyen de **chaque carte obtenue** lors de
l'ouverture d'un paquet, pour savoir immédiatement si on a tiré quelque
chose de valeur.

**Contexte & Précisions** :
- Les cartes s'affichent **une par une** (pas toutes d'un coup).
- Pas de prix d'achat (paquets gratuits toutes les 10 min).
- **Périmètre retenu** : Uniquement le prix à côté de chaque carte au fur
  et à mesure qu'elle apparaît. Pas de récapitulatif en fin d'ouverture.
- **Bénéfice secondaire** : Les prix récupérés sont ajoutés au cache et
  seront disponibles plus tard dans la collection ou le marketplace.

**Endpoint identifié** : `/api/packs/open` (POST, payload vide — la
session identifie le joueur).

**Réponse contient** :
- `cards: [...]` : les cartes obtenues avec `id`, `rarity`, `atk`, `def`,
  `wikipedia_title`, `image_url`
- `packs_remaining` : nombre de paquets restants
- `packs_last_regen_at` : timestamp de régénération
- `owned_copies` : exemplaires possédés avec `starred`, `is_shiny`,
  `user_card_tags`

**Implémentation envisagée** :
1. Intercepter la réponse de `/api/packs/open` (le `fetch` est déjà
   intercepté pour détecter les recherches marketplace)
2. Récupérer les `card_id` des cartes obtenues
3. Fetch les prix moyens (depuis le cache ou l'API)
4. Afficher le prix à côté de chaque carte pendant l'animation

**À investiguer** :
- Structure DOM lors de l'animation de révélation (chaque carte apparaît
  séquentiellement ? d'un coup ?)
- Timing : où placer le prix pour ne pas rater la carte ?

### 🎨 Interface — Badge version (refonte)

**Objectif** : remplacer le badge version actuel (texte simple fixé en
bas-gauche) par un badge cliquable inspiré du style du bouton Wikibidou
du site.

**Spécifications finales** :
- **Position** : haut-gauche, centré dans la colonne sur PC ; haut-gauche
  sur mobile (comportement déjà en place depuis v1.3.0)
- **Style** : inspiré du bouton Wikibidou (`bg: var(--color-surface)/90`,
  `text: var(--color-accent)`, arrondi, padding compact `px-2 py-1`,
  police `text-xs font-semibold`)
- **Contenu** : `WMH - vX.Y.Z` (texte simple, sans icône)
- **Interaction** : au clic → ouvre une modale "What's new"

**À implémenter** : parsing du `CHANGELOG.md` depuis
`raw.githubusercontent.com` pour afficher les 3 dernières versions dans la
modale.

### 🃏 Interface — Overlay au survol & historique enrichi

**Objectif** : remplacer le tooltip natif actuel par un overlay enrichi
qui recouvre la carte.

**Contenu retenu** :
- Prix moyen et sa fraîcheur
- Date du dernier rafraîchissement
- Tendances 24h et 7j
- **Les 7 derniers prix enregistrés** dans l'historique (avec date)
- Comparaison avec la mise (sur marketplace)

**Design à concevoir** :
- Sur PC : overlay au survol, type "recto de carte" avec fond coloré
- Sur mobile : enrichir le popup tactile existant

**Contraintes** : conflits avec le clic sur la carte, performance sur une
grille de 50 cartes, lisibilité.

### 📊 Statistiques de collection (simplifié via API)

**Objectif** : afficher des statistiques sur la collection personnelle.

**Endpoint identifié** : `/api/my-collection/stats?sort=rarity` fournit
**déjà côté serveur** :
- Nombre total de cartes
- Répartition par rareté (`rarityCounts`)
- Répartition par tag (`tagOptions` avec `cardCount`)

**Note** : les paramètres `sort=category` et `sort=tag` renvoient les
mêmes données. Pas de répartition par catégorie côté serveur.

**À calculer nous-mêmes** (avec les prix du cache) :
- Valeur totale de la collection
- Top des cartes les plus chères
- Nombre de doublons (via `/api/my-collection` complet)

**Attention** : la collection fait actuellement **3734 cartes**. Le calcul
de la valeur totale nécessite les prix de toutes les cartes → le cache
met du temps à se remplir. Prévoir un affichage progressif.

**À trancher** :
- Emplacement (panneau bas de page, modale via le badge version, page
  dédiée ?)

### 🎨 Interface — Badges & Halos (petits raffinements)

- [ ] **Uniformiser la position des badges** entre la collection et le
      marketplace. (Centré au-dessus d'ATK/DEF sur la collection, mais
      sous la carte sur le marketplace liste. Objectif : cohérence
      visuelle).
- [ ] **Distinguer visuellement "prix très vieux" et "pas de ventes"** :
  - Prix > 24h : fond bordeaux `#551a3b`
  - Pas de ventes : gris neutre conservé
  - Erreur : fond sombre avec contour rouge marqué
- [ ] **Indicateur visuel discret de l'état du rate limit** dans la page
      (type voyant vert/orange/rouge) pour signaler si le script
      ralentit ses requêtes.
- [ ] **Halo multicolore pour les cartes multi-tag**. Aujourd'hui, seul
      le premier tag est utilisé. Proposition principale : un halo en
      `conic-gradient` avec toutes les couleurs de tag réparties.
      Solution de repli : animation de rotation cyclique.

### 🏷️ Marketplace — Comparateur

- [ ] **Bouton "Utiliser suggestion : moyenne -10 %"** côté vendeur. Au
      lieu de pré-remplir le champ (risque de validation accidentelle),
      afficher un bouton cliquable qui insère la valeur suggérée.

---

## 🟢 Plus tard (Roadmap secondaire)

### 🔍 Raccourcis de recherche

**Objectif** : Enregistrer des recherches favorites sur le marketplace et
les relancer en un clic (ex: bouton "Deux-Sèvres").

- **Emplacement envisagé** : Panneau flottant *(à rediscuter lors de la
  réalisation)*.
- **Périmètre par étapes** :
  1. Mots-clés uniquement.
  2. Filtres plus complexes par la suite (rareté, fourchette de prix, etc.).
- **À trancher** : Interface de création/suppression, persistance
  (stockage local), nombre max de raccourcis.

### 📈 Infos joueur & succès

**Endpoints identifiés** :
- `/api/profile/{username}` → infos basiques (pas de niveau ni stats)
- `/api/achievements/check` → POST, pas exploitable en l'état

**Piste** : chercher d'autres endpoints liés au profil pour enrichir
l'interface (niveau, progression, succès débloqués).

---

## 💡 Idées en vrac (À creuser ou abandonner)

- Notification visuelle quand une carte possédée franchit un seuil de
  tendance (ex: +20 % en 24h).
- Comparateur de possession entre joueurs (si l'API le permet).
- Filtres visuels sur la collection selon les paliers de prix.
- Afficher le nombre de paquets restants dans le badge version
  (`/api/packs/open` retourne `packs_remaining` et
  `packs_last_regen_at`).
- Afficher le nombre d'enchères en cours dans le badge version
  (`/api/marketplace/mine` retourne `sellingCount` et
  `maxConcurrentAuctions`).

---

## 🔌 Inventaire des endpoints API découverts

Ces endpoints ont été identifiés par inspection du trafic réseau du site.
Utiles pour de futures fonctionnalités.

| Endpoint | Méthode | Contenu | Exploité ? |
|---|---|---|---|
| `/api/my-collection` | GET | Liste paginée de la collection | ✅ Cache prix |
| `/api/my-collection/stats` | GET | Stats collection (total, par rareté, par tag) | 🟡 À venir |
| `/api/marketplace` | GET | Liste enchères paginée | ✅ |
| `/api/marketplace/{id}` | GET | Détail d'une enchère | ✅ |
| `/api/marketplace/cards/{id}/sales` | GET | Prix moyen d'une carte | ✅ |
| `/api/marketplace/mine` | GET | Mes enchères (`sellingCount`, `maxConcurrentAuctions`) | 🟡 À venir |
| `/api/wikibidous` | GET | Solde (`balance`) | 🔵 Étude |
| `/api/packs/open` | POST | Ouverture paquet (cartes obtenues, paquets restants) | 🟡 À venir |
| `/api/profile/{username}` | GET | Profil public | 🔵 Étude |
| `/api/trades?active=1` | GET | Échanges en cours | 🔵 Étude |
| `/api/notifications` | GET | Notifications | 🔵 Étude |
| `/api/showcase` | GET | Vitrine | 🔵 Étude |
| `/api/cards?wishlist=1` | GET | Wishlist | 🔵 Étude |
| `/api/friends` | GET | Liste d'amis | 🔵 Étude |
| `/api/guilds` | GET | Guilde | 🔵 Étude |
| `/api/battles` | GET | Combats | 🔵 Étude |
| `/api/parties` | GET | Groupes | 🔵 Étude |
| `/api/chat` | GET | Chat | 🔵 Étude |
| `/api/achievements/check` | POST | Succès | ❌ Non exploitable |

**Légende** : ✅ Exploité, 🟡 En cours/à venir, 🔵 Étude, ❌ Non exploitable

---

## 📝 Documentation & Suivi

- [ ] Mettre à jour `README.md` à chaque évolution fonctionnelle.
- [ ] Maintenir `CHANGELOG.md` à jour à chaque version.
- [ ] Tenir à jour la liste de ce TODO.

---

## 📌 Notes techniques

### Endpoint `/api/my-collection/stats?sort=rarity`

```json
{
  "total": 3734,
  "rarityCounts": { "C": 2633, "L": 3, "R": 260, "PC": 706, "SR": 115, "UR": 17 },
  "tagOptions": [
    { "id": "...", "name": "79", "color": "#38bdf8", "cardCount": 47 },
    { "id": "...", "name": "Animal", "color": "#008000", "cardCount": 1 }
  ]
}
```

### Endpoint `/api/packs/open` (POST, payload vide)

```json
{
  "cards": [
    {
      "id": "...",
      "wikipedia_title": "...",
      "rarity": "C",
      "atk": 1884,
      "def": 3691,
      "category": "famille de langues",
      "image_url": null
    }
  ],
  "packs_remaining": 7,
  "packs_last_regen_at": "2026-10-03T14:58:28.285Z",
  "owned_copies": [
    {
      "id": "...",
      "card_id": "...",
      "starred": false,
      "is_shiny": false,
      "user_card_tags": []
    }
  ]
}
```