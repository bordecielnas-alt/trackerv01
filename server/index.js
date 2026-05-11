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

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const FILES = {
  settings: path.join(DATA_DIR, "settings.json"),
  entries: path.join(DATA_DIR, "entries.json"),
  credentials: path.join(DATA_DIR, "credentials.json"),
  routine: path.join(DATA_DIR, "routine.json"),
  preferences: path.join(DATA_DIR, "preferences.json"),
  todo: path.join(DATA_DIR, "todo.json"),
  habits: path.join(DATA_DIR, "habits.json"),
  theme: path.join(DATA_DIR, "theme.json"),
  inspiration: path.join(DATA_DIR, "inspiration.json"),
  inspirationTodo: path.join(DATA_DIR, "inspiration-todo.json"),
  caldav: path.join(DATA_DIR, "caldav.json"),
};

function readJSON(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (e) {
    console.error(`Error reading ${filePath}:`, e.message);
  }
  return fallback;
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// --- Settings ---
app.get("/api/settings", (_req, res) => {
  res.json(readJSON(FILES.settings, { parameters: [], scoreFormula: "" }));
});

app.put("/api/settings", (req, res) => {
  writeJSON(FILES.settings, req.body);
  res.json({ ok: true });
});

// --- Entries ---
app.get("/api/entries", (_req, res) => {
  res.json(readJSON(FILES.entries, []));
});

app.put("/api/entries", (req, res) => {
  writeJSON(FILES.entries, req.body);
  res.json({ ok: true });
});

// Save a single entry (merge into array)
app.post("/api/entries", (req, res) => {
  const entry = req.body;
  const entries = readJSON(FILES.entries, []);
  const idx = entries.findIndex((e) => e.date === entry.date);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  writeJSON(FILES.entries, entries);
  res.json({ ok: true });
});

// --- Credentials ---
app.get("/api/credentials", (_req, res) => {
  res.json(readJSON(FILES.credentials, null));
});

app.put("/api/credentials", (req, res) => {
  writeJSON(FILES.credentials, req.body);
  res.json({ ok: true });
});

// --- Routine ---
app.get("/api/routine", (_req, res) => {
  res.json(readJSON(FILES.routine, []));
});

app.put("/api/routine", (req, res) => {
  writeJSON(FILES.routine, req.body);
  res.json({ ok: true });
});

// --- Preferences (col widths, UI state) ---
app.get("/api/preferences", (_req, res) => {
  res.json(readJSON(FILES.preferences, {}));
});

app.put("/api/preferences", (req, res) => {
  writeJSON(FILES.preferences, req.body);
  res.json({ ok: true });
});

// --- Todo ---
app.get("/api/todo", (_req, res) => {
  res.json(readJSON(FILES.todo, { tasks: [], dates: [] }));
});

app.put("/api/todo", (req, res) => {
  writeJSON(FILES.todo, req.body);
  res.json({ ok: true });
});

// --- Habits ---
app.get("/api/habits", (_req, res) => {
  res.json(readJSON(FILES.habits, { habits: [], xp: 0, level: 1, badges: [] }));
});

app.put("/api/habits", (req, res) => {
  writeJSON(FILES.habits, req.body);
  res.json({ ok: true });
});

// --- Theme ---
app.get("/api/theme", (_req, res) => {
  res.json(readJSON(FILES.theme, null));
});

app.put("/api/theme", (req, res) => {
  writeJSON(FILES.theme, req.body);
  res.json({ ok: true });
});

// --- Inspiration ---
app.get("/api/inspiration", (_req, res) => {
  res.json(readJSON(FILES.inspiration, { html: "", updatedAt: null }));
});
app.put("/api/inspiration", (req, res) => {
  writeJSON(FILES.inspiration, { ...req.body, updatedAt: new Date().toISOString() });
  res.json({ ok: true });
});

// --- Inspiration Todo ---
app.get("/api/inspiration-todo", (_req, res) => {
  res.json(readJSON(FILES.inspirationTodo, { items: [] }));
});
app.put("/api/inspiration-todo", (req, res) => {
  writeJSON(FILES.inspirationTodo, req.body);
  res.json({ ok: true });
});

// --- CalDAV config ---
const caldavCache = new Map();
function getCaldavConfig() {
  return readJSON(FILES.caldav, { url: "", username: "", password: "", calendarName: "" });
}
app.get("/api/caldav-config", (_req, res) => {
  const c = getCaldavConfig();
  res.json({ url: c.url || "", username: c.username || "", calendarName: c.calendarName || "", hasPassword: !!c.password });
});
app.put("/api/caldav-config", (req, res) => {
  const existing = getCaldavConfig();
  const { url, username, password, calendarName } = req.body || {};
  const next = {
    url: url ?? existing.url,
    username: username ?? existing.username,
    calendarName: calendarName ?? existing.calendarName,
    password: (password && password.length > 0) ? password : existing.password,
  };
  writeJSON(FILES.caldav, next);
  caldavCache.clear();
  res.json({ ok: true });
});

// --- CalDAV proxy ---
const CACHE_TTL = 60 * 1000;

// uid -> { url, etag, calendarUrl }
const eventIndex = new Map();

function getDavClient() {
  const cfg = getCaldavConfig();
  if (!cfg.url || !cfg.username || !cfg.password) throw new Error("CalDAV non configuré");
  if (!tsdav) throw new Error("CalDAV libraries not installed");
  return {
    cfg,
    client: new tsdav.DAVClient({
      serverUrl: cfg.url,
      credentials: { username: cfg.username, password: cfg.password },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    }),
  };
}

function isVeventCalendar(c) {
  const comps = c.components || c.supportedCalendarComponentSet || [];
  if (Array.isArray(comps) && comps.length) {
    return comps.map((x) => String(x).toUpperCase()).includes("VEVENT");
  }
  return true; // fallback if server doesn't expose it
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
  // tsdav returns either a Response, an array of them, or a parsed object depending on version
  const responses = Array.isArray(response) ? response : [response];
  for (const r of responses) {
    if (r && typeof r.ok === "boolean" && !r.ok) {
      let body = "";
      try { body = (await r.text()).slice(0, 400); } catch {}
      throw new Error(`CalDAV ${action} ${r.status} ${r.statusText || ""}: ${body}`);
    }
    if (r && r.status && r.status >= 400) {
      throw new Error(`CalDAV ${action} ${r.status}: ${r.statusMessage || ""}`);
    }
  }
}

async function fetchCaldavEvents(from, to) {
  if (!tsdav || !ICAL) throw new Error("CalDAV libraries not installed");
  const { client, cfg } = getDavClient();
  const calendars = await getCalendars(client, cfg);
  const events = [];
  for (const cal of calendars) {
    let objects;
    try {
      objects = await client.fetchCalendarObjects({
        calendar: cal,
        timeRange: { start: new Date(from).toISOString(), end: new Date(to).toISOString() },
      });
    } catch (e) {
      objects = await client.fetchCalendarObjects({ calendar: cal });
    }
    for (const obj of objects) {
      try {
        const jcal = ICAL.parse(obj.data);
        const comp = new ICAL.Component(jcal);
        const vevents = comp.getAllSubcomponents("vevent");
        for (const ve of vevents) {
          const ev = new ICAL.Event(ve);
          const start = ev.startDate.toJSDate();
          const end = ev.endDate ? ev.endDate.toJSDate() : start;
          if (end < new Date(from) || start > new Date(to)) continue;
          eventIndex.set(ev.uid, { url: obj.url, etag: obj.etag, calendarUrl: cal.url });
          events.push({
            uid: ev.uid,
            title: ev.summary || "(sans titre)",
            start: start.toISOString(),
            end: end.toISOString(),
            allDay: ev.startDate.isDate,
            location: ev.location || "",
            description: ev.description || "",
            _url: obj.url,
            _etag: obj.etag,
            _calendarUrl: cal.url,
          });
        }
      } catch (e) { /* skip malformed */ }
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
  } catch (e) {
    console.error("CalDAV events error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/caldav/sync", async (_req, res) => {
  caldavCache.clear();
  eventIndex.clear();
  try {
    const now = new Date();
    const from = new Date(now); from.setDate(from.getDate() - 90);
    const to = new Date(now); to.setDate(to.getDate() + 180);
    await fetchCaldavEvents(from, to);
    res.json({ ok: true, indexed: eventIndex.size });
  } catch (e) {
    console.error("CalDAV sync error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

// List writable VEVENT calendars
app.get("/api/caldav/calendars", async (_req, res) => {
  try {
    const { client, cfg } = getDavClient();
    const calendars = await getCalendars(client, cfg);
    res.json(calendars.map((c) => ({
      url: c.url,
      displayName: c.displayName || c.url,
      color: c.calendarColor || null,
    })));
  } catch (e) {
    console.error("CalDAV calendars error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/caldav/test", async (_req, res) => {
  if (!tsdav) return res.status(500).json({ ok: false, error: "tsdav non installé" });
  const cfg = getCaldavConfig();
  if (!cfg.url || !cfg.username || !cfg.password) return res.status(400).json({ ok: false, error: "Config incomplète" });
  try {
    const client = new tsdav.DAVClient({
      serverUrl: cfg.url,
      credentials: { username: cfg.username, password: cfg.password },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });
    await client.login();
    const cals = await client.fetchCalendars();
    res.json({ ok: true, calendars: cals.map((c) => c.displayName || c.url) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --- CalDAV write operations ---
function pad2(n) { return String(n).padStart(2, "0"); }
function toIcsDate(date, allDay) {
  const d = new Date(date);
  if (allDay) {
    return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`;
  }
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}
function escIcs(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }

function buildIcs({ uid, title, start, end, allDay, location, description, sequence = 0 }) {
  const dtKey = allDay ? "DTSTART;VALUE=DATE" : "DTSTART";
  const dtEndKey = allDay ? "DTEND;VALUE=DATE" : "DTEND";
  const now = toIcsDate(new Date(), false);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "PRODID:-//Tracker//CalDAV//FR",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `LAST-MODIFIED:${now}`,
    `SEQUENCE:${sequence}`,
    `${dtKey}:${toIcsDate(start, allDay)}`,
    `${dtEndKey}:${toIcsDate(end, allDay)}`,
    `SUMMARY:${escIcs(title)}`,
  ];
  if (location) lines.push(`LOCATION:${escIcs(location)}`);
  if (description) lines.push(`DESCRIPTION:${escIcs(description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR", "");
  return lines.join("\r\n");
}

const ICS_HEADERS = { "Content-Type": "text/calendar; charset=utf-8" };

function getResponseEtag(r) {
  if (!r) return null;
  if (typeof r.headers?.get === "function") return r.headers.get("etag");
  if (r.headers && r.headers.etag) return r.headers.etag;
  return null;
}

app.post("/api/caldav/events", async (req, res) => {
  try {
    const { client, cfg } = getDavClient();
    const calendars = await getCalendars(client, cfg);
    const target = req.body.calendarUrl
      ? calendars.find((c) => c.url === req.body.calendarUrl) || calendars[0]
      : calendars[0];
    if (!target) return res.status(400).json({ error: "Aucun calendrier d'évènements disponible" });
    console.log(`[CalDAV] create -> ${target.displayName || target.url}`);
    const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}@tracker`;
    const ics = buildIcs({ uid, ...req.body, sequence: 0 });
    const filename = `${uid}.ics`;
    const response = await client.createCalendarObject({
      calendar: target,
      filename,
      iCalString: ics,
      headers: ICS_HEADERS,
    });
    await ensureOk(response, "create");
    const objectUrl = (response && response.url) || new URL(filename, target.url).toString();
    eventIndex.set(uid, { url: objectUrl, etag: getResponseEtag(response), calendarUrl: target.url });
    caldavCache.clear();
    res.json({ ok: true, uid });
  } catch (e) {
    console.error("CalDAV create error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/caldav/events/:uid", async (req, res) => {
  try {
    const { client } = getDavClient();
    const idx = eventIndex.get(req.params.uid);
    if (!idx) return res.status(404).json({ error: "Évènement introuvable (synchronisez d'abord)" });
    const ics = buildIcs({ uid: req.params.uid, ...req.body, sequence: Date.now() % 1000000 });
    const response = await client.updateCalendarObject({
      calendarObject: { url: idx.url, etag: idx.etag, data: ics },
      headers: ICS_HEADERS,
    });
    await ensureOk(response, "update");
    eventIndex.set(req.params.uid, { ...idx, etag: getResponseEtag(response) || idx.etag });
    caldavCache.clear();
    res.json({ ok: true });
  } catch (e) {
    console.error("CalDAV update error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/caldav/events/:uid", async (req, res) => {
  try {
    const { client } = getDavClient();
    const idx = eventIndex.get(req.params.uid);
    if (!idx) return res.status(404).json({ error: "Évènement introuvable (synchronisez d'abord)" });
    const response = await client.deleteCalendarObject({
      calendarObject: { url: idx.url, etag: idx.etag },
    });
    await ensureOk(response, "delete");
    eventIndex.delete(req.params.uid);
    caldavCache.clear();
    res.json({ ok: true });
  } catch (e) {
    console.error("CalDAV delete error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Tracker backend listening on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
