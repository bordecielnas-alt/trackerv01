## Ajustements onglet Test

### 1. Retirer la barre de progression à côté des jours
Dans `src/pages/TestPage.tsx`, dans le tracker des 14 jours, supprimer le bloc :
```tsx
<div className="ml-2 flex-1">
  <Progress value={rate14} className="h-1.5" />
</div>
```
Les boutons-jours s'affichent seuls (alignés à gauche, sans barre).

### 2. Calcul de points à partir du premier jour validé
Modifier `computeSeries` : la date de départ devient la plus ancienne clé `completions` **avec valeur `true`** (et non plus la plus ancienne interaction quelle qu'elle soit).

```ts
const keys = Object.keys(habit.completions || {})
  .filter(k => habit.completions[k] === true);
if (keys.length === 0) return { currentS: 0, pointsByDate: {}, totalPoints: 0 };
const startStr = keys.sort()[0];
```

Conséquences :
- Tant qu'aucune case n'est cochée, aucun point n'est calculé et S = 0.
- Dès la première coche, S démarre à 0 ce jour-là puis le rejeu jour-par-jour s'enchaîne jusqu'à aujourd'hui (les jours non cochés entre deux coches restent comptés comme ratés).
- Les coches `false` explicites antérieures à la première `true` sont ignorées.

Aucun autre changement.