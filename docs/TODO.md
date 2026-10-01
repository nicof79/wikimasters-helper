# TODO — Évolutions envisagées

Ce document liste les idées, améliorations et corrections envisagées pour
les prochaines versions de Wikimasters Helper.

Rien n'est engageant : chaque item peut être priorisé, reporté ou
abandonné selon l'usage réel et les retours.

---

## 🔴 Prioritaire

### Compatibilité mobile

Le script fonctionne sur mobile, mais plusieurs limitations rendent
l'expérience incomplète :

- **Clic droit inexistant** sur tactile → le refresh manuel et l'accès au
  tooltip sont inaccessibles.
- **Taille des badges** non adaptée aux petits écrans (< 400px de large).
- **Tooltip au survol** impossible sur tactile.

**À trancher avant implémentation :**

- Interaction de remplacement pour le clic droit (appui long ? bouton
  visible ? tap simple ?)
- Adaptation des tailles (badge, police, marges)
- Comportement du tooltip au tap

**Note** : c'est un chantier à faire en un seul bloc pour garantir une
expérience cohérente, pas en rustines.

---

## Interface — Badges

- [ ] **Uniformiser la position des badges** entre la collection et le
      marketplace. Aujourd'hui, le badge est centré au-dessus d'ATK/DEF
      sur la collection, mais placé sous la carte sur le marketplace
      liste. Objectif : cohérence visuelle entre les deux pages.

- [ ] **Distinguer visuellement "prix très vieux" et "pas de ventes"**.
      Proposition :
      - Prix > 24h : fond bordeaux `#551a3b`
      - Pas de ventes : gris neutre conservé
      - Erreur : fond sombre avec contour rouge marqué

- [ ] **Indicateur visuel discret de l'état du rate limit** dans la
      page (type voyant vert/orange/rouge) pour signaler si le script
      ralentit ses requêtes.

---

## Interface — Overlay au survol

- [ ] **Étudier un overlay d'informations au survol d'une carte**.
      Idée : au survol d'une carte (collection ou marketplace), un
      overlay apparaît avec des infos enrichies (description, stats,
      prix moyen, tendance, comparaison). Deux pistes à évaluer :
      - Overlay localisé sur la zone description de la carte
      - Overlay plein format type "recto de carte" avec fond coloré

      Contraintes à prendre en compte : conflits avec le clic sur la
      carte, performance sur une grille de 50 cartes, lisibilité.

---

## Interface — Halos

- [ ] **Halo multicolore pour les cartes multi-tag**. Aujourd'hui, seul
      le premier tag retourné par l'API est utilisé pour la couleur du
      halo. Proposition principale : un halo en `conic-gradient` avec
      toutes les couleurs de tag réparties. Solution de repli :
      animation de rotation cyclique des couleurs.

---

## Marketplace — Comparateur

- [ ] **Bouton "Utiliser suggestion : moyenne -10 %"** côté vendeur.
      Au lieu de pré-remplir le champ (risque de validation accidentelle),
      afficher un bouton cliquable qui insère la valeur suggérée.

---

## Nouvelles fonctionnalités

### Prix à l'ouverture des paquets

**Objectif** : afficher le prix moyen de **chaque carte obtenue** lors de
l'ouverture d'un paquet, pour savoir immédiatement si on a tiré quelque
chose de valeur.

**Périmètre retenu** : uniquement le prix à côté de chaque carte.
Pas de récapitulatif en fin d'ouverture (à reconsidérer plus tard si
besoin).

**Bénéfice secondaire** : les prix récupérés sont ajoutés au cache et
seront disponibles plus tard dans la collection ou le marketplace.

**À investiguer** :

- Structure DOM à l'ouverture d'un paquet — les cartes sont-elles
  détectables avec les mêmes patterns que la collection
  (`svg.lucide-swords`, classes `glow-*`) ?
- Timing : attendre la fin de l'animation de révélation avant d'injecter.

---

### Raccourcis de recherche

**Objectif** : enregistrer des recherches favorites sur le marketplace
et les relancer en un clic. Exemple : un bouton "Deux-Sèvres" qui
remplit le champ de recherche avec `deux-sèvres` et lance la recherche.

**Emplacement retenu** : une nouvelle catégorie dans le **menu de gauche**
du site. Interface dédiée, pas d'injection à côté du champ de recherche.

**Périmètre par étapes** :

1. **Première itération** : raccourcis de **mots-clés uniquement**.
2. **Itérations futures** : filtres plus complexes (rareté, fourchette
   de prix, combinaisons).

**À trancher avant implémentation** :

- Interface de création/suppression des raccourcis (panneau dédié dans
  le menu de gauche ? modale ? autre ?)
- Persistance (stockage local ?)
- Nombre maximum de raccourcis à supporter

---

### Statistiques de collection

**Objectif** : afficher des statistiques sur la collection personnelle.

**Première itération — stats envisagées :**

- Nombre total de cartes
- Nombre de cartes par catégorie/rareté
- Nombre de doublons
- Valeur totale de la collection (somme des prix moyens × occurrences)
- Top des cartes les plus chères

**Itérations futures possibles :**

- Valeur par rareté
- Cartes avec la plus forte tendance positive
- Cartes favorites sous-évaluées
- Évolution de la valeur dans le temps (courbe 7j / 30j)

**À trancher avant implémentation :**

- **Emplacement de l'affichage** : panneau en bas de page collection ?
  bouton ouvrant une modale ? page dédiée ? (pas encore décidé —
  plusieurs pistes à évaluer)
- **Performance** : sur une collection de 500+ cartes, le calcul peut
  être lourd. Prévoir un chargement progressif ou un calcul en
  arrière-plan.

---

## Compatibilité

- [ ] **Firefox mobile + Tampermonkey** : problème d'affichage connu
      du badge de version (position/taille inadaptées sur petit écran) —
      inclus dans le chantier global "Compatibilité mobile" ci-dessus.

---

## Documentation

- [ ] Mettre à jour `README.md` à chaque évolution fonctionnelle
- [ ] Maintenir `CHANGELOG.md` à jour à chaque version
- [ ] Tenir à jour la liste ci-dessus

---

## Idées en vrac (à creuser ou abandonner)

- Notification visuelle quand une carte que tu possèdes franchit un
  seuil de tendance (par exemple +20 % en 24h)
- Comparateur de possession entre joueurs (si l'API le permet)
- Filtres visuels sur la collection selon les paliers de prix