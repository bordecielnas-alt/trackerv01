## Modifications

### 1. `src/components/AppLayout.tsx` — navigation
- Retirer l'entrée `Habitudes` (`/habits`, icône `Repeat`).
- Renommer `Test` → `Habits` (route `/test` conservée, icône `FlaskConical` conservée).
- Retirer l'entrée `Historique` (`/edition`, icône `TableProperties`).
- Nettoyer les imports d'icônes inutilisés (`Repeat`, `TableProperties`).

Ordre final du sidebar :
Daily, Routine, Habits, Plan, To Do, Calendrier, Statistiques, Réglages.

### 2. `src/App.tsx` — routes
- Supprimer la route `/habits` et l'import `HabitsPage`.
- Conserver la route `/edition` (toujours accessible via le nouveau bouton) et `/test`.

### 3. `src/pages/TrackingPage.tsx` — bouton Historique
- Ajouter un bouton `Historique` (variant `outline`, icône `TableProperties`) dans la barre d'en-tête à côté des contrôles de date, qui navigue vers `/edition` via `useNavigate` de `react-router-dom`.

### 4. Mémoire
- Mettre à jour `mem://index.md` (Core → nouvel ordre du sidebar) et `mem://style/navigation-layout` pour refléter la nouvelle navigation.

Aucune logique métier modifiée ; les pages `HabitsPage.tsx` et `EditionPage.tsx` restent en place (EditionPage toujours routée, HabitsPage devient orpheline mais non supprimée pour préserver le code).