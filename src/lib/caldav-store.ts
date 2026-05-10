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
  _url?: string;
  _etag?: string;
  _calendarUrl?: string;
}

export interface EventPayload {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
  calendarUrl?: string;
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

async function jsonOrThrow(res: Response) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function syncCaldav(): Promise<void> {
  if (!(await isApiAvailable())) return;
  await jsonOrThrow(await fetch("/api/caldav/sync", { method: "POST" }));
}

export async function createEvent(payload: EventPayload): Promise<{ uid: string }> {
  return jsonOrThrow(await fetch("/api/caldav/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
}

export async function updateEvent(uid: string, payload: EventPayload): Promise<void> {
  await jsonOrThrow(await fetch(`/api/caldav/events/${encodeURIComponent(uid)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }));
}

export async function deleteEvent(uid: string): Promise<void> {
  await jsonOrThrow(await fetch(`/api/caldav/events/${encodeURIComponent(uid)}`, { method: "DELETE" }));
}

export interface CalendarInfo {
  url: string;
  displayName: string;
  color: string | null;
}

export async function listCalendars(): Promise<CalendarInfo[]> {
  if (!(await isApiAvailable())) return [];
  const res = await fetch("/api/caldav/calendars");
  if (!res.ok) return [];
  return res.json();
}
