"use client";

import { Toaster } from "sonner";
import { useState, useEffect } from "react";

export function ThemeToaster() {
  const [mode, setMode] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    return localStorage.getItem("flowie-theme-mode") === "light" ? "light" : "dark";
  });

  useEffect(() => {
    // Watch for dark class changes on <html> to stay in sync
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      setMode(isDark ? "dark" : "light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return <Toaster theme={mode} position="bottom-right" />;
}
