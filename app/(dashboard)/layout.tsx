"use client";

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

function DashboardGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useWorkspace();
  const { backlogOpen, backlogWidth } = useBacklog();
  const isMobile = useIsMobile();

  if (loading) {
    return <div className="min-h-screen bg-black/50" />;
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <div className="flex w-full animate-in fade-in duration-300">
          <AppSidebar />
          <BacklogShell />
          <SidebarInset className="overflow-hidden min-w-0 transition-[margin] duration-200 ease-in-out" style={!isMobile && backlogOpen ? { marginLeft: backlogWidth } : undefined}>
            {/* Mobile header with hamburger trigger */}
            <header className="flex items-center gap-2 px-4 py-3 md:hidden">
              <SidebarTrigger className="-ml-1" />
              <span className="text-sm font-semibold">Flowie</span>
            </header>
            {children}
          </SidebarInset>
          <CursorOverlay />
        </div>
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
