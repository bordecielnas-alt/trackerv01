
## Objectif

Corriger définitivement le décalage entre le tableau des tâches et le graphique dans l’onglet To Do en imposant :
- une largeur de dates strictement identique partout
- une largeur strictement identique pour la colonne titre tâche / sous-tâche
- une structure de rendu identique entre tableau et graphique

## Constat actuel

Le décalage visible vient encore de plusieurs détails dans `src/pages/TodoPage.tsx` :
- le tableau utilise encore `table className="w-full"` : il peut répartir l’espace différemment malgré les largeurs définies
- certaines cellules sticky n’appliquent pas toutes la même largeur fixe
- le graphique ajoute un retrait visuel sur les sous-tâches (`pl-3`) qui ne correspond pas exactement au tableau
- le graphique et le tableau n’utilisent pas encore une structure strictement homogène sur la colonne de gauche

## Modifications prévues

### 1. Verrouiller les largeurs du tableau
Dans le tableau des sous-tâches :
- retirer `w-full`
- passer le `<table>` sur une largeur calculée fixe :
  - `width = STICKY_COL_WIDTH + dates.length * COL_WIDTH`
- conserver `table-fixed` pour empêcher toute redistribution automatique

### 2. Forcer exactement la même largeur sur la colonne gauche
Appliquer `width`, `minWidth` et `maxWidth` avec `STICKY_COL_WIDTH` sur :
- le `<th>` "Sous-tâche"
- chaque `<td>` sticky des sous-tâches
- les lignes de libellés du graphique
- les lignes de titre de tâche dans le graphique

But : la colonne gauche doit avoir exactement la même largeur dans les 2 blocs.

### 3. Forcer exactement la même largeur sur toutes les colonnes de dates
Appliquer `width`, `minWidth` et `maxWidth` avec `COL_WIDTH` sur :
- tous les `<th>` de dates du tableau
- tous les `<td>` de dates du tableau
- tous les en-têtes de dates du graphique
- toutes les cellules du graphique

But : chaque date occupe exactement la même largeur dans les 2 vues.

### 4. Harmoniser le contenu interne de la colonne gauche
Supprimer les différences internes qui créent une impression de décalage :
- remplacer le `pl-3` du graphique par une structure interne similaire au tableau
- utiliser un wrapper interne commun pour les labels de tâche et sous-tâche
- garder l’indentation visuelle via un wrapper enfant, sans modifier la largeur réelle de la cellule

### 5. Vérifier la barre de séparation
La barre entre les tâches sera laissée en pleine largeur calculée à partir des mêmes constantes :
- `STICKY_COL_WIDTH + dates.length * COL_WIDTH`
- positionnée dans la même logique de grille que le reste

## Fichier concerné

- `src/pages/TodoPage.tsx`

## Résultat attendu

- les colonnes de dates du graphique tombent exactement sous les mêmes dates du tableau
- la colonne "titre tâche / sous-tâche" du graphique a exactement la même largeur que la colonne sticky du tableau
- plus aucun décalage visuel entre intitulés, séparateurs et valeurs
