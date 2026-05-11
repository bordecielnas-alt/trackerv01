# Plan

## 1. Calendrier — Corriger l'erreur 401 sur create/update/delete

**Cause :** Les requêtes de lecture (`fetchCalendarObjects`) fonctionnent car `client.login()` est appelé dans `getCalendars()`. Mais pour les écritures (`createCalendarObject`, `updateCalendarObject`, `deleteCalendarObject`), `getDavClient()` retourne un client neuf qui n'a jamais appelé `login()` et `tsdav` n'attache pas automatiquement l'en-tête `Authorization: Basic` à ces requêtes WebDAV brutes vers Nextcloud → Sabre/DAV répond 401 NotAuthenticated.

**Correctif `server/index.js` :**
- Construire un en-tête `Authorization: Basic <base64(user:pass)>` à partir de la config et le passer **explicitement** dans `headers` de chaque appel d'écriture (`createCalendarObject`, `updateCalendarObject`, `deleteCalendarObject`), en plus du `Content-Type: text/calendar`.
- Pour `update` et `delete`, appeler `getCalendars(client, cfg)` (ou simplement `client.login()`) avant l'opération afin de garantir un état authentifié cohérent.
- Conserver `ensureOk` pour remonter les codes HTTP réels.

## 2. Inspiration — Layout 3 colonnes (1/2 + 1/4 + 1/4)

**`src/pages/InspirationPage.tsx` :**
- Remplacer le conteneur `max-w-5xl` par une grille responsive 12 colonnes :
  - col-span-6 : `RichEditor` existant (inchangé)
  - col-span-3 : nouvelle colonne "À faire"
  - col-span-3 : nouvelle colonne "Terminé"
- Sur petits écrans : empilage vertical.

**Nouveau composant `src/components/inspiration/InspirationTodo.tsx` :**
- Deux listes côte à côte ("À faire" / "Terminé") rendues par la page (ou un sous-composant `TodoColumn` réutilisable).
- "À faire" :
  - Champ input + bouton + (Enter pour ajouter).
  - Pour chaque item : checkbox + libellé éditable inline (clic = édition, blur/Enter = sauvegarde).
  - Cocher → l'item passe dans "Terminé" avec horodatage.
- "Terminé" :
  - Affiche les items terminés (libellé barré).
  - Décocher = retour vers "À faire".
  - Bouton corbeille pour supprimer définitivement.
- Style : cartes (`Card`), couleurs sémantiques, bouton ghost icône `Trash2` / `Check`.

**Persistence — nouveau `src/lib/inspiration-todo-store.ts` :**
- Modèle : `{ items: { id, text, done, createdAt, completedAt? }[] }`.
- Helpers : `loadInspirationTodos()`, `saveInspirationTodos()` via `apiGet`/`apiPut` sur clé `inspiration-todo` (et localStorage fallback comme les autres stores).

**Backend `server/index.js` :**
- Ajouter `inspiration-todo` dans `FILES` et exposer `GET`/`PUT /api/inspiration-todo` (même schéma simple que `todo`/`habits`).

## Fichiers touchés
- `server/index.js` — fix auth CalDAV + endpoint inspiration-todo
- `src/pages/InspirationPage.tsx` — layout 3 colonnes
- `src/components/inspiration/InspirationTodo.tsx` *(nouveau)*
- `src/lib/inspiration-todo-store.ts` *(nouveau)*

## Note déploiement
Les changements `server/index.js` nécessiteront un rebuild/redémarrage du conteneur Docker Unraid.
