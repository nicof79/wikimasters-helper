# Outils Wikimasters Helper

Ce dossier contient des **snippets console** pour gérer le cache local du
userscript [Wikimasters Helper](../README.md).

Ces scripts **ne sont pas des userscripts**. Ce sont juste des bouts de code
à coller dans la console DevTools du navigateur, à la demande.

---

## Usage

1. Ouvre le jeu : https://www.wiki-masters.com/
2. Ouvre les DevTools : **F12** (ou clic droit → Inspecter)
3. Va dans l'onglet **Console**
4. Copie le contenu d'un des fichiers ci-dessous
5. Colle dans la console
6. Appuie sur **Entrée**

Certains outils demandent une confirmation (`confirm()`). D'autres non.
Lis bien ce qui s'affiche.

---

## Liste des outils

| Fichier | Usage | Fréquence |
|---|---|---|
| `inspect-cache.js` | Affiche des statistiques sur le cache (nombre de cartes, âge, taille, historique) | Debug |
| `export-cache.js` | Télécharge un backup JSON du cache | Backup |
| `import-cache.js` | Restaure un backup JSON exporté précédemment | Restauration |
| `reset-cache.js` | Vide entièrement le cache (prix + historique) | Urgence |
| `clear-trends.js` | Réinitialise uniquement l'historique des tendances (les prix sont conservés) | Debug |
| `cache-migration.js` | One-shot : migration du cache v1.2.7 → v1.2.9 | One-shot |

---

## Détail des outils

### `inspect-cache.js`

Affiche dans la console :

- Nombre de cartes en cache
- Taille totale occupée dans `localStorage`
- Temps restant avant expiration
- Nombre de cartes avec historique et nombre total de points
- Âge moyen / min / max des prix

À utiliser quand tu veux vérifier que le cache fonctionne, ou avant un
export pour savoir ce que tu sauvegardes.

---

### `export-cache.js`

Télécharge un fichier `wikimasters-helper-cache-YYYY-MM-DD.json` contenant
l'intégralité du cache. Utile pour :

- Sauvegarder avant une manipulation risquée
- Transférer ton historique vers un autre navigateur / PC
- Partager un cache de référence avec un autre joueur

---

### `import-cache.js`

Ouvre un sélecteur de fichier pour restaurer un JSON exporté précédemment.
Demande confirmation avant d'écraser un cache existant.

**Important** : après import, **recharge la page** pour que le script prenne
en compte les nouvelles données.

---

### `reset-cache.js`

Supprime complètement la clé `wikimasters-helper-cache` du `localStorage`.
Demande confirmation.

Effets :

- Les prix seront re-fetchés au prochain passage sur la collection/marketplace
- **Tu perds l'historique des tendances** (24h et 7j) — il faudra plusieurs
  jours avant qu'elles réapparaissent

---

### `clear-trends.js`

Réinitialise uniquement l'historique des tendances pour toutes les cartes,
en conservant les prix actuels. Demande confirmation.

Utile si :

- Tu changes les seuils de tendance et veux repartir sur une base propre
- Tu soupçonnes un historique corrompu
- Tu veux tester le comportement du script "à froid" sans perdre les prix

---

### `cache-migration.js`

**One-shot**. Migre le cache de l'ancienne clé `wm-price-helper-v2` vers la
nouvelle clé `wikimasters-helper-cache`.

- Ne sert qu'aux utilisateurs qui passent de la **v1.2.7** à la **v1.2.9**
- Une fois la migration faite, l'ancienne clé est supprimée
- Si tu arrives sur le projet après la v1.2.9, **tu n'en as pas besoin**

---