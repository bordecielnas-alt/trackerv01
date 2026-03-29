import { apiGet, apiPut, apiPost } from "./api";

export interface TrackingParameter {
  id: string;
  name: string;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  order: number;
}

export interface DailyEntry {
  date: string; // YYYY-MM-DD
  values: Record<string, number>; // parameterId -> value
  comment: string;
}

export interface TrackingSettings {
  parameters: TrackingParameter[];
  scoreFormula: string;
}

const SETTINGS_KEY = "tracking-settings";
const ENTRIES_KEY = "tracking-entries";

// --- Async API-first versions ---

export async function getSettingsAsync(): Promise<TrackingSettings> {
  return apiGet("settings", SETTINGS_KEY, { parameters: [], scoreFormula: "" });
}

export async function saveSettingsAsync(settings: TrackingSettings): Promise<void> {
  return apiPut("settings", SETTINGS_KEY, settings);
}

export async function getEntriesAsync(): Promise<DailyEntry[]> {
  return apiGet("entries", ENTRIES_KEY, []);
}

export async function saveEntriesAsync(entries: DailyEntry[]): Promise<void> {
  return apiPut("entries", ENTRIES_KEY, entries);
}

export async function saveEntryAsync(entry: DailyEntry): Promise<void> {
  // Try API single-entry endpoint first
  await apiPost("entries", entry);
  // Also update localStorage as fallback
  const entries = getEntries();
  const idx = entries.findIndex((e) => e.date === entry.date);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

// --- Synchronous localStorage versions (kept for compatibility) ---

export function getSettings(): TrackingSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (raw) return JSON.parse(raw);
  return { parameters: [], scoreFormula: "" };
}

export function saveSettings(settings: TrackingSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getEntries(): DailyEntry[] {
  const raw = localStorage.getItem(ENTRIES_KEY);
  if (raw) return JSON.parse(raw);
  return [];
}

export function saveEntries(entries: DailyEntry[]) {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
}

export function getEntry(date: string): DailyEntry | undefined {
  return getEntries().find((e) => e.date === date);
}

export function saveEntry(entry: DailyEntry) {
  const entries = getEntries();
  const idx = entries.findIndex((e) => e.date === entry.date);
  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  saveEntries(entries);
}

export function computeScore(
  values: Record<string, number>,
  parameters: TrackingParameter[],
  formula: string
): number | null {
  if (!formula.trim()) return null;
  try {
    let expr = formula;
    for (const p of parameters) {
      const regex = new RegExp(`\\b${escapeRegex(p.name)}\\b`, "gi");
      expr = expr.replace(regex, String(values[p.id] ?? p.defaultValue));
    }
    if (!/^[\d\s+\-*/().]+$/.test(expr)) return null;
    const result = Function(`"use strict"; return (${expr})`)();
    return typeof result === "number" && isFinite(result)
      ? Math.round(result * 100) / 100
      : null;
  } catch {
    return null;
  }
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Routine blocks ---
export async function getRoutineAsync(): Promise<unknown[]> {
  return apiGet("routine", "routine-blocks", []);
}

export async function saveRoutineAsync(blocks: unknown[]): Promise<void> {
  return apiPut("routine", "routine-blocks", blocks);
}

// --- UI Preferences (col widths, etc.) ---
export async function getPreferencesAsync(): Promise<Record<string, unknown>> {
  return apiGet("preferences", "ui-preferences", {});
}

export async function savePreferencesAsync(prefs: Record<string, unknown>): Promise<void> {
  return apiPut("preferences", "ui-preferences", prefs);
}

export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
