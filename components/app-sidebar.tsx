"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { SettingsDialog } from "@/components/settings-dialog";
import { getWorkspaceMembers, type WorkspaceMember } from "@/lib/supabase/workspace";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, Building2, Settings, Check, ChevronDown } from "lucide-react";

const NAV_ITEMS = [
  { title: "Board", href: "/", icon: LayoutDashboard },
  { title: "Clients", href: "/clients", icon: Building2 },
];

export function AppSidebar() {
  const pathname = usePathname();
  const {
    userProjects, activeProjectId, setActiveProjectId, activeProject, user,
    googleCalendarConnected, connectGoogleCalendar, disconnectGoogleAccount,
    syncCalendarEvents, calendarConnections, updateSelectedCalendars,
  } = useWorkspace();
  const [showSettings, setShowSettings] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);

  const handleOpenSettings = async () => {
    setShowSettings(true);
    if (activeProjectId) {
      try {
        const members = await getWorkspaceMembers(activeProjectId);
        setWorkspaceMembers(members);
      } catch (error) {
        console.error("Failed to load workspace members:", error);
      }
    }
  };

  return (
    <>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              {userProjects.length > 1 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton size="lg" className="cursor-pointer">
                      <div
                        className="flex aspect-square size-8 items-center justify-center rounded-lg"
                        style={{ backgroundColor: activeProject?.color || "#3b82f6" }}
                      >
                        <img src="/logo.svg" alt="Machi OS" className="size-5 invert" />
                      </div>
                      <div className="flex flex-col gap-0.5 leading-none">
                        <span className="font-semibold">{activeProject?.name || "Machi OS"}</span>
                        <span className="text-xs text-sidebar-foreground/60">Workspace</span>
                      </div>
                      <ChevronDown className="ml-auto size-4 opacity-50" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-[200px]">
                    {userProjects.map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        onClick={() => setActiveProjectId(project.id)}
                        className="flex items-center gap-2"
                      >
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className={project.id === activeProjectId ? "font-semibold" : ""}>
                          {project.name}
                        </span>
                        {project.id === activeProjectId && (
                          <Check className="size-4 ml-auto text-white/60" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <SidebarMenuButton size="lg" className="pointer-events-none">
                  <div
                    className="flex aspect-square size-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: activeProject?.color || "#3b82f6" }}
                  >
                    <img src="/logo.svg" alt="Machi OS" className="size-5 invert" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold">{activeProject?.name || "Machi OS"}</span>
                    <span className="text-xs text-sidebar-foreground/60">Workspace</span>
                  </div>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={pathname === item.href} tooltip={item.title}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleOpenSettings} tooltip="Settings">
                <Settings />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {user && (
        <SettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
          user={user}
          activeProjectId={activeProjectId}
          googleCalendarConnected={googleCalendarConnected}
          onGoogleCalendarConnect={connectGoogleCalendar}
          onDisconnectAccount={disconnectGoogleAccount}
          onSyncCalendarEvents={syncCalendarEvents}
          workspaceMembers={workspaceMembers}
          onMembersChange={setWorkspaceMembers}
          calendarConnections={calendarConnections}
          onUpdateSelectedCalendars={updateSelectedCalendars}
        />
      )}
    </>
  );
}
