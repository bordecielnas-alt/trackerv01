const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

let tsdav, ICAL;
try { tsdav = require("tsdav"); } catch (e) { console.warn("tsdav not available:", e.message); }
try { ICAL = require("ical.js"); } catch (e) { console.warn("ical.js not available:", e.message); }

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = process.env.DATA_DIR || "/data";

app.use(cors());
app.use(express.json({ limit: "10mb" }));

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const FILES = {
  settings: path.join(DATA_DIR, "settings.json"),
  entries: path.join(DATA_DIR, "entries.json"),
  credentials: path.join(DATA_DIR, "credentials.json"),
  routine: path.join(DATA_DIR, "routine.json"),
  preferences: path.join(DATA_DIR, "preferences.json"),
  todo: path.join(DATA_DIR, "todo.json"),
  habits: path.join(DATA_DIR, "habits.json"),
  testHabits: path.join(DATA_DIR, "test-habits.json"),
  theme: path.join(DATA_DIR, "theme.json"),
  inspiration: path.join(DATA_DIR, "inspiration.json"),
  inspirationTodo: path.join(DATA_DIR, "inspiration-todo.json"),
  caldav: path.join(DATA_DIR, "caldav.json"),
  health: path.join(DATA_DIR, "health.json"),
  healthConfig: path.join(DATA_DIR, "health-config.json"),
  correlation: path.join(DATA_DIR, "correlation.json"),
};

function readJSON(filePath, fallback) {
  try { if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, "utf-8")); }
  catch (e) { console.error(`Error reading ${filePath}:`, e.message); }
  return fallback;
}
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// --- Generic CRUD ---
function crud(url, file, def) {
  app.get(url, (_req, res) => res.json(readJSON(file, def)));
  app.put(url, (req, res) => { writeJSON(file, req.body); res.json({ ok: true }); });
}

crud("/api/settings", FILES.settings, { parameters: [], scoreFormula: "" });
crud("/api/entries", FILES.entries, []);
crud("/api/credentials", FILES.credentials, null);
crud("/api/routine", FILES.routine, []);
crud("/api/preferences", FILES.preferences, {});
crud("/api/todo", FILES.todo, { tasks: [], dates: [] });
crud("/api/habits", FILES.habits, { habits: [], xp: 0, level: 1, badges: [] });
crud("/api/test-habits", FILES.testHabits, { habits: [] });
crud("/api/theme", FILES.theme, null);
crud("/api/inspiration-todo", FILES.inspirationTodo, { items: [] });
crud("/api/health-data", FILES.health, { items: [], notes: {} });
crud("/api/correlation", FILES.correlation, { items: [], scores: {} });

// Health config (Google Health / Fit) - protects secret token on GET
app.get("/api/health-config", (_req, res) => {
  const c = readJSON(FILES.healthConfig, { accessToken: "", refreshToken: "", clientId: "", enabled: false });
  res.json({ enabled: !!c.enabled, clientId: c.clientId || "", hasToken: !!c.accessToken });
});
app.put("/api/health-config", (req, res) => {
  const existing = readJSON(FILES.healthConfig, {});
  const { accessToken, refreshToken, clientId, enabled } = req.body || {};
  writeJSON(FILES.healthConfig, {
    enabled: !!enabled,
    clientId: clientId ?? existing.clientId ?? "",
    accessToken: (accessToken && accessToken.length > 0) ? accessToken : existing.accessToken || "",
    refreshToken: (refreshToken && refreshToken.length > 0) ? refreshToken : existing.refreshToken || "",
  });
  res.json({ ok: true });
});

// Attempt Google Fit sync (best-effort; if token missing/invalid returns error)
app.post("/api/health-sync", async (_req, res) => {
  const c = readJSON(FILES.healthConfig, {});
  if (!c.enabled || !c.accessToken) {
    return res.status(400).json({ error: "Google Health non configuré (renseignez un access token dans Réglages)" });
  }
  try {
    const now = Date.now();
    const start = now - 30 * 86400000;
    const body = {
      aggregateBy: [
        { dataTypeName: "com.google.step_count.delta" },
        { dataTypeName: "com.google.weight.summary" },
        { dataTypeName: "com.google.sleep.segment" },
      ],
      bucketByTime: { durationMillis: 86400000 },
      startTimeMillis: start,
      endTimeMillis: now,
    };
    const r = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
      method: "POST",
      headers: { Authorization: `Bearer ${c.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: `Google Fit ${r.status}: ${t.slice(0, 300)}` });
    }
    const data = await r.json();
    const existing = readJSON(FILES.health, { items: [], notes: {} });
    const byDate = new Map((existing.items || []).map(i => [i.date, i]));
    for (const bucket of data.bucket || []) {
      const date = new Date(Number(bucket.startTimeMillis)).toISOString().slice(0, 10);
      let steps = 0, weight = null, sleep = 0;
      for (const ds of bucket.dataset || []) {
        for (const pt of ds.point || []) {
          for (const v of pt.value || []) {
            if (ds.dataSourceId?.includes("step_count")) steps += v.intVal || 0;
            if (ds.dataSourceId?.includes("weight")) weight = v.fpVal ?? weight;
            if (ds.dataSourceId?.includes("sleep")) sleep += ((Number(pt.endTimeNanos) - Number(pt.startTimeNanos)) / 1e9 / 3600);
          }
        }
      }
      const prev = byDate.get(date) || { date, source: "google" };
      byDate.set(date, { ...prev, steps, weight, sleep: Math.round(sleep * 10) / 10, source: "google" });
    }
    const items = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    writeJSON(FILES.health, { ...existing, items });
    res.json({ ok: true, days: items.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Single entry post for tracking
app.post("/api/entries", (req, res) => {
  const entry = req.body;
  const entries = readJSON(FILES.entries, []);
  const idx = entries.findIndex((e) => e.date === entry.date);
  if (idx >= 0) entries[idx] = entry; else entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  writeJSON(FILES.entries, entries);
  res.json({ ok: true });
});

// --- Inspiration doc ---
app.get("/api/inspiration", (_req, res) => res.json(readJSON(FILES.inspiration, { html: "", updatedAt: null })));
app.put("/api/inspiration", (req, res) => { writeJSON(FILES.inspiration, { ...req.body, updatedAt: new Date().toISOString() }); res.json({ ok: true }); });

// --- CalDAV config ---
const caldavCache = new Map();
function getCaldavConfig() { return readJSON(FILES.caldav, { url: "", username: "", password: "", calendarName: "" }); }
app.get("/api/caldav-config", (_req, res) => {
  const c = getCaldavConfig();
  res.json({ url: c.url || "", username: c.username || "", calendarName: c.calendarName || "", hasPassword: !!c.password });
});
app.put("/api/caldav-config", (req, res) => {
  const existing = getCaldavConfig();
  const { url, username, password, calendarName } = req.body || {};
  writeJSON(FILES.caldav, {
    url: url ?? existing.url, username: username ?? existing.username,
    calendarName: calendarName ?? existing.calendarName,
    password: (password && password.length > 0) ? password : existing.password,
  });
  caldavCache.clear();
  res.json({ ok: true });
});

// --- CalDAV proxy ---
const CACHE_TTL = 60 * 1000;
const eventIndex = new Map(); // uid -> { url, etag, calendarUrl, rawIcs }

function getDavClient() {
  const cfg = getCaldavConfig();
  if (!cfg.url || !cfg.username || !cfg.password) throw new Error("CalDAV non configuré");
  if (!tsdav) throw new Error("CalDAV libraries not installed");
  return {
    cfg,
    client: new tsdav.DAVClient({
      serverUrl: cfg.url,
      credentials: { username: cfg.username, password: cfg.password },
      authMethod: "Basic", defaultAccountType: "caldav",
    }),
  };
}

function isVeventCalendar(c) {
  const comps = c.components || c.supportedCalendarComponentSet || [];
  if (Array.isArray(comps) && comps.length) return comps.map((x) => String(x).toUpperCase()).includes("VEVENT");
  return true;
}

async function getCalendars(client, cfg, { writeOnly = false } = {}) {
  await client.login();
  let calendars = await client.fetchCalendars();
  calendars = calendars.filter(isVeventCalendar);
  if (cfg.calendarName) {
    const filtered = calendars.filter((c) => (c.displayName || "").toLowerCase().includes(cfg.calendarName.toLowerCase()));
    if (filtered.length) calendars = filtered;
    else if (writeOnly) throw new Error(`Calendrier "${cfg.calendarName}" introuvable`);
  }
  return calendars;
}

async function ensureOk(response, action) {
  if (!response) return;
  const responses = Array.isArray(response) ? response : [response];
  for (const r of responses) {
    if (r && typeof r.ok === "boolean" && !r.ok) {
      let body = ""; try { body = (await r.text()).slice(0, 400); } catch {}
      throw new Error(`CalDAV ${action} ${r.status} ${r.statusText || ""}: ${body}`);
    }
    if (r && r.status && r.status >= 400) {
      throw new Error(`CalDAV ${action} ${r.status}: ${r.statusMessage || ""}`);
    }
  }
}

function getXProp(ve, name) {
  try {
    const p = ve.getFirstPropertyValue(name);
    return p ? String(p) : null;
  } catch { return null; }
}

function extractRRule(ve) {
  try {
    const rrule = ve.getFirstPropertyValue("rrule");
    if (!rrule) return null;
    // ICAL.Recur has toJSON returning object
    const obj = typeof rrule.toJSON === "function" ? rrule.toJSON() : rrule;
    const until = obj.until ? (typeof obj.until.toJSDate === "function" ? obj.until.toJSDate().toISOString() : String(obj.until)) : null;
    return {
      freq: obj.freq || null,
      interval: obj.interval || 1,
      until,
      count: obj.count || null,
    };
  } catch { return null; }
}

async function fetchCaldavEvents(from, to) {
  if (!tsdav || !ICAL) throw new Error("CalDAV libraries not installed");
  const { client, cfg } = getDavClient();
  const calendars = await getCalendars(client, cfg);
  const events = [];
  const fromD = new Date(from), toD = new Date(to);
  for (const cal of calendars) {
    let objects;
    try {
      objects = await client.fetchCalendarObjects({ calendar: cal, timeRange: { start: fromD.toISOString(), end: toD.toISOString() } });
    } catch { objects = await client.fetchCalendarObjects({ calendar: cal }); }
    for (const obj of objects) {
      try {
        const jcal = ICAL.parse(obj.data);
        const comp = new ICAL.Component(jcal);
        const vevents = comp.getAllSubcomponents("vevent");
        for (const ve of vevents) {
          const ev = new ICAL.Event(ve);
          if (ev.isRecurrenceException()) continue; // handled by expansion
          const color = getXProp(ve, "color") || getXProp(ve, "x-apple-calendar-color") || null;
          const rrule = extractRRule(ve);
          const base = {
            uid: ev.uid,
            title: ev.summary || "(sans titre)",
            allDay: ev.startDate.isDate,
            location: ev.location || "",
            description: ev.description || "",
            color,
            recurring: !!rrule,
            rrule,
            _url: obj.url, _etag: obj.etag, _calendarUrl: cal.url,
          };
          eventIndex.set(ev.uid, { url: obj.url, etag: obj.etag, calendarUrl: cal.url, rawIcs: obj.data });

          if (rrule) {
            try {
              const iterator = ev.iterator();
              let next, guard = 0;
              const dur = ev.endDate.subtractDate(ev.startDate);
              while ((next = iterator.next()) && guard++ < 500) {
                const s = next.toJSDate();
                if (s > toD) break;
                const e = next.clone(); e.addDuration(dur);
                const ed = e.toJSDate();
                if (ed < fromD) continue;
                events.push({ ...base, start: s.toISOString(), end: ed.toISOString(), occurrence: s.toISOString() });
              }
            } catch {
              const s = ev.startDate.toJSDate(); const e = (ev.endDate || ev.startDate).toJSDate();
              events.push({ ...base, start: s.toISOString(), end: e.toISOString() });
            }
          } else {
            const s = ev.startDate.toJSDate(); const e = (ev.endDate || ev.startDate).toJSDate();
            if (e < fromD || s > toD) continue;
            events.push({ ...base, start: s.toISOString(), end: e.toISOString() });
          }
        }
      } catch { /* skip */ }
    }
  }
  return events;
}

app.get("/api/caldav/events", async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: "from/to required" });
  const key = `${from}|${to}`;
  const cached = caldavCache.get(key);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) return res.json(cached.data);
  try {
    const events = await fetchCaldavEvents(from, to);
    caldavCache.set(key, { ts: Date.now(), data: events });
    res.json(events);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/caldav/sync", async (_req, res) => {
  caldavCache.clear(); eventIndex.clear();
  try {
    const now = new Date();
    const from = new Date(now); from.setDate(from.getDate() - 90);
    const to = new Date(now); to.setDate(to.getDate() + 365);
    await fetchCaldavEvents(from, to);
    res.json({ ok: true, indexed: eventIndex.size });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/caldav/calendars", async (_req, res) => {
  try {
    const { client, cfg } = getDavClient();
    const calendars = await getCalendars(client, cfg);
    res.json(calendars.map((c) => ({ url: c.url, displayName: c.displayName || c.url, color: c.calendarColor || null })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/caldav/test", async (_req, res) => {
  if (!tsdav) return res.status(500).json({ ok: false, error: "tsdav non installé" });
  const cfg = getCaldavConfig();
  if (!cfg.url || !cfg.username || !cfg.password) return res.status(400).json({ ok: false, error: "Config incomplète" });
  try {
    const client = new tsdav.DAVClient({ serverUrl: cfg.url, credentials: { username: cfg.username, password: cfg.password }, authMethod: "Basic", defaultAccountType: "caldav" });
    await client.login();
    const cals = await client.fetchCalendars();
    res.json({ ok: true, calendars: cals.map((c) => c.displayName || c.url) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// --- ICS building ---
function pad2(n) { return String(n).padStart(2, "0"); }
function toIcsDate(date, allDay) {
  const d = new Date(date);
  if (allDay) return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}
function escIcs(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }

function buildRRule(rrule) {
  if (!rrule || !rrule.freq) return null;
  const parts = [`FREQ=${String(rrule.freq).toUpperCase()}`];
  if (rrule.interval && rrule.interval > 1) parts.push(`INTERVAL=${rrule.interval}`);
  if (rrule.until) {
    const d = new Date(rrule.until);
    parts.push(`UNTIL=${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T235959Z`);
  } else if (rrule.count) parts.push(`COUNT=${rrule.count}`);
  return parts.join(";");
}

function buildIcs({ uid, title, start, end, allDay, location, description, color, rrule, exdates, sequence = 0 }) {
  const dtKey = allDay ? "DTSTART;VALUE=DATE" : "DTSTART";
  const dtEndKey = allDay ? "DTEND;VALUE=DATE" : "DTEND";
  const now = toIcsDate(new Date(), false);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "CALSCALE:GREGORIAN", "PRODID:-//Tracker//CalDAV//FR",
    "BEGIN:VEVENT",
    `UID:${uid}`, `DTSTAMP:${now}`, `LAST-MODIFIED:${now}`, `SEQUENCE:${sequence}`,
    `${dtKey}:${toIcsDate(start, allDay)}`,
    `${dtEndKey}:${toIcsDate(end, allDay)}`,
    `SUMMARY:${escIcs(title)}`,
  ];
  if (location) lines.push(`LOCATION:${escIcs(location)}`);
  if (description) lines.push(`DESCRIPTION:${escIcs(description)}`);
  if (color) { lines.push(`COLOR:${escIcs(color)}`); lines.push(`X-APPLE-CALENDAR-COLOR:${escIcs(color)}`); }
  const rr = buildRRule(rrule);
  if (rr) lines.push(`RRULE:${rr}`);
  if (Array.isArray(exdates)) {
    for (const ex of exdates) lines.push(`EXDATE:${toIcsDate(ex, allDay)}`);
  }
  lines.push("END:VEVENT", "END:VCALENDAR", "");
  return lines.join("\r\n");
}

const ICS_HEADERS = { "Content-Type": "text/calendar; charset=utf-8" };
function authHeader(cfg) { const t = Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64"); return { Authorization: `Basic ${t}` }; }
function getResponseEtag(r) {
  if (!r) return null;
  if (typeof r.headers?.get === "function") return r.headers.get("etag");
  if (r.headers && r.headers.etag) return r.headers.etag;
  return null;
}

// Parse existing ICS to extract master vevent fields (for scope=single/series edits)
function parseMaster(rawIcs) {
  if (!rawIcs || !ICAL) return null;
  try {
    const comp = new ICAL.Component(ICAL.parse(rawIcs));
    const vevents = comp.getAllSubcomponents("vevent");
    const master = vevents.find(v => !v.hasProperty("recurrence-id")) || vevents[0];
    if (!master) return null;
    const ev = new ICAL.Event(master);
    const exdates = [];
    for (const p of master.getAllProperties("exdate")) {
      const v = p.getFirstValue();
      if (v?.toJSDate) exdates.push(v.toJSDate().toISOString());
    }
    return {
      uid: ev.uid,
      title: ev.summary || "",
      start: ev.startDate.toJSDate().toISOString(),
      end: (ev.endDate || ev.startDate).toJSDate().toISOString(),
      allDay: ev.startDate.isDate,
      location: ev.location || "",
      description: ev.description || "",
      color: getXProp(master, "color") || getXProp(master, "x-apple-calendar-color") || null,
      rrule: extractRRule(master),
      exdates,
    };
  } catch { return null; }
}

app.post("/api/caldav/events", async (req, res) => {
  try {
    const { client, cfg } = getDavClient();
    const calendars = await getCalendars(client, cfg);
    const target = req.body.calendarUrl ? calendars.find((c) => c.url === req.body.calendarUrl) || calendars[0] : calendars[0];
    if (!target) return res.status(400).json({ error: "Aucun calendrier d'évènements disponible" });
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}@tracker`;
    const ics = buildIcs({ uid, ...req.body, sequence: 0 });
    const filename = `${uid}.ics`;
    const response = await client.createCalendarObject({
      calendar: target, filename, iCalString: ics,
      headers: { ...ICS_HEADERS, ...authHeader(cfg) },
    });
    await ensureOk(response, "create");
    const objectUrl = (response && response.url) || new URL(filename, target.url).toString();
    eventIndex.set(uid, { url: objectUrl, etag: getResponseEtag(response), calendarUrl: target.url, rawIcs: ics });
    caldavCache.clear();
    res.json({ ok: true, uid });
  } catch (e) { console.error("CalDAV create error:", e.message); res.status(500).json({ error: e.message }); }
});

app.put("/api/caldav/events/:uid", async (req, res) => {
  try {
    const scope = req.query.scope === "single" ? "single" : "series";
    const occurrence = req.query.occurrence ? new Date(String(req.query.occurrence)) : null;
    const { client, cfg } = getDavClient();
    await client.login();
    const idx = eventIndex.get(req.params.uid);
    if (!idx) return res.status(404).json({ error: "Évènement introuvable (synchronisez d'abord)" });
    const master = parseMaster(idx.rawIcs);
    const seq = (Date.now() % 1000000);
    let ics;
    if (scope === "single" && master?.rrule && occurrence) {
      // Add EXDATE to master + create standalone one-off event with new times
      const exdates = [...(master.exdates || []), occurrence.toISOString()];
      const masterIcs = buildIcs({ ...master, exdates, sequence: seq });
      const r1 = await client.updateCalendarObject({
        calendarObject: { url: idx.url, etag: idx.etag, data: masterIcs },
        headers: { ...ICS_HEADERS, ...authHeader(cfg) },
      });
      await ensureOk(r1, "update-master");
      // Create standalone
      const calendars = await getCalendars(client, cfg);
      const target = calendars.find(c => c.url === idx.calendarUrl) || calendars[0];
      const newUid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}@tracker`;
      const standalone = buildIcs({ ...req.body, uid: newUid, rrule: null, sequence: 0 });
      const r2 = await client.createCalendarObject({
        calendar: target, filename: `${newUid}.ics`, iCalString: standalone,
        headers: { ...ICS_HEADERS, ...authHeader(cfg) },
      });
      await ensureOk(r2, "create-single");
      eventIndex.set(req.params.uid, { ...idx, rawIcs: masterIcs, etag: getResponseEtag(r1) || idx.etag });
      caldavCache.clear();
      return res.json({ ok: true, uid: newUid });
    }
    // series edit: keep rrule from body (or master), replace times/title
    const ics2 = buildIcs({
      uid: req.params.uid, ...req.body,
      rrule: req.body.rrule ?? master?.rrule ?? null,
      exdates: master?.exdates || [],
      sequence: seq,
    });
    ics = ics2;
    const response = await client.updateCalendarObject({
      calendarObject: { url: idx.url, etag: idx.etag, data: ics },
      headers: { ...ICS_HEADERS, ...authHeader(cfg) },
    });
    await ensureOk(response, "update");
    eventIndex.set(req.params.uid, { ...idx, etag: getResponseEtag(response) || idx.etag, rawIcs: ics });
    caldavCache.clear();
    res.json({ ok: true });
  } catch (e) { console.error("CalDAV update error:", e.message); res.status(500).json({ error: e.message }); }
});

app.delete("/api/caldav/events/:uid", async (req, res) => {
  try {
    const scope = req.query.scope === "single" ? "single" : "series";
    const occurrence = req.query.occurrence ? new Date(String(req.query.occurrence)) : null;
    const { client, cfg } = getDavClient();
    await client.login();
    const idx = eventIndex.get(req.params.uid);
    if (!idx) return res.status(404).json({ error: "Évènement introuvable (synchronisez d'abord)" });
    if (scope === "single" && occurrence) {
      const master = parseMaster(idx.rawIcs);
      if (master?.rrule) {
        const exdates = [...(master.exdates || []), occurrence.toISOString()];
        const masterIcs = buildIcs({ ...master, exdates, sequence: Date.now() % 1000000 });
        const r = await client.updateCalendarObject({
          calendarObject: { url: idx.url, etag: idx.etag, data: masterIcs },
          headers: { ...ICS_HEADERS, ...authHeader(cfg) },
        });
        await ensureOk(r, "exdate");
        eventIndex.set(req.params.uid, { ...idx, rawIcs: masterIcs, etag: getResponseEtag(r) || idx.etag });
        caldavCache.clear();
        return res.json({ ok: true });
      }
    }
    const response = await client.deleteCalendarObject({
      calendarObject: { url: idx.url, etag: idx.etag }, headers: authHeader(cfg),
    });
    await ensureOk(response, "delete");
    eventIndex.delete(req.params.uid);
    caldavCache.clear();
    res.json({ ok: true });
  } catch (e) { console.error("CalDAV delete error:", e.message); res.status(500).json({ error: e.message }); }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Tracker backend listening on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
