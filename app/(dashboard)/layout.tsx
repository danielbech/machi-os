"use client";

import { useState, useEffect } from "react";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context";
import { BacklogProvider, useBacklog } from "@/lib/backlog-context";
import { CalendarProvider } from "@/lib/calendar-context";
import { AuthForm } from "@/components/auth-form";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BacklogShell } from "@/components/backlog-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { CursorOverlay } from "@/components/cursor-overlay";
import { WelcomeDialog } from "@/components/welcome-dialog";
import { PendingInvitesDialog } from "@/components/pending-invites-dialog";

// DEBUG: remove after troubleshooting
let _gateRenders = 0;

function DashboardGate({ children }: { children: React.ReactNode }) {
  _gateRenders++;
  if (_gateRenders % 10 === 0) console.warn(`[DEBUG] DashboardGate rendered ${_gateRenders} times`);
  const { user, loading, pendingInvites } = useWorkspace();
  const { backlogOpen, backlogWidth } = useBacklog();
  const isMobile = useIsMobile();
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("flowie-welcome-seen");
  });
  const [showInvites, setShowInvites] = useState(false);

  // Auto-open invites dialog when pending invites arrive
  useEffect(() => {
    if (pendingInvites.length > 0 && !showWelcome) {
      setShowInvites(true);
    }
  }, [pendingInvites.length, showWelcome]);

  if (loading) {
    return <div className="min-h-screen bg-zinc-950" />;
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <div className="flex w-full animate-in fade-in duration-300 bg-zinc-950">
          <AppSidebar />
          <BacklogShell />
          <SidebarInset className="overflow-hidden min-w-0 transition-[margin] duration-200 ease-in-out bg-transparent" style={!isMobile && backlogOpen ? { marginLeft: backlogWidth } : undefined}>
            {/* Mobile header with hamburger trigger */}
            <header className="flex items-center gap-2 px-4 py-3 md:hidden">
              <SidebarTrigger className="-ml-1" />
              <span className="text-sm font-semibold">Flowie</span>
            </header>
            {children}
          </SidebarInset>
          <CursorOverlay />
        </div>
        <WelcomeDialog
          open={showWelcome}
          onClose={() => {
            localStorage.setItem("flowie-welcome-seen", "true");
            setShowWelcome(false);
          }}
        />
        <PendingInvitesDialog
          open={showInvites}
          onOpenChange={setShowInvites}
        />
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <WorkspaceProvider>
        <CalendarProvider>
          <BacklogProvider>
            <DashboardGate>{children}</DashboardGate>
          </BacklogProvider>
        </CalendarProvider>
      </WorkspaceProvider>
    </ErrorBoundary>
  );
}
