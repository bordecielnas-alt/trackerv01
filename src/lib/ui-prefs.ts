import { useEffect, useState } from "react";

const EVT = "tracker-ui-prefs-change";

function makePref(key: string, defaultVal: boolean) {
  const get = (): boolean => {
    try { const v = localStorage.getItem(key); return v == null ? defaultVal : v === "1"; }
    catch { return defaultVal; }
  };
  const set = (v: boolean) => {
    try { localStorage.setItem(key, v ? "1" : "0"); window.dispatchEvent(new CustomEvent(EVT)); } catch {}
  };
  const use = () => {
    const [val, setVal] = useState<boolean>(() => get());
    useEffect(() => {
      const h = () => setVal(get());
      window.addEventListener(EVT, h);
      window.addEventListener("storage", h);
      return () => { window.removeEventListener(EVT, h); window.removeEventListener("storage", h); };
    }, []);
    return [val, (nv: boolean) => set(nv)] as const;
  };
  return { get, set, use };
}

// --- Legacy individual prefs (kept for compatibility) ---
const health = makePref("tracker-show-health-tab", false);
export const getShowHealthTab = health.get;
export const setShowHealthTab = health.set;
export const useShowHealthTab = health.use;

const dashboard = makePref("tracker-show-dashboard-tab", true);
export const getShowDashboardTab = dashboard.get;
export const setShowDashboardTab = dashboard.set;
export const useShowDashboardTab = dashboard.use;

// --- Generic tab visibility ---
export const TAB_META: { key: TabKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "daily", label: "Daily" },
  { key: "routine", label: "Routine" },
  { key: "habits", label: "Habits" },
  { key: "health", label: "Health" },
  { key: "correlation", label: "Correlation" },
  { key: "todo", label: "Projet" },
  { key: "plan", label: "To Do" },
  { key: "calendar", label: "Calendrier" },
  { key: "statistics", label: "Statistiques" },
];

export const TAB_DEFAULTS = {
  dashboard: true,
  daily: true,
  routine: true,
  habits: true,
  health: false,
  correlation: true,
  todo: true,
  plan: true,
  calendar: true,
  statistics: false,
} as const;
export type TabKey = keyof typeof TAB_DEFAULTS;

const tabStorageKey = (k: TabKey) => `tracker-show-tab-${k}`;
// Bridge legacy keys so users don't lose their pref
const LEGACY: Partial<Record<TabKey, string>> = {
  health: "tracker-show-health-tab",
  dashboard: "tracker-show-dashboard-tab",
};

export function getTabVisible(k: TabKey): boolean {
  try {
    const v = localStorage.getItem(tabStorageKey(k));
    if (v != null) return v === "1";
    const legacy = LEGACY[k] ? localStorage.getItem(LEGACY[k]!) : null;
    if (legacy != null) return legacy === "1";
    return TAB_DEFAULTS[k];
  } catch { return TAB_DEFAULTS[k]; }
}
export function setTabVisible(k: TabKey, v: boolean) {
  try {
    localStorage.setItem(tabStorageKey(k), v ? "1" : "0");
    if (LEGACY[k]) localStorage.setItem(LEGACY[k]!, v ? "1" : "0");
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {}
}
export function useTabVisible(k: TabKey) {
  const [val, setVal] = useState<boolean>(() => getTabVisible(k));
  useEffect(() => {
    const h = () => setVal(getTabVisible(k));
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(EVT, h); window.removeEventListener("storage", h); };
  }, [k]);
  return [val, (nv: boolean) => setTabVisible(k, nv)] as const;
}

// Daily input UI mode: slider | buttons | stepper | input
export type DailyInputMode = "slider" | "buttons" | "stepper" | "input";
export function getDailyInputMode(): DailyInputMode {
  try { const v = localStorage.getItem("tracker-daily-input-mode"); return (v as DailyInputMode) || "slider"; } catch { return "slider"; }
}
export function setDailyInputMode(v: DailyInputMode) {
  try { localStorage.setItem("tracker-daily-input-mode", v); window.dispatchEvent(new CustomEvent(EVT)); } catch {}
}
export function useDailyInputMode() {
  const [val, setVal] = useState<DailyInputMode>(() => getDailyInputMode());
  useEffect(() => {
    const h = () => setVal(getDailyInputMode());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(EVT, h); window.removeEventListener("storage", h); };
  }, []);
  return [val, (nv: DailyInputMode) => setDailyInputMode(nv)] as const;
}
