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

  return (
    <Toaster
      theme={mode}
      position="bottom-right"
      toastOptions={{
        style: {
          background: "var(--popover)",
          color: "var(--popover-foreground)",
          border: "1px solid var(--border)",
          fontSize: "13px",
          padding: "10px 14px",
          width: "fit-content",
          gap: "12px",
        },
        actionButtonStyle: {
          background: "var(--primary)",
          color: "var(--primary-foreground)",
          fontSize: "12px",
          padding: "2px 8px",
        },
      }}
    />
  );
}
