## Modifications

### 1. `src/components/AppLayout.tsx` — Sidebar
Réorganiser et renommer `navItems` dans cet ordre :
1. Daily (`/`, CalendarDays)
2. Routine (`/routine`, Clock)
3. Habitudes (`/habits`, Repeat)
4. Plan (`/inspiration`, Lightbulb)
5. To Do (`/todo`, ListTodo)
6. Calendrier (`/calendar`, CalendarRange)
7. Statistiques (`/statistics`, BarChart3)
8. Historique (`/edition`, TableProperties)
9. Réglages (`/settings`, Settings)

### 2. `src/pages/SettingsPage.tsx`
Remplacer `defaultValue={["tracking"]}` par `defaultValue={[]}` sur l'`Accordion` → toutes les sections repliées par défaut.

### 3. Renommages des titres affichés (`<h1>`)
- `TrackingPage.tsx` : "Tracking" → "Daily"
- `InspirationPage.tsx` : "Inspiration" → "Plan" (icône conservée)
- `EditionPage.tsx` : "Édition" → "Historique"

Les routes URLs (`/`, `/inspiration`, `/edition`) restent inchangées.

### 4. `src/pages/StatisticsPage.tsx` — Tooltip et grilles

**Tooltip personnalisé** (visibilité dark + commentaire) :
- Créer un composant `CustomTooltip` utilisant les tokens du design system : `bg-popover text-popover-foreground border border-border shadow-lg rounded-md p-3` (au lieu du tooltip Recharts par défaut, blanc dur peu lisible en thème sombre).
- Affiche : la date, chaque série avec un point coloré + nom + valeur, puis le **commentaire** du jour s'il existe, en `text-muted-foreground italic` en bas, séparé par un `border-t`.
- Pour récupérer le commentaire : enrichir chaque ligne de `filteredData` avec `_comment: e.comment` (champ ignoré par les `<Line>`/`<Bar>`).
- Brancher via `<Tooltip content={<CustomTooltip />} />` sur tous les charts (Score + paramètres, line + bar).

**Atténuation des grilles** :
- `CartesianGrid` : remplacer `stroke="hsl(200, 15%, 85%)"` par `stroke="hsl(var(--border))"` avec `strokeOpacity={0.4}` → s'adapte au thème et reste discret.
- Ajouter `vertical={false}` sur tous les `CartesianGrid` pour ne garder que les lignes horizontales (axes secondaires verticaux supprimés visuellement).

Vérification rapide à l'implémentation : confirmer que `getEntriesAsync` renvoie bien le champ `comment` (sinon adapter la lecture).

### 5. Mémoire
Mettre à jour `mem://style/navigation-layout` et l'index avec le nouvel ordre et libellés : Daily, Routine, Habitudes, Plan, To Do, Calendrier, Statistiques, Historique, Réglages.
