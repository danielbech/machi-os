"use client";

import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context";
import { AuthForm } from "@/components/auth-form";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

function DashboardGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useWorkspace();

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
          <SidebarInset>
            {children}
          </SidebarInset>
        </div>
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
