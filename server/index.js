const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Tracker backend listening on port ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
