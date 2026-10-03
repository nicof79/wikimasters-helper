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
- Pas de prix d'achat (paquets gratuits toutes les 10 min) ; la
  rentabilité globale du paquet n'est pas le focus.
- **Périmètre retenu** : Uniquement le prix à côté de chaque carte au fur
  et à mesure qu'elle apparaît. Pas de récapitulatif en fin d'ouverture.
- **Bénéfice secondaire** : Les prix récupérés sont ajoutés au cache et
  seront disponibles plus tard dans la collection ou le marketplace.

**À investiguer** :
- Structure DOM à l'ouverture d'un paquet — les cartes sont-elles
  détectables avec les mêmes patterns que la collection
  (`svg.lucide-swords`, classes `glow-*`) ?
- Timing : Attendre que chaque carte soit complètement affichée avant
  d'injecter le prix.

### 🎨 Interface — Badges & Halos

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

### 🃏 Interface — Overlay au survol

- [ ] **Étudier un overlay d'informations au survol d'une carte**
      (collection ou marketplace) avec des infos enrichies (description,
      stats, prix moyen, tendance, comparaison). Deux pistes :
  - Overlay localisé sur la zone description de la carte.
  - Overlay plein format type "recto de carte" avec fond coloré.
  - *Contraintes* : conflits avec le clic sur la carte, performance sur
    une grille de 50 cartes, lisibilité.

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

### 📊 Statistiques de collection

**Objectif** : Afficher des statistiques sur la collection personnelle.
*(Statut : à rediscuter plus tard).*

- **Première itération envisagée** : Nombre total, par catégorie/rareté,
  doublons, valeur totale (somme des prix moyens × occurrences), top des
  cartes les plus chères.
- **Itérations futures** : Valeur par rareté, cartes avec forte tendance
  positive, cartes sous-évaluées, évolution de la valeur dans le temps
  (7j / 30j).
- **À trancher** : Emplacement (panneau bas de page, modale, page
  dédiée) et performance (calcul lourd sur 500+ cartes).

---

## 💡 Idées en vrac (À creuser ou abandonner)

- Notification visuelle quand une carte possédée franchit un seuil de
  tendance (ex: +20 % en 24h).
- Comparateur de possession entre joueurs (si l'API le permet).
- Filtres visuels sur la collection selon les paliers de prix.

---

## 📝 Documentation & Suivi

- [ ] Mettre à jour `README.md` à chaque évolution fonctionnelle.
- [ ] Maintenir `CHANGELOG.md` à jour à chaque version.
- [ ] Tenir à jour la liste de ce TODO.