import { useEffect, useState, useCallback } from "react";
import { apiGet, apiPut } from "@/lib/api";

// HSL parts only — stored as "H S% L%" strings (matches index.css convention).
export interface ThemePalette {
  id: string;
  label: string;
  // Background HSL — drives derivation of card / muted / accent / sidebar
  bg: { h: number; s: number; l: number };
  // Optional explicit accent override (defaults to teal primary)
  isDark?: boolean;
}

// Default palette — matches index.css defaults
export const DEFAULT_THEME_ID = "cream";

// ~30 carefully chosen background tones (light pastels + neutrals + a few dark options)
export const THEME_PALETTE: ThemePalette[] = [
  // === Crèmes & neutres clairs ===
  { id: "cream",       label: "Crème",         bg: { h: 40,  s: 20, l: 97 } },
  { id: "ivory",       label: "Ivoire",        bg: { h: 50,  s: 30, l: 96 } },
  { id: "linen",       label: "Lin",           bg: { h: 30,  s: 22, l: 95 } },
  { id: "snow",        label: "Neige",         bg: { h: 0,   s: 0,  l: 99 } },
  { id: "pearl",       label: "Perle",         bg: { h: 220, s: 10, l: 96 } },
  { id: "stone",       label: "Pierre",        bg: { h: 30,  s: 8,  l: 93 } },
  { id: "sand",        label: "Sable",         bg: { h: 38,  s: 35, l: 92 } },
  // === Pastels froids ===
  { id: "mint",        label: "Menthe",        bg: { h: 150, s: 35, l: 94 } },
  { id: "sage",        label: "Sauge",         bg: { h: 110, s: 18, l: 92 } },
  { id: "sky",         label: "Ciel",          bg: { h: 200, s: 50, l: 94 } },
  { id: "powder",      label: "Bleu poudré",   bg: { h: 215, s: 40, l: 93 } },
  { id: "lavender",    label: "Lavande",       bg: { h: 260, s: 30, l: 94 } },
  { id: "lilac",       label: "Lilas",         bg: { h: 280, s: 35, l: 94 } },
  { id: "ocean",       label: "Océan",         bg: { h: 190, s: 45, l: 93 } },
  // === Pastels chauds ===
  { id: "peach",       label: "Pêche",         bg: { h: 25,  s: 60, l: 93 } },
  { id: "blush",       label: "Rose pâle",     bg: { h: 350, s: 40, l: 94 } },
  { id: "rose",        label: "Rose poudré",   bg: { h: 340, s: 35, l: 93 } },
  { id: "apricot",     label: "Abricot",       bg: { h: 30,  s: 65, l: 92 } },
  { id: "butter",      label: "Beurre",        bg: { h: 50,  s: 60, l: 94 } },
  { id: "champagne",   label: "Champagne",     bg: { h: 42,  s: 38, l: 92 } },
  // === Verts ===
  { id: "apple",       label: "Pomme",         bg: { h: 90,  s: 35, l: 92 } },
  { id: "pistachio",   label: "Pistache",      bg: { h: 75,  s: 30, l: 91 } },
  { id: "seafoam",     label: "Écume",         bg: { h: 165, s: 30, l: 93 } },
  // === Neutres mid ===
  { id: "fog",         label: "Brume",         bg: { h: 210, s: 12, l: 90 } },
  { id: "smoke",       label: "Fumée",         bg: { h: 220, s: 6,  l: 88 } },
  { id: "taupe",       label: "Taupe",         bg: { h: 30,  s: 10, l: 87 } },
  // === Dark mode options ===
  { id: "midnight",    label: "Minuit",        bg: { h: 220, s: 25, l: 12 }, isDark: true },
  { id: "graphite",    label: "Graphite",      bg: { h: 220, s: 6,  l: 16 }, isDark: true },
  { id: "forest",      label: "Forêt nuit",    bg: { h: 160, s: 20, l: 12 }, isDark: true },
  { id: "indigo",      label: "Indigo nuit",   bg: { h: 240, s: 30, l: 14 }, isDark: true },
  { id: "espresso",    label: "Expresso",      bg: { h: 25,  s: 18, l: 14 }, isDark: true },
];

function hslStr(h: number, s: number, l: number) {
  return `${h} ${s}% ${l}%`;
}

function clampL(l: number) {
  return Math.max(0, Math.min(100, l));
}

/**
 * Derive the full set of CSS variable values from a single background palette.
 * Light themes: card slightly lighter, muted/border slightly darker, fg dark.
 * Dark themes: card slightly lighter than bg, fg light.
 */
function deriveTokens(p: ThemePalette) {
  const { h, s, l } = p.bg;
  const dark = !!p.isDark;

  // Foreground / muted-foreground based on dark/light
  const fgL = dark ? 95 : 10;
  const fgS = dark ? 10 : 25;
  const fgH = h;

  const mutedFgL = dark ? 65 : 45;

  // Card: slightly lighter than bg in light mode; lighter than bg in dark too
  const cardL = clampL(dark ? l + 4 : l + 2);
  // Muted: a touch darker (light) / lighter (dark)
  const mutedL = clampL(dark ? l + 6 : l - 5);
  // Border / input: darker in light, lighter in dark
  const borderL = clampL(dark ? l + 12 : l - 12);
  // Accent: subtle tint
  const accentL = clampL(dark ? l + 8 : l - 7);
  // Sidebar: very subtle shift
  const sidebarL = clampL(dark ? l - 1 : l - 1);

  return {
    "--background": hslStr(h, s, l),
    "--foreground": hslStr(fgH, fgS, fgL),
    "--card": hslStr(h, Math.max(s - 5, 0), cardL),
    "--card-foreground": hslStr(fgH, fgS, fgL),
    "--popover": hslStr(h, Math.max(s - 5, 0), clampL(cardL + 1)),
    "--popover-foreground": hslStr(fgH, fgS, fgL),
    "--muted": hslStr(h, Math.max(s - 5, 0), mutedL),
    "--muted-foreground": hslStr(fgH, 10, mutedFgL),
    "--accent": hslStr(h, Math.max(s, 10), accentL),
    "--accent-foreground": hslStr(fgH, fgS, dark ? 95 : 20),
    "--border": hslStr(h, Math.max(s - 5, 5), borderL),
    "--input": hslStr(h, Math.max(s - 5, 5), borderL),
    "--sidebar-background": hslStr(h, s, sidebarL),
    "--sidebar-foreground": hslStr(fgH, 10, dark ? 80 : 30),
    "--sidebar-border": hslStr(h, Math.max(s - 5, 5), clampL(borderL + (dark ? 2 : 3))),
    "--sidebar-accent": hslStr(h, Math.max(s, 10), accentL),
    "--sidebar-accent-foreground": hslStr(fgH, fgS, dark ? 95 : 20),
  };
}

export function applyTheme(themeId: string) {
  const palette = THEME_PALETTE.find((p) => p.id === themeId) ?? THEME_PALETTE[0];
  const tokens = deriveTokens(palette);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(tokens)) {
    root.style.setProperty(k, v);
  }
  root.dataset.themeId = themeId;
}

export async function loadTheme(): Promise<string> {
  const data = await apiGet<{ themeId: string } | null>("theme", "app-theme", null);
  return data?.themeId ?? DEFAULT_THEME_ID;
}

export async function saveTheme(themeId: string): Promise<void> {
  await apiPut("theme", "app-theme", { themeId });
}

/** Apply persisted theme on app boot (call once). */
export function useThemeBootstrap() {
  useEffect(() => {
    let cancelled = false;
    loadTheme().then((id) => {
      if (!cancelled) applyTheme(id);
    });
    return () => { cancelled = true; };
  }, []);
}

/** Hook for the AdminPage selector — controls and persists current theme. */
export function useTheme() {
  const [themeId, setThemeId] = useState<string>(DEFAULT_THEME_ID);

  useEffect(() => {
    loadTheme().then((id) => {
      setThemeId(id);
      applyTheme(id);
    });
  }, []);

  const setTheme = useCallback((id: string) => {
    setThemeId(id);
    applyTheme(id);
    saveTheme(id);
  }, []);

  const resetTheme = useCallback(() => {
    setTheme(DEFAULT_THEME_ID);
  }, [setTheme]);

  return { themeId, setTheme, resetTheme };
}
