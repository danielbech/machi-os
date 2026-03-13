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
  globalThemeId: string;
  workspaceThemeId: string | null;
  setGlobalTheme: (themeId: string) => void;
  setWorkspaceTheme: (themeId: string | null) => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

const GLOBAL_KEY = "flowie-global-theme";
const MODE_KEY = "flowie-theme-mode";
const wsKey = (id: string) => `flowie-workspace-theme-${id}`;
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
  // Always clear first to remove stale vars from previous theme
  clearInlineTheme();
  if (themeId !== "default") {
    applyTheme(theme, effective);
  }
}

export function ThemeProvider({
  activeProjectId,
  children,
}: {
  activeProjectId: string | null;
  children: React.ReactNode;
}) {
  const [globalThemeId, setGlobalThemeIdState] = useState(() => {
    if (typeof window === "undefined") return "default";
    return localStorage.getItem(GLOBAL_KEY) || "default";
  });

  const [workspaceThemeId, setWorkspaceThemeIdState] = useState<string | null>(() => {
    if (typeof window === "undefined" || !activeProjectId) return null;
    return localStorage.getItem(wsKey(activeProjectId)) || null;
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

  // When workspace changes, load its theme override
  useEffect(() => {
    if (!activeProjectId) {
      setWorkspaceThemeIdState(null);
      return;
    }
    const stored = localStorage.getItem(wsKey(activeProjectId));
    setWorkspaceThemeIdState(stored || null);
  }, [activeProjectId]);

  const resolvedId = workspaceThemeId || globalThemeId;
  const activeTheme = getThemeById(resolvedId) || THEMES[0];

  // On initial mount, the blocking script already applied cached theme + mode.
  // Skip first effect to avoid flash while activeProjectId is still loading.
  const initialMount = useRef(true);

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return;
    }
    applyAll(resolvedId, activeTheme, resolvedMode);
  }, [resolvedId, activeTheme, resolvedMode]);

  const setGlobalTheme = useCallback((themeId: string) => {
    setGlobalThemeIdState(themeId);
    localStorage.setItem(GLOBAL_KEY, themeId);

    // Apply immediately (don't rely solely on the effect)
    const resolved = workspaceThemeId || themeId;
    const theme = getThemeById(resolved) || THEMES[0];
    applyAll(resolved, theme, resolvedMode);
  }, [workspaceThemeId, resolvedMode]);

  const setWorkspaceTheme = useCallback((themeId: string | null) => {
    setWorkspaceThemeIdState(themeId);
    if (!activeProjectId) return;
    if (themeId) {
      localStorage.setItem(wsKey(activeProjectId), themeId);
    } else {
      localStorage.removeItem(wsKey(activeProjectId));
    }
  }, [activeProjectId]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(MODE_KEY, newMode);
    const effective = resolveMode(newMode);
    setResolvedMode(effective);

    // Re-apply immediately
    const id = workspaceThemeId || globalThemeId;
    const theme = getThemeById(id) || THEMES[0];
    applyAll(id, theme, effective);
  }, [workspaceThemeId, globalThemeId]);

  return (
    <ThemeContext.Provider value={{ activeTheme, mode, resolvedMode, globalThemeId, workspaceThemeId, setGlobalTheme, setWorkspaceTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
