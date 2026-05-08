import { apiGet, apiPut, isApiAvailable } from "./api";

const KEY = "tracker-caldav-config";

export interface CaldavConfig {
  url: string;
  username: string;
  calendarName: string;
  hasPassword: boolean;
}

export interface CaldavEvent {
  uid: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  description: string;
}

export async function loadCaldavConfig(): Promise<CaldavConfig> {
  return apiGet<CaldavConfig>("caldav-config", KEY, { url: "", username: "", calendarName: "", hasPassword: false });
}

export async function saveCaldavConfig(cfg: { url: string; username: string; calendarName: string; password?: string }): Promise<void> {
  await apiPut("caldav-config", KEY, cfg);
}

export async function testCaldav(): Promise<{ ok: boolean; calendars?: string[]; error?: string }> {
  if (!(await isApiAvailable())) return { ok: false, error: "API non disponible (mode preview)" };
  try {
    const res = await fetch("/api/caldav/test", { method: "POST" });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e?.message || "Erreur réseau" };
  }
}

export async function fetchEvents(from: Date, to: Date): Promise<CaldavEvent[]> {
  if (!(await isApiAvailable())) return [];
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  const res = await fetch(`/api/caldav/events?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
