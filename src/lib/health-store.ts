import { apiGet, apiPut, isApiAvailable } from "./api";

export interface HealthItem {
  date: string; // YYYY-MM-DD
  steps?: number | null;
  sleep?: number | null;    // hours
  weight?: number | null;   // kg
  restingHR?: number | null;
  mood?: number | null;
  note?: string;
  source?: "manual" | "google";
}

export interface HealthData { items: HealthItem[]; notes: Record<string, string>; }
export interface HealthConfig { enabled: boolean; clientId: string; hasToken: boolean; }

const KEY_DATA = "tracker-health-data";
const KEY_CFG = "tracker-health-config";

export async function loadHealthData(): Promise<HealthData> {
  return apiGet<HealthData>("health-data", KEY_DATA, { items: [], notes: {} });
}
export async function saveHealthData(d: HealthData) { await apiPut("health-data", KEY_DATA, d); }

export async function loadHealthConfig(): Promise<HealthConfig> {
  return apiGet<HealthConfig>("health-config", KEY_CFG, { enabled: false, clientId: "", hasToken: false });
}
export async function saveHealthConfig(cfg: { enabled: boolean; clientId?: string; accessToken?: string; refreshToken?: string }) {
  await apiPut("health-config", KEY_CFG, cfg);
}

export async function syncGoogleHealth(): Promise<{ ok: boolean; days?: number; error?: string }> {
  if (!(await isApiAvailable())) return { ok: false, error: "API non disponible" };
  try {
    const r = await fetch("/api/health-sync", { method: "POST" });
    const j = await r.json();
    if (!r.ok) return { ok: false, error: j.error || `HTTP ${r.status}` };
    return { ok: true, days: j.days };
  } catch (e: any) { return { ok: false, error: e.message }; }
}
