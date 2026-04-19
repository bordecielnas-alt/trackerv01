
## Objectif

Onglet To Do : remplacer la grille de dates fixe (30 jours) par une vue à scroll horizontal **partagée** entre toutes les tâches, centrée par défaut sur la date du jour, et permettant d'aller au-delà des bornes actuelles (passé et futur).

## Approche

**1. Source unique de dates étendue (`generateDates`)**
Étendre la plage à ~365 jours (par ex. 180 jours dans le passé, 184 dans le futur, total 365) pour permettre la consultation des dates futures. La liste reste persistée comme aujourd'hui via `apiPut`.

**2. Scroll horizontal unifié pour toutes les tâches**

Actuellement chaque tâche dépliée a son propre `overflow-x-auto` autour de son `<table>`, donc chaque tâche a son propre ascenseur. Pour avoir **un seul ascenseur partagé** :

- Retirer `overflow-x-auto` de chaque tâche.
- Ajouter un **conteneur de scroll horizontal unique** (ref partagée) qui englobe **toutes les zones et tâches**, juste à l'intérieur du wrapper principal.
- Mais on doit garder la colonne "Sous-tâche" sticky à gauche, ainsi que les en-têtes de zones et de tâches alignés et lisibles.

**Solution choisie** (la plus simple et compatible avec la structure existante) :
- Conserver les `<table>` actuelles avec `sticky left-0` sur la 1re colonne.
- Synchroniser le scroll horizontal de toutes les tables via un **scroll-sync léger** : un `scrollLeft` partagé via `useRef` + un seul `<div>` "scrollbar maître" affiché en haut (sticky top), qui pilote tous les conteneurs de tables.
- Chaque conteneur `overflow-x-auto` de tâche écoute/applique ce scroll partagé (via event listener sur scroll → propagation vers les autres). L'utilisateur ne voit qu'une seule scrollbar utile (celle du maître sticky), les autres restent fonctionnelles mais discrètes (`scrollbar-width: none` sur les enfants pour masquer les ascenseurs natifs).

**3. Centrage automatique sur la date du jour**

Au montage (après `loaded` + dates en place) :
- Calculer la position de la date du jour : `todayIdx * colWidth` (colWidth = 40px = `min-w-[40px]`) + offset de la colonne sticky (180px).
- `scrollLeft = todayCenter - containerWidth / 2`.
- Appliquer ce scrollLeft au container maître, qui se propage à tous les enfants.
- Recentrer également si l'utilisateur ajoute/déplie une nouvelle tâche (optionnel : seulement au premier load pour ne pas perturber le scroll utilisateur).

**4. Indicateur visuel "aujourd'hui"**

Mettre en évidence la colonne du jour (background subtil sur l'en-tête + cellules) pour faciliter le repérage après centrage.

## Fichiers modifiés

- `src/pages/TodoPage.tsx` :
  - `generateDates(365)` au lieu de 30, avec offset 180 jours dans le passé.
  - Ajout d'un `masterScrollRef` + `tableRefs` (Map) + handler `syncScroll`.
  - Ajout d'une scrollbar maître sticky (`<div className="sticky top-0 ...">`) au-dessus de la première zone.
  - Suppression de `overflow-x-auto` individuel ou ajout d'une classe utilitaire `[&::-webkit-scrollbar]:hidden` pour masquer les barres natives par tâche.
  - `useEffect` post-load qui calcule et applique le scroll initial centré sur today.
  - Surlignage visuel de la colonne `today` (vérifier via `dateStr === todayStr`).

## Notes

- L'ajout d'une 2e scrollbar visible (maître + tâches) serait redondant ; on masque les natives sur les enfants.
- La performance reste bonne : 365 colonnes × N sous-tâches = grille DOM raisonnable. Si la perf devient un souci on pourra virtualiser plus tard.
- Aucun changement sur les autres onglets ni sur la logique de score / drag & drop / graphique.
