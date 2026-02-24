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
    <main className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="text-center space-y-4">
        <h2 className="text-lg font-semibold text-white/80">Something went wrong</h2>
        <p className="text-sm text-white/40 max-w-md">
          An unexpected error occurred. Try refreshing the page.
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-md bg-white/10 text-sm text-white/70 hover:bg-white/15 transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
