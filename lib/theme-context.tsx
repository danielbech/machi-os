"use client";

import { createContext, useContext, useCallback, useEffect, useState } from "react";
import { THEMES, getThemeById, type Theme } from "@/lib/themes";

interface ThemeContextValue {
  /** Resolved theme for the current workspace */
  activeTheme: Theme;
  /** Global theme id (fallback for all workspaces) */
  globalThemeId: string;
  /** Per-workspace theme id override (or null = use global) */
  workspaceThemeId: string | null;
  /** Set the global theme */
  setGlobalTheme: (themeId: string) => void;
  /** Set per-workspace theme (null = inherit global) */
  setWorkspaceTheme: (themeId: string | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

const GLOBAL_KEY = "flowie-global-theme";
const wsKey = (id: string) => `flowie-workspace-theme-${id}`;

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(theme.variables)) {
    root.style.setProperty(prop, value);
  }
}

function clearInlineTheme() {
  const root = document.documentElement;
  // Remove any inline style properties we may have set
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

  // Apply CSS variables whenever theme changes
  useEffect(() => {
    if (resolvedId === "default") {
      clearInlineTheme();
    } else {
      applyTheme(activeTheme);
    }
  }, [resolvedId, activeTheme]);

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

  return (
    <ThemeContext.Provider value={{ activeTheme, globalThemeId, workspaceThemeId, setGlobalTheme, setWorkspaceTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
