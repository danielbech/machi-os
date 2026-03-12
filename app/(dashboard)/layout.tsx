"use client";

import { useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context";
import { ProjectDataProvider } from "@/lib/project-data-context";
import { BoardDataProvider } from "@/lib/board-data-context";
import { BacklogProvider, useBacklog } from "@/lib/backlog-context";
import { CalendarProvider } from "@/lib/calendar-context";
import { ThemeProvider } from "@/lib/theme-context";
import { AuthForm } from "@/components/auth-form";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BacklogShell } from "@/components/backlog-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { CursorOverlay } from "@/components/cursor-overlay";
import { WelcomeDialog } from "@/components/welcome-dialog";

function ThemeBridge({ children }: { children: React.ReactNode }) {
  const { activeProjectId } = useWorkspace();
  return <ThemeProvider activeProjectId={activeProjectId}>{children}</ThemeProvider>;
}

function DashboardGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { backlogOpen, backlogWidth } = useBacklog();
  const isMobile = useIsMobile();
  const [showWelcome, setShowWelcome] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem("flowie-welcome-seen");
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex">
        <div className="flex-1 pt-4 pr-4 md:pr-8">
          <div className="flex gap-2 pt-1 px-4 md:px-8">
            {[0, 1, 2, 3, 4].map((ki) => (
              <div key={ki} className="w-[280px] shrink-0 p-2.5 space-y-2.5">
                <div className="flex items-baseline gap-2 px-1 mb-1.5">
                  <div className="h-4 w-16 bg-foreground/[0.06] rounded-md animate-pulse" />
                  <div className="h-3.5 w-8 bg-foreground/[0.04] rounded-md animate-pulse" />
                </div>
                {[...Array(ki === 0 ? 3 : ki === 1 ? 2 : 1)].map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-foreground/5 bg-card p-2 space-y-2 animate-pulse"
                    style={{ animationDelay: `${(ki * 120) + (i * 80)}ms` }}
                  >
                    <div className="h-3.5 bg-foreground/[0.06] rounded w-[85%]" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <div className="flex w-full animate-in fade-in duration-300 bg-background">
          <AppSidebar />
          <BacklogShell />
          <SidebarInset className="overflow-clip min-w-0 transition-[margin] duration-200 ease-in-out bg-transparent" style={!isMobile && backlogOpen ? { marginLeft: backlogWidth } : undefined}>
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
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <WorkspaceProvider>
          <ProjectDataProvider>
            <BoardDataProvider>
              <ThemeBridge>
                <CalendarProvider>
                  <BacklogProvider>
                    <DashboardGate>{children}</DashboardGate>
                  </BacklogProvider>
                </CalendarProvider>
              </ThemeBridge>
            </BoardDataProvider>
          </ProjectDataProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
