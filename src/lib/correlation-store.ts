import { apiGet, apiPut } from "./api";

export interface CorrItem {
  id: string;
  name: string;
  status: "active" | "persistent" | "archived";
}

// scores[date][itemId][slot] = 0..3   ; slot = "m"|"n"|"e"
export interface DailySlots { m?: number; n?: number; e?: number }
export interface CorrelationData {
  items: CorrItem[];
  scores: Record<string, Record<string, DailySlots>>;
}

const KEY = "tracker-correlation";

export async function loadCorrelation(): Promise<CorrelationData> {
  return apiGet<CorrelationData>("correlation", KEY, { items: [], scores: {} });
}
export async function saveCorrelation(d: CorrelationData) { await apiPut("correlation", KEY, d); }

export function dailyAverage(slots?: DailySlots): number | null {
  if (!slots) return null;
  const vals = [slots.m, slots.n, slots.e].filter((v): v is number => typeof v === "number");
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// Pearson correlation across dates. Series aligned by date.
export function pearson(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx, b = y[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (!den) return null;
  return num / den;
}
