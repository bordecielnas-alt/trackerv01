## Objectif

Ajouter deux nouveaux onglets à l'application Tracker :
1. **Inspiration** : un éditeur de texte riche complet (un seul grand document persistant)
2. **Calendrier** : affichage en lecture seule d'un agenda CalDAV configuré dans l'onglet Admin, avec basculement Mois/Semaine/Jour

## 1. Onglet Inspiration

### UI / Édition
- Page plein écran avec un éditeur de texte riche basé sur **Tiptap** (`@tiptap/react`, `@tiptap/starter-kit` + extensions).
- Extensions activées : titres (H1–H3), gras/italique/souligné/barré, listes à puces / numérotées / cases à cocher, citation, code/bloc de code, liens cliquables (ouverture nouvel onglet), images (insertion par URL), tableaux, alignement, couleur de texte et surlignage.
- Barre d'outils sticky en haut avec boutons groupés par catégorie.
- Sauvegarde automatique avec debounce (~800 ms) et indicateur "Enregistré / Modification…".

### Persistance
- Nouveau endpoint serveur `/api/inspiration` (GET/PUT) dans `server/index.js`, fichier `inspiration.json` dans `/data` contenant `{ html: string, updatedAt: string }`.
- Côté client : helper `inspiration-store.ts` utilisant `apiGet` / `apiPut` (avec fallback localStorage existant).

### Navigation
- Ajouter l'entrée dans `AppLayout.tsx` : icône `Lightbulb`, route `/inspiration`.
- Position dans la sidebar : après "Habitudes", avant "Réglages".

## 2. Onglet Calendrier

### Configuration (Admin)
- Nouvelle section "Calendrier (CalDAV)" dans `AdminPage.tsx` avec champs :
  - URL CalDAV
  - Identifiant
  - Mot de passe
  - Nom du calendrier (optionnel, pour filtrage)
  - Bouton "Tester la connexion"
- Persistance via nouveau endpoint `/api/caldav-config` (GET/PUT), fichier `caldav.json` dans `/data`.
- Le mot de passe est stocké côté serveur uniquement et **jamais renvoyé en clair** au client (le GET renvoie un placeholder masqué + booléen `hasPassword`).

### Backend proxy CalDAV
- Nouvelles routes dans `server/index.js` :
  - `POST /api/caldav/test` → tente une connexion et renvoie OK/erreur
  - `GET /api/caldav/events?from=YYYY-MM-DD&to=YYYY-MM-DD` → renvoie la liste d'évènements normalisés `{ uid, title, start, end, allDay, location, description }`
- Utilisation de la librairie **`tsdav`** (client CalDAV moderne) côté Node + **`ical.js`** pour parser les VEVENT.
- Cache mémoire simple (TTL 60 s) pour éviter de retaper le serveur CalDAV à chaque navigation.

### UI Calendrier
- Page `CalendarPage.tsx` avec :
  - En-tête : titre du mois/semaine/jour courant, flèches précédent/suivant, bouton "Aujourd'hui", toggle de vue (Mois / Semaine / Jour).
  - Vue **Mois** : grille 7×6 classique, pastilles d'évènements (max 3 visibles + "X autres"), clic sur une case = ouvre la vue jour.
  - Vue **Semaine** : 7 colonnes, créneaux horaires 0–24 h, blocs d'évènements positionnés.
  - Vue **Jour** : 1 colonne, créneaux horaires détaillés.
  - Clic sur un évènement → popover avec titre, horaire, lieu, description.
- Charge les évènements de la fenêtre visible via React Query (`useQuery` avec clé `[from, to]`).
- Si aucune config CalDAV : message d'invitation à configurer dans Admin avec bouton vers `/admin`.

### Navigation
- Entrée dans `AppLayout.tsx` : icône `CalendarRange`, route `/calendar`.
- Position : après "Routine", avant "To Do".

## 3. Routes & App.tsx
- Ajouter dans `App.tsx` :
  - `<Route path="/inspiration" element={<InspirationPage />} />`
  - `<Route path="/calendar" element={<CalendarPage />} />`

## 4. Dépendances à installer
- Frontend : `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`, `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-cell`, `@tiptap/extension-table-header`, `@tiptap/extension-text-style`, `@tiptap/extension-color`, `@tiptap/extension-highlight`, `@tiptap/extension-underline`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-text-align`.
- Backend : `tsdav`, `ical.js`.

## 5. Fichiers concernés

**Créés**
- `src/pages/InspirationPage.tsx`
- `src/pages/CalendarPage.tsx`
- `src/components/inspiration/RichEditor.tsx` (Tiptap + toolbar)
- `src/components/calendar/MonthView.tsx`, `WeekView.tsx`, `DayView.tsx`, `EventPopover.tsx`
- `src/lib/inspiration-store.ts`
- `src/lib/caldav-store.ts`

**Modifiés**
- `server/index.js` : endpoints inspiration, caldav-config, caldav/test, caldav/events
- `server/package.json` : ajout `tsdav`, `ical.js`
- `src/App.tsx` : routes
- `src/components/AppLayout.tsx` : navItems
- `src/pages/AdminPage.tsx` : section CalDAV

## Notes

- Mémoire mise à jour avec deux nouvelles entrées : `features/inspiration` et `features/calendrier`, plus mise à jour de `style/navigation-layout` pour refléter le nouvel ordre.
- Aucune modification du système de thème, scoring ou tâches existantes.
- Le calendrier reste **lecture seule** ; toute édition future serait un autre lot.
- Les identifiants CalDAV ne transitent qu'au moment du PUT et restent côté serveur.
