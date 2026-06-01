## Modifications de l'onglet Test

### Objectif
Retirer toute la notion de **streak** (série de jours consécutifs) car elle n'a pas de sens avec le système dynamique S. Utiliser l'espace gagné pour **étendre la plage de jours affichés**.

### Changements dans `src/pages/TestPage.tsx`

1. **Supprimer la fonction `getStreak`** (lignes ~69-81) et l'import `Flame` inutilisé.

2. **Supprimer la barre de streak dans la stats globale** — retirer le bloc `meilleur streak` (lignes ~274-282) qui contient l'icône `Flame`.

3. **Supprimer le badge streak par habitude** — retirer le bloc affichant `{streak}j` avec icône `Flame` dans l'en-tête de chaque carte (lignes ~403-407).

4. **Étendre le tracker visible par défaut** : `last7` → `last14` (14 jours)
   - Remplacer `getLastNDays(7)` par `getLastNDays(14)`
   - Adapter le rendu du tracker pour 14 jours
   - Mettre à jour l'affichage des points : label **"Points 7j"** → **"Points 14j"**
   - Remplacer le `rate7` par un `rate14`

5. **Étendre la heatmap** : `last30` → `last90` (90 jours)
   - Remplacer `getLastNDays(30)` par `getLastNDays(90)`
   - Adapter le label **"30 derniers jours"** → **"90 derniers jours"**
   - Mettre à jour le label **"Points 30j"** → **"Points 90j"**
   - Remplacer le `rate30` par un `rate90`

6. **Nettoyage** : retirer toute variable `streak`, `rate7`, `rate30` et fonctions dérivées du streak.

### UI après changement
- Barre globale : total points, Σ S, et taux aujourd'hui uniquement (pas de streak).
- En-tête de chaque habitude : S, points total, taux 14j, taux 90j (pas de badge streak).
- Tracker affiché : 14 jours avec points par jour.
- Section étendue : heatmap sur 90 jours, barre S, points 14j / 90j.