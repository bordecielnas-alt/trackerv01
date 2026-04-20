
## Modifications

### 1. Onglet To Do — Filtre du graphique

Restreindre `chartGroups` aux tâches **persistantes** + **en cours** uniquement (exclure "À planifier" et "Terminée"), affichées dans cet ordre. Conserver l'ordre interne des sous-tâches tel que défini par l'utilisateur. Une sous-tâche apparaît dès qu'elle existe (ne plus filtrer sur "a un score dans la fenêtre") pour rester visible même quand on navigue dans le futur.

```ts
const ZONE_ORDER = ["persistent", "inprogress"];
const chartTasks = ZONE_ORDER.flatMap(z => tasks.filter(t => t.zone === z));
// pour chaque task: garder TOUTES les subtasks dans leur ordre
```

### 2. Onglet To Do — Alignement parfait graphique ↔ tableau

Le décalage actuel vient de :
- Le tableau utilise `min-w-[40px]` (peut grandir) tandis que le graphique utilise `width: 40` strict.
- Les libellés du tableau ont `min-w-[180px]` mais le graphique fixe `width: 180`.
- Le graphique a `pr-2` sur la colonne libellés, et `px-1` sur les en-têtes de dates → ces paddings décalent les barres par rapport aux cellules du tableau.
- Les barres de séparation sont rendues à des points différents (entre groupes seulement).

**Correctifs :**
- Tableau : remplacer `min-w-[40px]` par `style={{ width: COL_WIDTH }}` strict sur les `<th>` et `<td>` de dates ; idem pour la colonne sticky avec `width: STICKY_COL_WIDTH` au lieu de `min-w-[180px]`.
- Graphique : retirer `pr-2` sur la colonne libellés, retirer `px-1` sur les en-têtes de dates (centrer via flex/text-align uniquement) afin que chaque colonne fasse exactement `COL_WIDTH` px alignés sur le tableau.
- Séparateurs entre tâches dans le graphique : faire courir une **seule ligne continue** sur toute la largeur (libellés + grille) en utilisant un wrapper flex avec un `<div className="h-px bg-border w-full" />` qui couvre `STICKY_COL_WIDTH + dates.length * COL_WIDTH`. Synchroniser via la même `Fragment` mais structurellement placer la barre **en dehors** des deux colonnes parallèles, comme une rangée flex-row complète.

**Restructure du graphique** (clé) : passer d'un layout "2 colonnes parallèles" à un layout "lignes successives", chaque ligne étant `[libellé fixe-width][cellule date × N]`. Cela garantit l'alignement vertical strict et permet une vraie barre de séparation continue.

```text
┌─ header ──────────────────────┐
│ [180px label vide] [date][date]…│  ← row, COL_WIDTH chacune
├───────────────────────────────┤
│ [TaskName bold]   │ (vide)    │  ← row titre tâche
│ [  subtask 1  ]   │ [bar][bar]│  ← row sous-tâche
│ [  subtask 2  ]   │ [bar][bar]│
├──── h-px bg-border ───────────┤  ← séparateur full-width
│ [TaskName 2]      │           │
│ …                              │
```

### 3. Onglet Admin — Personnalisation des couleurs de fond

Ajouter une section **"Apparence"** dans `AdminPage.tsx` :
- Un sélecteur avec une **palette large** (~30 teintes) pour choisir la couleur de fond principale (`--background`).
- Bonus : possibilité de choisir aussi la couleur de la **carte** (`--card`) et de la **sidebar** (`--sidebar-background`) — ou un seul choix qui dérive automatiquement (background + variantes plus sombres/claires).

**Approche technique :**
- Nouveau module `src/lib/theme-store.ts` qui :
  - Persiste le thème côté serveur via `apiGet/apiPut` (catégorie `"theme"`, clé `"app-theme"`).
  - Applique au montage les valeurs HSL en mettant à jour `document.documentElement.style.setProperty('--background', hsl)` etc.
- Hook `useThemeBootstrap()` appelé dans `App.tsx` pour appliquer le thème au démarrage (avant le rendu visible).
- Palette proposée : ~30 couleurs douces (pastels / neutres / colorées) chacune définie en HSL : crème, blanc cassé, gris clair, lavande, menthe, pêche, bleu poudré, sable, rose pâle, vert pomme, etc. + variantes sombres pour les amateurs de dark mode.
- UI dans `AdminPage` : grille de pastilles cliquables, indicateur de sélection, bouton "Réinitialiser au défaut".

Auto-dérivation : pour chaque couleur de fond, on calcule automatiquement `--card`, `--muted`, `--accent`, `--sidebar-background` en ajustant légèrement la luminosité (HSL : ±2-5% L), et `--foreground` est choisi selon le contraste (sombre si fond clair, clair si fond sombre).

## Fichiers modifiés

- `src/pages/TodoPage.tsx` : filtre chartGroups (persistent + inprogress), restructure du layout du graphique, alignement strict des largeurs (tableau et graphique), séparateurs full-width.
- `src/lib/theme-store.ts` : **nouveau**, persistence + application des CSS variables.
- `src/App.tsx` : appel `useThemeBootstrap()` au montage.
- `src/pages/AdminPage.tsx` : nouvelle section "Apparence" avec palette de couleurs.

## Notes

- Aucune modification de la logique de score, drag & drop, navigation par fenêtre.
- Le thème est partagé entre tous les utilisateurs (single-user app).
- Les autres onglets héritent automatiquement du nouveau fond via les CSS variables.
