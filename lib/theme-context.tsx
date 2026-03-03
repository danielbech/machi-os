"use client";

import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { THEMES, getThemeById, type Theme, type ThemeMode } from "@/lib/themes";

interface ThemeContextValue {
  /** Resolved theme for the current workspace */
  activeTheme: Theme;
  /** Current colour mode */
  mode: ThemeMode;
  /** Global theme id (fallback for all workspaces) */
  globalThemeId: string;
  /** Per-workspace theme id override (or null = use global) */
  workspaceThemeId: string | null;
  /** Set the global theme */
  setGlobalTheme: (themeId: string) => void;
  /** Set per-workspace theme (null = inherit global) */
  setWorkspaceTheme: (themeId: string | null) => void;
  /** Toggle or set mode */
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

function applyTheme(theme: Theme, mode: ThemeMode) {
  const root = document.documentElement;
  const vars = mode === "dark" ? theme.darkVariables : theme.lightVariables;

  for (const [prop, value] of Object.entries(vars)) {
    root.style.setProperty(prop, value);
  }
  localStorage.setItem(CACHE_KEY, JSON.stringify(vars));
}

function applyMode(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  localStorage.setItem(MODE_KEY, mode);
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
  ];
  for (const prop of props) {
    root.style.removeProperty(prop);
  }
  localStorage.removeItem(CACHE_KEY);
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

  // On initial mount, the blocking script in <head> already applied the
  // cached theme + mode. Skip the first effect to avoid clearing those styles
  // while activeProjectId is still loading (which would cause a flash).
  const initialMount = useRef(true);

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return;
    }

    // Always apply mode (dark class)
    applyMode(mode);

    if (resolvedId === "default") {
      // Default theme = CSS stylesheet defaults, clear inline overrides
      clearInlineTheme();
    } else {
      applyTheme(activeTheme, mode);
    }
  }, [resolvedId, activeTheme, mode]);

  const setGlobalTheme = useCallback((themeId: string) => {
    setGlobalThemeIdState(themeId);
    localStorage.setItem(GLOBAL_KEY, themeId);
  }, []);

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
    applyMode(newMode);

    // Re-apply the theme variables for the new mode
    const id = workspaceThemeId || globalThemeId;
    const theme = getThemeById(id) || THEMES[0];
    if (id === "default") {
      clearInlineTheme();
    } else {
      applyTheme(theme, newMode);
    }
  }, [workspaceThemeId, globalThemeId]);

  return (
    <ThemeContext.Provider value={{ activeTheme, mode, globalThemeId, workspaceThemeId, setGlobalTheme, setWorkspaceTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
