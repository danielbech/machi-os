"use client";

import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context";
import { AuthForm } from "@/components/auth-form";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

function DashboardGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useWorkspace();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black/50">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <DashboardGate>{children}</DashboardGate>
    </WorkspaceProvider>
  );
}
