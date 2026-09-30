# TODO — Évolutions envisagées

Ce document liste les idées, améliorations et corrections envisagées pour
les prochaines versions de Wikimasters Helper.

Rien n'est engageant : chaque item peut être priorisé, reporté ou
abandonné selon l'usage réel et les retours.

---

## Interface — Badges

- [ ] **Uniformiser la position des badges** entre la collection et le
      marketplace. Aujourd'hui, le badge est centré au-dessus d'ATK/DEF
      sur la collection, mais placé sous la carte sur le marketplace
      liste. Objectif : cohérence visuelle entre les deux pages.

- [ ] **Distinguer visuellement "prix très vieux" et "pas de ventes"**.
      Actuellement les deux utilisent un fond gris qui peut prêter à
      confusion. Proposition :
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

- [ ] **Reformuler la comparaison acheteur** (fait en v1.2.x dans le
      README, mais l'affichage reste à harmoniser si besoin) :
      - `-1 500` en vert → mise sous la moyenne (bonne affaire)
      - `+300` en rouge → mise au-dessus de la moyenne (plus cher)

- [ ] **Bouton "Utiliser suggestion : moyenne -10 %"** côté vendeur.
      Au lieu de pré-remplir le champ (risque de validation accidentelle),
      afficher un bouton cliquable qui insère la valeur suggérée.

---

## Compatibilité

- [ ] **Firefox mobile + Tampermonkey** : problème d'affichage connu
      du badge de version (position/taille inadaptées sur petit écran).

---

## Documentation

- [ ] Mettre à jour `README.md` à chaque évolution fonctionnelle
- [ ] Maintenir `CHANGELOG.md` à jour à chaque version
- [ ] Tenir à jour la liste ci-dessus

---

## Idées en vrac (à creuser ou abandonner)

- Notification visuelle quand une carte que tu possèdes franchit un
  seuil de tendance (par exemple +20 % en 24h)
- Vue "valeur totale de la collection" (somme des prix moyens × nombre
  d'exemplaires)
- Comparateur de possession entre joueurs (si l'API le permet)
- Filtres visuels sur la collection selon les paliers de prix