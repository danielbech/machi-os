"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h2 className="text-lg font-semibold text-foreground/80">Something went wrong</h2>
        <p className="text-sm text-foreground/40 max-w-md">
          An unexpected error occurred. Try refreshing the page.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-md bg-foreground/10 text-sm text-foreground/70 hover:bg-foreground/15 transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
