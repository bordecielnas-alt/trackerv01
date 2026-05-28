# Recalcul de S indépendant de `createdAt`

## Changement

Dans `src/pages/TestPage.tsx`, modifier `computeSeries(habit)` pour que le rejeu de $S$ ne dépende plus de `habit.createdAt` mais de l'**historique réel** stocké dans `habit.completions`.

## Nouvelle logique

1. **Déterminer la date de départ** : prendre la plus ancienne date présente dans `Object.keys(habit.completions)` (qu'elle vaille `true` ou `false`). C'est la "première interaction".
   - Si `completions` est vide → pas de rejeu, `currentS = 0`, `totalPoints = 0`, `pointsByDate = {}`.
2. **Initialiser** $S = 0$ à cette date de départ.
3. **Itérer jour par jour** de la date de départ jusqu'à `today` inclus :
   - Si `completions[date] === true` → règle "fait" (points = $S$ courant, puis $S = \min(S + \Delta S_{pos}, S_{max})$).
   - Sinon (valeur `false` **ou** absente) → règle "non fait" ($P_{perte} = 2 + 2 \cdot \max(-S, 0)$, points = $-P_{perte}$, puis $S = \max(S + \Delta S_{neg}, S_{min})$).
4. Retourner `{ currentS, pointsByDate, totalPoints }` comme aujourd'hui.

## Conséquences UI (aucun changement à faire)

- Le tracker 7 jours, la heatmap, les badges $S$ et points consomment déjà `computeSeries`, donc l'affichage se met à jour automatiquement.
- Cocher rétroactivement une case du tracker injecte une entrée dans `completions` et peut donc reculer la date de départ → tout l'historique est rejoué.

## Détails techniques

- Itération via une boucle `Date` locale (utiliser le helper `formatDate` déjà en place pour éviter les soucis de timezone).
- Garde-fou : si la date de départ est postérieure à `today` (cas improbable d'une coche future), borner à `today`.
- `habit.createdAt` reste dans le type mais n'est plus utilisé par `computeSeries` ; on le conserve à titre informatif (pas de migration).

## Hors scope

- Aucun changement au backend ni au format de stockage.
- Aucun changement à l'onglet Habitudes.
- Pas de fenêtre glissante ni de cap sur la longueur de l'historique (négligeable pour usage personnel).
