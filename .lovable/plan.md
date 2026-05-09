## Modifications

### 1. Onglet Inspiration — Corriger les bugs des outils d'édition

Symptômes : la sélection se perd au clic sur un bouton de la barre d'outils, et certaines actions (couleur, surlignage) ne se déclenchent pas correctement.

Causes :
- Les boutons `Button` reçoivent le focus au clic, ce qui supprime la sélection de l'éditeur Tiptap → la commande s'applique à un curseur vide.
- Les `ColorPicker` utilisent `group-hover` (CSS pur), donc le panneau disparaît dès que la souris quitte le bouton, et le clic sur une couleur peut être avalé par la fermeture.

Corrections (`src/components/inspiration/RichEditor.tsx`) :
- Ajouter `onMouseDown={(e) => e.preventDefault()}` sur tous les boutons de la barre (`TBtn`) et sur les pastilles couleur, pour préserver la sélection.
- Remplacer le `ColorPicker` à `group-hover` par un vrai `Popover` shadcn (clic pour ouvrir, clic couleur applique + ferme). Conserver l'icône, la grille de couleurs et le bouton "effacer".
- Ajouter `editor.chain().focus()` systématiquement avant chaque commande (déjà présent partout, vérifier l'ordre).
- S'assurer que le `useEffect` de sync ne réécrit pas le contenu pendant la frappe (déjà dépendant uniquement de `editor`, OK — ajouter une garde supplémentaire si besoin).

### 2. Onglet Calendrier — Édition d'évènements + bouton Synchroniser

#### Backend (`server/index.js`)
Ajouter trois endpoints CalDAV en écriture, basés sur `tsdav` :
- `POST /api/caldav/events` → crée un VEVENT (champs : `title`, `start`, `end`, `allDay`, `location`, `description`, `calendarName?`). Génère un UID, construit l'ICS avec `ICAL.Component`, appelle `client.createCalendarObject`.
- `PUT /api/caldav/events/:uid` → récupère l'objet existant via son `url` (stocké en cache lors du fetch), modifie le VEVENT, appelle `client.updateCalendarObject`.
- `DELETE /api/caldav/events/:uid` → appelle `client.deleteCalendarObject`.

Pour permettre update/delete, enrichir `fetchCaldavEvents` : conserver `etag` et `url` de chaque objet, les renvoyer au client (champs additionnels `_url`, `_etag`, `_calendarUrl`). Stocker une map serveur `uid → { url, etag, calendarUrl }` rafraîchie à chaque fetch, utilisée par PUT/DELETE.

Ajouter `POST /api/caldav/sync` qui vide `caldavCache` et renvoie `{ ok: true }` (le prochain fetch ira directement au serveur CalDAV).

#### Client (`src/lib/caldav-store.ts`)
- Étendre `CaldavEvent` avec champs optionnels `_url`, `_etag`, `_calendarUrl`.
- Ajouter `createEvent(payload)`, `updateEvent(uid, payload)`, `deleteEvent(uid)`, `syncCaldav()`.

#### UI (`src/pages/CalendarPage.tsx`)
- Ajouter un bouton **Synchroniser** (icône `RefreshCw`) dans la barre d'en-tête, à côté de "Aujourd'hui" : appelle `syncCaldav()` puis invalide `queryClient.invalidateQueries(["caldav"])`.
- Ajouter un bouton **Nouvel évènement** (icône `Plus`) qui ouvre un `Dialog` avec formulaire (titre, date/heure début et fin, toute la journée, lieu, description).
- Au clic sur un évènement (popover), ajouter deux boutons **Modifier** et **Supprimer**.
  - Modifier : ouvre le même `Dialog` pré-rempli.
  - Supprimer : confirmation puis `deleteEvent`.
- Toutes les opérations invalident la query CalDAV.
- Si l'évènement n'a pas `_url` (cache perdu), afficher un message demandant de synchroniser d'abord.

Nouveau composant : `src/components/calendar/EventDialog.tsx` (formulaire création/édition).

### 3. Onglet To Do — "À planifier" masqué par défaut

Dans `src/pages/TodoPage.tsx` :
- Renommer la logique : remplacer le seul `hideDone` par deux états distincts `hideDone` (true par défaut, déjà le cas) et `hidePlanned` (true par défaut, **nouveau**).
- Filtrer le rendu des zones pour masquer "planned" quand `hidePlanned` est true (même mécanisme que "done").
- Le bouton existant "Masquer/Afficher terminées" est dupliqué en un second bouton du même style juste à côté : **"Masquer/Afficher à planifier"** (icônes `Eye`/`EyeOff`), pilotant `hidePlanned`.
- Aucun changement sur le graphique (déjà restreint à persistent + inprogress).
- Aucun changement sur l'ajout/déplacement d'une tâche dans "À planifier" : si l'utilisateur déplace une tâche vers cette zone alors qu'elle est masquée, on auto-démasque (`setHidePlanned(false)`) pour éviter la confusion.

## Fichiers concernés

- `src/components/inspiration/RichEditor.tsx` — fix sélection + ColorPicker en Popover.
- `server/index.js` — POST/PUT/DELETE évènements + endpoint sync + cache uid→url/etag.
- `src/lib/caldav-store.ts` — helpers create/update/delete/sync, types étendus.
- `src/pages/CalendarPage.tsx` — boutons Sync, Nouveau, Modifier, Supprimer dans le popover.
- `src/components/calendar/EventDialog.tsx` — **nouveau** formulaire.
- `src/pages/TodoPage.tsx` — état `hidePlanned`, second bouton, filtre de zone, auto-démasquage.

## Notes

- Aucune modification du score, du drag&drop, de la navigation par fenêtre.
- Mémoires à mettre à jour après implémentation : `features/calendrier` (CRUD + sync), `features/gestion-taches-todo` (visibilité "À planifier"), `features/inspiration` (correctifs toolbar).
