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

const health = makePref("tracker-show-health-tab", false);
export const getShowHealthTab = health.get;
export const setShowHealthTab = health.set;
export const useShowHealthTab = health.use;

const dashboard = makePref("tracker-show-dashboard-tab", true);
export const getShowDashboardTab = dashboard.get;
export const setShowDashboardTab = dashboard.set;
export const useShowDashboardTab = dashboard.use;
