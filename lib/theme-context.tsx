"use client";

import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { THEMES, getThemeById, type Theme, type ThemeMode } from "@/lib/themes";

type EffectiveMode = "light" | "dark";

interface ThemeContextValue {
  activeTheme: Theme;
  /** User-chosen mode preference (may be "system") */
  mode: ThemeMode;
  /** Resolved mode — always "light" or "dark" */
  resolvedMode: EffectiveMode;
  themeId: string;
  setTheme: (themeId: string) => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

const THEME_KEY = "flowie-global-theme";
const MODE_KEY = "flowie-theme-mode";
const CACHE_KEY = "flowie-theme-cache";

function getSystemMode(): EffectiveMode {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveMode(mode: ThemeMode): EffectiveMode {
  if (mode === "system") return getSystemMode();
  return mode;
}

function applyTheme(theme: Theme, effective: EffectiveMode) {
  const root = document.documentElement;
  const vars = effective === "dark" ? theme.darkVariables : theme.lightVariables;
  const all = { ...vars, ...(theme.sharedVariables || {}) };
  for (const [prop, value] of Object.entries(all)) {
    root.style.setProperty(prop, value);
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(all));
}

function applyDarkClass(effective: EffectiveMode) {
  const root = document.documentElement;
  if (effective === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function clearInlineTheme() {
  const root = document.documentElement;
  const props = [
    "--background", "--foreground", "--card", "--card-foreground",
    "--popover", "--popover-foreground", "--primary", "--primary-foreground",
    "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
    "--accent", "--accent-foreground", "--destructive", "--destructive-foreground",
    "--border", "--input", "--ring",
    "--sidebar", "--sidebar-foreground", "--sidebar-primary", "--sidebar-primary-foreground",
    "--sidebar-accent", "--sidebar-accent-foreground", "--sidebar-border", "--sidebar-ring",
    "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5",
    "--shadow-2xs", "--shadow-xs", "--shadow-sm", "--shadow", "--shadow-md",
    "--shadow-lg", "--shadow-xl", "--shadow-2xl",
    // Shared (mode-independent) variables
    "--font-sans", "--font-mono", "--font-serif", "--radius", "--tracking-normal",
  ];
  for (const prop of props) {
    root.style.removeProperty(prop);
  }
  localStorage.removeItem(CACHE_KEY);
}

function applyAll(themeId: string, theme: Theme, effective: EffectiveMode) {
  applyDarkClass(effective);
  clearInlineTheme();
  if (themeId !== "default") {
    applyTheme(theme, effective);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState(() => {
    if (typeof window === "undefined") return "default";
    return localStorage.getItem(THEME_KEY) || "default";
  });

  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem(MODE_KEY) as ThemeMode) || "dark";
  });

  const [resolvedMode, setResolvedMode] = useState<EffectiveMode>(() => resolveMode(mode));

  // Listen to OS preference changes when mode is "system"
  useEffect(() => {
    if (mode !== "system") {
      setResolvedMode(resolveMode(mode));
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setResolvedMode(mq.matches ? "dark" : "light");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [mode]);

  const activeTheme = getThemeById(themeId) || THEMES[0];

  // On initial mount, the blocking script already applied cached theme + mode.
  // Skip first effect to avoid flash.
  const initialMount = useRef(true);

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return;
    }
    applyAll(themeId, activeTheme, resolvedMode);
  }, [themeId, activeTheme, resolvedMode]);

  const setTheme = useCallback((newThemeId: string) => {
    setThemeIdState(newThemeId);
    localStorage.setItem(THEME_KEY, newThemeId);

    // Apply immediately
    const theme = getThemeById(newThemeId) || THEMES[0];
    applyAll(newThemeId, theme, resolvedMode);
  }, [resolvedMode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(MODE_KEY, newMode);
    const effective = resolveMode(newMode);
    setResolvedMode(effective);

    // Re-apply immediately
    const theme = getThemeById(themeId) || THEMES[0];
    applyAll(themeId, theme, effective);
  }, [themeId]);

  return (
    <ThemeContext.Provider value={{ activeTheme, mode, resolvedMode, themeId, setTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
