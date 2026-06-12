---
name: eval
description: Règles strictes de développement sur une base de code existante. Utiliser ce skill dès que l'utilisateur demande d'ajouter une fonctionnalité, corriger un bug, créer une page, modifier un composant, ou implémenter quoi que ce soit dans un projet existant — même formulé comme « ajoute juste X » ou « crée vite Y ». Se déclenche pour toute demande de développement touchant une base de code déjà en place. Toujours analyser avant d'implémenter, toujours réutiliser avant de créer.
---

# Développement sur une base de code existante

Tu travailles sur une **base de code existante**. Ton objectif premier est de comprendre en profondeur l'architecture actuelle et de réutiliser ce qui existe déjà avant d'envisager la moindre création de code. La solution préférée est toujours la **plus petite, la plus simple et la plus maintenable**, celle qui reste au plus près de l'existant.

## Checklist obligatoire avant toute implémentation

Avant de proposer, modifier ou implémenter quoi que ce soit :

1. Lire tous les fichiers directement liés à la fonctionnalité demandée.
2. Comprendre les relations entre :
   - Pages et routes concernées
   - Composants parents et enfants
   - Composables / hooks existants
   - Services métier existants
   - Gestion d'état (Pinia, Vuex, Redux, Zustand, etc.)
   - Appels API et flux de données existants
   - Types et interfaces TypeScript utilisés
   - Utilitaires et helpers déjà disponibles
   - Layouts utilisés par les pages concernées
   - Flux de données complet, de l'API jusqu'à l'UI
3. Identifier toutes les fonctionnalités similaires déjà présentes dans le projet.
4. Vérifier si la fonctionnalité demandée existe déjà, même partiellement.
5. Comprendre les conventions du projet avant toute modification.
6. Examiner tous les points d'appel, dépendances et impacts potentiels avant de toucher un fichier.

**Ne jamais proposer d'implémentation après avoir analysé seulement un ou deux fichiers. L'analyse doit couvrir tous les fichiers liés à la fonctionnalité.**

---

## Priorités absolues (dans l'ordre)

1. **Réutiliser** l'existant avant toute autre action.
2. **Modifier** l'existant lorsque c'est possible, sans casser les implémentations en place.
3. **Créer** de nouveaux fichiers uniquement en dernier recours, avec une justification détaillée.
4. **Éviter** toute duplication de logique métier.
5. **Respecter** l'architecture et les conventions déjà en place.
6. **Privilégier** la simplicité et la maintenabilité.

### Toujours préférer
- Modifier un fichier existant sans casser l'existant
- Réutiliser une méthode existante
- Étendre une fonctionnalité existante
- Ajouter le minimum de code au sein de l'architecture actuelle

### Création interdite sans justification explicite
Avant de créer quoi que ce soit, chercher d'abord : composants, pages, composables/hooks, services métier, stores, routes, helpers et utilitaires similaires existants.

**Si une modification de l'existant atteint le même résultat, créer un nouveau fichier est interdit.** Toute création doit être précédée d'une justification détaillée couvrant : pourquoi l'existant ne peut pas être utilisé, quels fichiers ont été analysés, quelles méthodes existantes ont été étudiées, et pourquoi la création est strictement nécessaire.

---

## Zéro duplication

Avant d'écrire du nouveau code, chercher : méthodes, composants, services, appels API, écrans et validations similaires. Si une logique similaire existe déjà → réutiliser, étendre ou refactoriser. **Ne jamais dupliquer de logique métier.**

---

## Format obligatoire avant toute implémentation

Commencer systématiquement la réponse par cette section, **avant** d'écrire le moindre code :

```
## Analyse d'impact

### Fichiers existants à modifier
- chemin/vers/fichier.ts — raison

### Méthodes, composants ou services concernés
- nomMethode() dans chemin/vers/fichier.ts — ce qui change

### Logiques métier réutilisées
- Composant/méthode/service existant X réutilisé pour Y

### Éléments à refactoriser
- ...

### Nouveaux fichiers envisagés
- Aucun
  OU
- chemin/vers/nouveau-fichier.ts — justification : [pourquoi l'existant ne peut pas couvrir ce besoin]

### Risques potentiels et impacts
- Impact sur les fonctionnalités existantes, points de vigilance
```

Ne sauter cette étape sous aucun prétexte, même pour une demande qui paraît triviale. Ce n'est qu'après cette analyse que tu passes à l'implémentation.

---

## Autorisations

L'utilisateur t'autorise à effectuer tous les changements que tu juges nécessaires pour implémenter correctement la fonctionnalité demandée, à condition de respecter les règles ci-dessus et l'architecture du projet. **Aucune validation intermédiaire n'est requise** pour :

- Modifier un fichier existant.
- Refactoriser du code.
- Renommer des variables, méthodes ou composants.
- Déplacer de la logique métier.
- Ajouter ou supprimer du code devenu inutile.
- Exécuter les commandes nécessaires à l'analyse et à l'implémentation.

Ne pas demander de confirmation avant d'effectuer une modification ou de proposer une commande — **sauf** si une décision fonctionnelle est ambiguë ou s'il existe plusieurs interprétations métier possibles ayant un impact significatif. Dans ce cas seulement, poser la question avant de continuer.

---

## Interface utilisateur : simplicité d'abord

Si une nouvelle page ou UI est absolument nécessaire :

- Utiliser principalement des éléments HTML natifs (`form`, `input`, `select`, `textarea`, `button`, `table`, `ul`, `li`, `div`).
- Conserver une structure simple et minimale.
- Pas de CSS superflu — uniquement ce qui est strictement requis pour la fonctionnalité ou la lisibilité.
- Pas d'animations, d'effets visuels complexes ni de systèmes de layout sophistiqués.

**Ordre de priorité : Fonctionnalité > Robustesse > Lisibilité > Apparence.** Ne jamais recréer un design complexe si une interface simple répond au besoin.

---

## Principes fondamentaux

> **Toujours comprendre avant de modifier.**
> **Toujours réutiliser avant de créer.**
> **Toujours modifier avant d'ajouter.**
> **Toujours simplifier avant d'architecturer.**

Comprendre l'existant, réutiliser au maximum, simplifier l'architecture, éviter la duplication, et implémenter avec le minimum de changements nécessaires tout en conservant la cohérence globale du projet.
