## Diagnostic

Les requêtes vers le backend renvoient OK (toast de succès) mais Nextcloud n'enregistre rien. Trois causes probables, toutes côté `server/index.js` :

1. **Réponse CalDAV non validée** — `tsdav` ne lève pas systématiquement d'erreur si Nextcloud renvoie 4xx ; le code actuel ne vérifie pas le statut HTTP du PUT/DELETE WebDAV. Une ICS rejetée passe donc en silence.
2. **Format ICS incomplet pour Nextcloud** — manque `CALSCALE:GREGORIAN`, le `Content-Type: text/calendar; charset=utf-8` n'est pas explicitement passé, et l'absence de TZID sur les évènements non-allDay peut être refusée.
3. **Mauvais calendrier ciblé** — `calendars[0]` est utilisé par défaut. Si plusieurs calendriers existent (ex: "Personnel" + "Anniversaires" + "Contacts" généré par Nextcloud), l'évènement peut atterrir dans un calendrier non-affiché côté Nextcloud Web.

S'ajoute un point ergonomique : pas de choix de calendrier dans le dialogue, et `eventIndex` n'est pas pré-rempli à la création (il faut une re-sync avant de pouvoir éditer un évènement fraîchement créé).

## Modifications

### `server/index.js`

- **Validation stricte des réponses tsdav** : envelopper `createCalendarObject`, `updateCalendarObject`, `deleteCalendarObject` ; lire `response.status` et `response.statusText`, et si `!response.ok`, lire le body et `throw` une erreur explicite contenant le statut + extrait du corps. C'est ce qui remontera enfin la vraie erreur Nextcloud (403 read-only, 412 If-Match, 415 mauvais Content-Type, etc.).
- **ICS conforme Nextcloud** :
  - Ajouter `CALSCALE:GREGORIAN` après `VERSION:2.0`.
  - Forcer le header `Content-Type: text/calendar; charset=utf-8` sur create/update.
  - Ajouter une `SEQUENCE:0` (incrémentée à chaque update) et `LAST-MODIFIED`.
  - Pour les évènements non-allDay : continuer à utiliser UTC (`Z`) — c'est valide et évite les VTIMEZONE.
- **Filtrage des calendriers d'écriture** : ne garder que les calendriers où `cal.components` inclut `VEVENT` (exclut adressbooks/tasks). Si un `calendarName` est configuré, l'utiliser exclusivement (erreur claire si introuvable).
- **Endpoint `GET /api/caldav/calendars`** : retourne `[{ url, displayName, color }]` filtrés VEVENT, pour alimenter un select dans le dialog.
- **Pré-remplir `eventIndex` à la création** : après `createCalendarObject`, faire un `propfind` (ou utiliser la response) pour récupérer `etag` + `url` du nouvel objet, et l'enregistrer dans `eventIndex` immédiatement. Permet l'édition/suppression sans re-sync.
- **Sync vraiment synchronisante** : `/api/caldav/sync` clear le cache **et** exécute un `fetchCaldavEvents` sur ±90 jours pour repeupler `eventIndex`.
- **Logs serveur** : `console.log` du calendrier ciblé (URL + displayName) et du statut HTTP retourné, pour diagnostic Unraid.

### `src/lib/caldav-store.ts`

- Nouvelle fonction `listCalendars()` → `GET /api/caldav/calendars`.
- `EventPayload` accepte déjà `calendarUrl` ; conserver.

### `src/components/calendar/EventDialog.tsx`

- Charger la liste des calendriers via `useQuery(["caldav-calendars"])`.
- Ajouter un `<Select>` "Calendrier" (visible seulement à la création, pas en édition). Pré-sélectionner le premier ou celui du `calendarName` configuré.
- Passer `calendarUrl` dans le payload `onSubmit`.

### `src/pages/CalendarPage.tsx`

- `handleSubmit` : entourer de `try/catch` pour afficher un toast d'erreur si l'API renvoie maintenant un 5xx explicite (sinon le dialog se ferme silencieusement).

## Détails techniques

```text
Flux corrigé create:
  POST /api/caldav/events { title, start, end, allDay, calendarUrl, ... }
    → buildIcs (avec CALSCALE, SEQUENCE:0, LAST-MODIFIED)
    → tsdav.createCalendarObject({ calendar, filename, iCalString,
                                    headers: { 'Content-Type': 'text/calendar; charset=utf-8' } })
    → si response.ok: lire ETag header, eventIndex.set(uid, { url: response.url, etag, calendarUrl })
    → si !response.ok: throw new Error(`CalDAV ${status}: ${bodyText.slice(0,300)}`)
```

## Fichiers concernés

- `server/index.js`
- `src/lib/caldav-store.ts`
- `src/components/calendar/EventDialog.tsx`
- `src/pages/CalendarPage.tsx`

## Résultat attendu

- Création/édition/suppression réellement persistées dans Nextcloud, vérifiables depuis l'UI Nextcloud.
- En cas d'échec CalDAV, un toast rouge avec le vrai code HTTP + extrait du message Nextcloud (fini les faux "OK").
- Choix explicite du calendrier cible à la création.
- Édition possible immédiatement après création, sans re-synchronisation manuelle.
