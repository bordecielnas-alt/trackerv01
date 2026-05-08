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

// --- CalDAV config ---
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
const caldavCache = new Map(); // key: from|to -> {ts, data}
const CACHE_TTL = 60 * 1000;

async function fetchCaldavEvents(from, to) {
  if (!tsdav || !ICAL) throw new Error("CalDAV libraries not installed");
  const cfg = getCaldavConfig();
  if (!cfg.url || !cfg.username || !cfg.password) throw new Error("CalDAV non configuré");

  const client = new tsdav.DAVClient({
    serverUrl: cfg.url,
    credentials: { username: cfg.username, password: cfg.password },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
  await client.login();
  let calendars = await client.fetchCalendars();
  if (cfg.calendarName) {
    const filtered = calendars.filter((c) => (c.displayName || "").toLowerCase().includes(cfg.calendarName.toLowerCase()));
    if (filtered.length) calendars = filtered;
  }
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
          // basic window filter
          if (end < new Date(from) || start > new Date(to)) continue;
          events.push({
            uid: ev.uid,
            title: ev.summary || "(sans titre)",
            start: start.toISOString(),
            end: end.toISOString(),
            allDay: ev.startDate.isDate,
            location: ev.location || "",
            description: ev.description || "",
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Tracker backend listening on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
