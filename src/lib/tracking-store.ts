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
  scoreFormula: string; // e.g. "(param1 + param2 / 3) - 5"
}

const SETTINGS_KEY = "tracking-settings";
const ENTRIES_KEY = "tracking-entries";

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
    // Only allow numbers, operators, parens, dots, spaces
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

export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
