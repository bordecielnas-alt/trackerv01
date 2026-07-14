import { useEffect, useState } from "react";

const KEY = "tracker-show-health-tab";
const EVT = "tracker-ui-prefs-change";

export function getShowHealthTab(): boolean {
  try {
    const v = localStorage.getItem(KEY);
    return v == null ? false : v === "1";
  } catch { return false; }
}

export function setShowHealthTab(v: boolean) {
  try {
    localStorage.setItem(KEY, v ? "1" : "0");
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {}
}

export function useShowHealthTab() {
  const [v, setV] = useState<boolean>(() => getShowHealthTab());
  useEffect(() => {
    const h = () => setV(getShowHealthTab());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  return [v, (nv: boolean) => setShowHealthTab(nv)] as const;
}
