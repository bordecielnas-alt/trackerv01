## Objectif

Créer un nouvel onglet **Test** qui reprend le design et la logique de l'onglet **Habitudes** (création, édition, suppression, tracker 7 jours, statistiques par habitude, couleurs, expand/collapse), mais qui remplace la gamification XP/badges par un **score de dynamique S par habitude** et un **calcul de points déterministe**.

## Fichiers à créer / modifier

### 1. `src/pages/TestPage.tsx` (nouveau)
Copie structurelle de `HabitsPage.tsx` adaptée :

**Type `TestHabit`** — étend la base habitude avec :
- `sMax: number` (défaut +3)
- `sMin: number` (défaut -5)
- `dSPos: number` (défaut +2)
- `dSNeg: number` (défaut -2)
- `completions: Record<string, boolean>` (idem Habits)

**Données persistées** : `{ habits: TestHabit[] }` via `apiGet/apiPut("test-habits", "test-habits-data", …)`. Le backend Express expose déjà un pattern générique `/api/<key>` (cf. `routine`, `habits`), il suffira d'ajouter `test-habits` dans `server/index.js` à côté des autres clés persistées.

**Calcul du score S et des points** — fonction pure `computeSeries(habit)` qui rejoue l'historique de `createdAt` à aujourd'hui :

```text
S = 0
pour chaque jour D entre createdAt et today:
  si completions[D] == true:
    points[D] = 0 + S         // P_base + S (S avant maj)
    pas: en fait on applique la règle stricte
  sinon:
    P_perte = 2 + 2 * max(-S, 0)
    points[D] = -P_perte
  puis maj S:
    si fait: S = min(S + dSPos, sMax)
    sinon  : S = max(S + dSNeg, sMin)
```

Implémentation exacte conforme aux règles fournies :
- Si fait : `points = 0 + S` (S courant avant maj), puis `S = min(S + dSPos, sMax)`
- Si non fait : `P_perte = 2 + 2 * max(-S, 0)`, `points = -P_perte`, puis `S = max(S + dSNeg, sMin)`

Retourne `{ currentS, pointsByDate: Record<string, number>, totalPoints }`.

**UI par habitude** (en plus du tracker 7 jours déjà présent) :
- Badge "S = X" (couleur verte si S>0, rouge si S<0, neutre si 0) à côté du streak
- Badge "Points totaux : N"
- Sur chaque case du tracker 7 jours : afficher le delta de points du jour en très petit sous le check
- Section expanded : afficher S courant + min/max configurés sous forme de barre, et "points 7j / 30j"

**Formulaire d'ajout/édition** : ajout de 4 champs `Input type="number"` côte à côte pour `sMax`, `sMin`, `dSPos`, `dSNeg` avec leurs valeurs par défaut. Édition autorise la modification de ces 4 paramètres (le score sera recalculé à la volée puisque purement dérivé de `completions` + paramètres).

**Barre de gamification globale** : remplacer le bloc XP/Niveau/Badges par :
- Total des points sur l'ensemble des habitudes
- Somme des S courants (dynamique globale)
- Compteur "X/Y faites aujourd'hui" (conservé)
- Meilleur streak (conservé)

Les fonctions utilitaires `uid`, `todayStr`, `getLastNDays`, `getStreak`, `getCompletionRate`, `formatShortDate` sont dupliquées localement (pas de refactor partagé pour limiter le risque).

### 2. `src/App.tsx`
Ajouter `import TestPage from "@/pages/TestPage";` et la route `<Route path="/test" element={<TestPage />} />`.

### 3. `src/components/AppLayout.tsx`
Ajouter une entrée `{ to: "/test", label: "Test", icon: FlaskConical }` dans `navItems`, placée **juste après Habitudes** (position 4). Import de `FlaskConical` depuis `lucide-react`.

### 4. `server/index.js`
Ajouter `test-habits` à la liste des clés JSON persistées dans `/data` (même pattern que `habits`, `routine`, etc.).

### 5. Mémoire
- Mettre à jour `mem://style/navigation-layout` : nouvel ordre Daily → Routine → Habitudes → **Test** → Plan → To Do → Calendrier → Statistiques → Historique → Réglages.
- Créer `mem://features/test-habits-dynamique` décrivant la formule S/points et les paramètres configurables par habitude.

## Détails techniques

- **Recalcul intégral à chaque rendu** : `computeSeries` est appelée pour chaque habitude à chaque render. Coût O(jours × habitudes), négligeable pour un usage personnel.
- **Aucune persistance de S** : S est dérivé, jamais stocké → toute modification rétroactive d'une case du tracker recalcule correctement la suite.
- **Bornes** : `sMax ≥ 0 ≥ sMin` validé côté UI (sinon valeurs par défaut).
- **Tokens design system uniquement** (vert/rouge déjà gérés via classes Tailwind comme dans HabitsPage). Aucune couleur hex inline ajoutée.
- **Aucune modification** de l'onglet Habitudes existant — totalement indépendant.

## Hors scope
- Pas de migration des habitudes existantes vers le nouveau système.
- Pas de graphique d'évolution de S (peut être ajouté plus tard).
- Pas de notifications/badges sur Test.