"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { SettingsDialog } from "@/components/settings-dialog";
import type { WorkspaceMember } from "@/lib/supabase/workspace";
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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, FolderKanban, Inbox, Settings, Check, ChevronDown, MessageSquarePlus } from "lucide-react";

export function AppSidebar() {
  const pathname = usePathname();
  const {
    userProjects, activeProjectId, setActiveProjectId, activeProject, user,
    googleCalendarConnected, connectGoogleCalendar, disconnectGoogleAccount,
    syncCalendarEvents, calendarConnections, updateSelectedCalendars,
    backlogOpen, toggleBacklog, transitionToNextWeek, refreshTeamMembers,
  } = useWorkspace();
  const { setOpenMobile } = useSidebar();
  const [showSettings, setShowSettings] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);

  const handleOpenSettings = async () => {
    setShowSettings(true);
    if (activeProjectId) {
      try {
        const res = await fetch(`/api/workspace-members?projectId=${activeProjectId}`);
        if (res.ok) {
          const data = await res.json();
          setWorkspaceMembers(data.members);
        }
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
                        className="group flex aspect-square size-8 items-center justify-center rounded-lg"
                        style={{ backgroundColor: activeProject?.color || "#3b82f6" }}
                      >
                        <img src="/logo.svg" alt="Machi OS" className="size-6 invert transition-transform duration-200 group-hover:scale-110" />
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
                    className="group flex aspect-square size-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: activeProject?.color || "#3b82f6" }}
                  >
                    <img src="/logo.svg" alt="Machi OS" className="size-6 invert transition-transform duration-200 group-hover:scale-110" />
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
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/"} tooltip="Board">
                    <Link href="/" onClick={() => setOpenMobile(false)}>
                      <LayoutDashboard />
                      <span>Board</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive={backlogOpen} tooltip="Backlog" onClick={() => { toggleBacklog(); setOpenMobile(false); }}>
                    <Inbox />
                    <span>Backlog</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/projects"} tooltip="Projects">
                    <Link href="/projects" onClick={() => setOpenMobile(false)}>
                      <FolderKanban />
                      <span>Projects</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/feedback"} tooltip="Feedback">
                <Link href="/feedback" onClick={() => setOpenMobile(false)}>
                  <MessageSquarePlus />
                  <span>Feedback</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => { handleOpenSettings(); setOpenMobile(false); }} tooltip="Settings">
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
          onTransitionWeek={transitionToNextWeek}
          onProfileUpdate={refreshTeamMembers}
        />
      )}
    </>
  );
}
