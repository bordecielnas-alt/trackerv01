// Abstraction layer: tries backend API first, falls back to localStorage.
// In Docker, the backend runs behind /api via nginx proxy.
// In Lovable preview (no backend), localStorage is used.

let _apiAvailable: boolean | null = null;

async function isApiAvailable(): Promise<boolean> {
  if (_apiAvailable !== null) return _apiAvailable;
  try {
    const res = await fetch("/api/health", { signal: AbortSignal.timeout(1500) });
    if (!res.ok) { _apiAvailable = false; return false; }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) { _apiAvailable = false; return false; }
    const data = await res.json();
    _apiAvailable = data && data.ok === true;
  } catch {
    _apiAvailable = false;
  }
  return _apiAvailable!;
}

export async function apiGet<T>(endpoint: string, localStorageKey: string, fallback: T): Promise<T> {
  if (await isApiAvailable()) {
    try {
      const res = await fetch(`/api/${endpoint}`);
      if (res.ok) {
        const data = await res.json();
        return data ?? fallback;
      }
    } catch { /* fall through */ }
  }
  // localStorage fallback
  const raw = localStorage.getItem(localStorageKey);
  if (raw) return JSON.parse(raw);
  return fallback;
}

export async function apiPut<T>(endpoint: string, localStorageKey: string, data: T): Promise<void> {
  if (await isApiAvailable()) {
    try {
      await fetch(`/api/${endpoint}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return;
    } catch { /* fall through */ }
  }
  localStorage.setItem(localStorageKey, JSON.stringify(data));
}

export async function apiPost<T>(endpoint: string, data: T): Promise<void> {
  if (await isApiAvailable()) {
    try {
      await fetch(`/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return;
    } catch { /* fall through */ }
  }
}

export { isApiAvailable };
