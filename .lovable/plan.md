## Ajustements onglet Test

### 1. Étendre le tracker à 21 jours
Dans `src/pages/TestPage.tsx` :
- Remplacer `getLastNDays(14)` → `getLastNDays(21)`
- Renommer `last14` → `last21`, `rate14` → `rate21`, `points14` → `points21`
- Mettre à jour les libellés `14j` → `21j` et `Points 14j` → `Points 21j`

(21 jours tient confortablement dans la largeur libérée par le retrait de la barre.)

### 2. Toujours afficher Signal / Routine / Récompense quand on déplie
Retirer la condition `(habit.cue || habit.routine || habit.reward || isEditing)` qui masque le bloc quand les 3 champs sont vides. Le bloc s'affiche systématiquement dès que la carte est dépliée, avec `—` comme placeholder pour les champs vides (comportement déjà en place).