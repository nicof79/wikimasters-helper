# Contribuer à Wikimasters Helper

Merci de t'intéresser au projet ! Ce document explique comment signaler un
problème, proposer une amélioration, ou contribuer au code.

---

## Signaler un bug

Avant d'ouvrir une issue :

1. **Vérifie que tu utilises la dernière version** du script
   (compare le badge de version en bas à gauche de la page avec la
   [dernière release](https://github.com/nicof79/wikimasters-helper/releases))
2. **Cherche dans les [issues existantes](https://github.com/nicof79/wikimasters-helper/issues)**
   si le problème n'a pas déjà été signalé
3. **Désactive les autres userscripts** pour Wikimasters pour éliminer les
   conflits potentiels

Si le bug persiste, [ouvre une issue](https://github.com/nicof79/wikimasters-helper/issues/new?template=bug_report.yml)
en utilisant le template fourni. Plus tu donnes de détails, plus le
diagnostic sera rapide.

---

## Proposer une fonctionnalité

Les suggestions sont bienvenues. [Ouvre une issue](https://github.com/nicof79/wikimasters-helper/issues/new?template=feature_request.yml)
en décrivant :

- Le **besoin** (quel problème ça résout, quel usage)
- Une **description** de la fonctionnalité souhaitée
- Si possible, une **maquette ou un exemple** visuel

Les propositions qui s'alignent avec la philosophie du projet (aider à la
décision économique, améliorer la lisibilité) seront étudiées en priorité.

---

## Contribuer au code

### 1. Fork et clone

```bash
# Fork le repo sur GitHub, puis :
git clone https://github.com/<ton-pseudo>/wikimasters-helper.git
cd wikimasters-helper
```

### 2. Crée une branche

Nomme ta branche selon le type de changement :

```bash
git checkout -b feat/ma-nouvelle-fonctionnalite
git checkout -b fix/correction-du-bug-xyz
git checkout -b docs/amelioration-readme
```

Préfixes recommandés : `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`.

### 3. Fais tes modifications

- Teste ton code **sur le vrai site** (collection + marketplace, avec et
  sans recherche)
- Vérifie qu'il n'y a **pas de régression** sur les fonctionnalités
  existantes
- Ouvre la console DevTools (F12) et vérifie qu'il n'y a pas d'erreurs

### 4. Commit

Utilise des messages clairs, idéalement suivant
[Conventional Commits](https://www.conventionalcommits.org/fr/) :

```
feat: ajouter un panneau de configuration
fix: corriger le calcul de tendance sur les cartes sans historique
docs: préciser l'usage des outils console
refactor: extraire la logique de tendance dans un module dédié
chore: mettre à jour le changelog pour la v1.3.0
```

### 5. Push et Pull Request

```bash
git push origin feat/ma-nouvelle-fonctionnalite
```

Puis ouvre une Pull Request sur GitHub. Décris :

- **Ce que fait** ta PR
- **Pourquoi** elle est utile
- Les **tests** que tu as effectués
- Les **captures d'écran** si ça touche à l'interface

---

## Style de code

Le script suit une convention simple, cohérente avec le code existant :

- **Indentation** : 2 espaces
- **Points-virgules** : oui
- **Quotes** : apostrophes (`'`) sauf quand nécessaire (backticks pour
  template literals)
- **`const` / `let`** : jamais `var`
- **Fonctions** : arrow functions privilégiées
- **Nommage** :
  - `camelCase` pour variables et fonctions
  - `SCREAMING_SNAKE_CASE` pour les constantes de configuration
  - Préfixe `wm-` pour les classes CSS injectées
- **Commentaires** : en français, utiles mais pas redondants. Préférer un
  commentaire qui explique le *pourquoi* plutôt que le *quoi*.

Il n'y a pas de linter configuré pour le moment. Reste cohérent avec le
style existant.

---

## Environnement de test

Pour tester le script :

1. Installe [Tampermonkey](https://www.tampermonkey.net/)
2. Installe ta version modifiée du script :
   - Méthode simple : ouvre `wikimasters-helper.user.js` dans ton éditeur,
     copie tout le contenu, puis crée un nouveau script dans Tampermonkey
     et colle-le
   - Méthode propre : pointe Tampermonkey vers ton fork via l'URL
     `raw.githubusercontent.com` de ta branche
3. Va sur https://www.wiki-masters.com/
4. Teste sur les pages :
   - `/collection` (badge prix, halos, pagination)
   - `/marketplace` (badge prix, recherche, clic droit)
   - `/marketplace/{id}` (vue acheteur et vendeur)

Pense à vider le cache si tu modifies la structure des données :

```js
// Console DevTools
localStorage.removeItem('wikimasters-helper-cache');
```

---

## Ce qu'il faut éviter

- Modifier la version du script dans ton fork sans raison (laisse le
  mainteneur gérer les versions)
- Envoyer des PR qui mélangent plusieurs changements sans rapport (une PR
  = un sujet)
- Modifier le `CHANGELOG.md` toi-même (le mainteneur s'en charge)
- Casser la compatibilité avec les autres gestionnaires que Tampermonkey
  (Violentmonkey, Greasemonkey)

---

## Licence des contributions

En proposant une Pull Request, tu acceptes que ton code soit publié sous
la même [licence MIT](LICENSE) que le reste du projet.