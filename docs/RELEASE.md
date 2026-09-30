# Workflow de release

Ce document décrit la procédure à suivre pour publier une nouvelle version
de Wikimasters Helper. À ouvrir avant chaque mise à jour.

---

## 1. Avant de coder

- [ ] Vérifier la version actuelle dans `wikimasters-helper.user.js` (ligne `@version`)
- [ ] Décider du type de bump :
  - **`patch`** (1.2.9 → 1.2.10) — correction de bug, ajustement mineur
  - **`minor`** (1.2.9 → 1.3.0) — nouvelle fonctionnalité compatible
  - **`major`** (1.2.9 → 2.0.0) — changement cassant (rare)

---

## 2. Pendant le développement

- [ ] Coder et **tester sur le site réel** (collection + marketplace)
- [ ] Ouvrir la console DevTools (F12) et vérifier qu'il n'y a pas d'erreurs
- [ ] Si la structure du cache a changé (nouveaux champs, renommage) :
  - [ ] Prévoir une migration manuelle dans `tools/migrations/` **OU**
  - [ ] Assumer la perte du cache et le documenter dans le CHANGELOG
- [ ] Si un nouvel outil console a été ajouté :
  - [ ] Ajouter un en-tête au fichier
  - [ ] Ajouter une ligne dans `tools/README.md`

---

## 3. Avant de commiter

- [ ] **Incrémenter la version** dans `wikimasters-helper.user.js` :
  - `// @version      X.Y.Z`
  - `const VERSION = 'X.Y.Z';`
- [ ] **Mettre à jour `CHANGELOG.md`** (nouvelle entrée en haut) :

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Removed
- ...
```

  Supprimer les sections vides. Garder uniquement celles qui s'appliquent.

- [ ] **Mettre à jour `README.md`** si nécessaire :
  - Nouvelle fonctionnalité → section « Fonctionnalités »
  - Nouveau comportement → section « Utilisation »
  - Nouvel outil console → tableau « Outils annexes »
  - Nouvelle capture → `assets/`

---

## 4. Commit et push

```bash
# Vérifier ce qui a changé
git status
git diff

# Stager les fichiers concernés
git add wikimasters-helper.user.js CHANGELOG.md README.md

# Commit avec un message clair
git commit -m "feat: description courte en français"

# Push
git push origin main
```

### Préfixes de commit

| Préfixe | Usage |
|---|---|
| `feat:` | Nouvelle fonctionnalité |
| `fix:` | Correction de bug |
| `docs:` | Modif README, CHANGELOG, CONTRIBUTING |
| `refactor:` | Réécriture sans changement fonctionnel |
| `chore:` | Tâches annexes (gitignore, config, etc.) |
| `perf:` | Amélioration de performance |

---

## 5. Créer le tag Git

```bash
git tag -a vX.Y.Z -m "Version X.Y.Z"
git push origin vX.Y.Z
```

À ce stade, ton tag existe dans Git, mais **rien n'est encore visible**
sur la page Releases de GitHub.

---

## 6. Créer la release GitHub

> ⚠️ **Sans cette étape, les badges du README restent figés et les
> utilisateurs ne voient pas la nouvelle version. Le tag seul ne suffit pas.**

### Procédure

1. Va sur `https://github.com/nicof79/wikimasters-helper/releases`
2. Clique sur **Draft a new release**
3. Dans **Choose a tag**, sélectionne le tag que tu viens de pousser (`vX.Y.Z`)
4. **Release title** → `vX.Y.Z` (ou un titre court, ex. `v1.3.0 — Panneau de configuration`)
5. **Description** → copie le bloc `[X.Y.Z]` du CHANGELOG
6. **Publish release**

### Cas particulier : plusieurs versions d'un coup

Si tu as enchaîné plusieurs versions sans commiter entre les deux
(ex. tu passes de 1.2.9 à 1.2.11 en une seule session), tu peux avoir
**plusieurs tags sur le même commit**. C'est parfaitement valide.

Dans ce cas :

```bash
# Un seul commit pour tout
git commit -m "feat: ..."
git push origin main

# Plusieurs tags
git tag -a v1.2.10 -m "Version 1.2.10 : ..."
git tag -a v1.2.11 -m "Version 1.2.11 : ..."
git push origin v1.2.10
git push origin v1.2.11
```

Puis **une release par tag**, chacune avec son changelog.

---

## 7. Vérification post-release

- [ ] Le badge **Version** du README affiche la nouvelle version
      (peut prendre quelques minutes à se rafraîchir à cause du cache
      shields.io)
- [ ] Le badge **Release Date** est à jour
- [ ] Le badge **Last Commit** est à jour
- [ ] La page **Releases** du repo liste bien la nouvelle version
- [ ] **Tester l'installation** : ouvrir le lien `raw.githubusercontent.com`
      dans un navigateur, vérifier que Tampermonkey propose bien la mise à jour
- [ ] Si tu as des utilisateurs : les prévenir (Discord, forum, etc.)

---

## Checklist express (à copier-coller à chaque update)

```markdown
### Update v[VERSION]

- [ ] Code modifié et testé sur le site réel
- [ ] Pas d'erreur dans la console
- [ ] `@version` + `const VERSION` incrémentés
- [ ] `CHANGELOG.md` mis à jour
- [ ] `README.md` mis à jour si nécessaire
- [ ] `tools/README.md` mis à jour si nouvel outil
- [ ] Commit avec préfixe conventionnel
- [ ] Push sur `main`
- [ ] Tag `vX.Y.Z` créé et poussé
- [ ] **Release GitHub publiée** (pas juste le tag !)
- [ ] Test de la mise à jour via Tampermonkey
```

---

## Pièges à éviter

| Piège | Conséquence |
|---|---|
| Oublier d'incrémenter `@version` | Tampermonkey ne verra pas de mise à jour |
| Oublier `const VERSION` | Le badge affiche l'ancienne version |
| **Créer le tag sans la release** | Le badge README reste figé, la version n'apparaît pas |
| Renommer la clé de cache sans migration | Les utilisateurs perdent leur historique |
| Modifier le `@name` | Tampermonkey crée un 2ᵉ script au lieu de mettre à jour |
| Pousser un commit cassé sur `main` | Tous les utilisateurs reçoivent le bug en <24h |

---

## Cas particuliers

### Correction urgente d'un bug en production

1. Coder le fix, tester
2. Bump **patch** (ex. 1.2.11 → 1.2.12)
3. CHANGELOG : section `### Fixed` uniquement
4. Commit `fix: ...`
5. Tag + **Release** immédiats
6. Les utilisateurs recevront la MAJ sous 24h

### Fonctionnalité expérimentale

1. Travailler sur une **branche dédiée** (`feat/ma-fonctionnalite`)
2. Faire les tests dessus
3. Quand c'est stable → merge sur `main`
4. Bump + Release comme d'habitude
5. Si ça casse chez des utilisateurs → possibilité de revenir à la version précédente

### Changement de structure du cache

1. Documenter le changement dans le CHANGELOG (`### Changed`)
2. Ajouter un outil de migration dans `tools/migrations/` si nécessaire
3. Mentionner dans le README → section « Fonctionnement du cache »
4. Communiquer sur le changement si des utilisateurs sont concernés

---

## Tester en local avant de pousser

### Méthode simple — éditer dans Tampermonkey

1. Dans Tampermonkey, sur le script installé, **désactiver** « Vérifier les
   mises à jour » et « Mettre à jour automatiquement »
2. Éditer directement dans l'éditeur intégré de Tampermonkey
3. Sauvegarder → le script se recharge à la prochaine navigation
4. Quand une version est stable : la pousser sur GitHub, faire une release,
   puis réinstaller proprement depuis `raw.githubusercontent.com`

### Méthode alternative — deux scripts séparés

- Un script installé depuis `raw.githubusercontent.com` (version stable)
- Un script installé depuis un fichier local (version de dev)
- **Basculer manuellement** l'activation dans Tampermonkey pour éviter les
  conflits (les deux s'exécutent sinon sur la même page)

---

## Récap rapide

```
1. Coder + tester
2. Bump @version + const VERSION
3. Mettre à jour CHANGELOG (+ README si besoin)
4. Commit + push
5. Tag Git + push du tag
6. Créer la RELEASE GitHub (pas juste le tag !)
7. Vérifier que la MAJ est détectée
```

---

## Liens utiles

- [Releases du repo](https://github.com/nicof79/wikimasters-helper/releases)
- [Conventional Commits](https://www.conventionalcommits.org/fr/)
- [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
- [Semantic Versioning](https://semver.org/lang/fr/)