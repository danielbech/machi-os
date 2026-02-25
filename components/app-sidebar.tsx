"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { useBacklog } from "@/lib/backlog-context";
import { useCalendar } from "@/lib/calendar-context";
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
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { CreateWorkspaceDialog } from "@/components/create-workspace-dialog";
import { LayoutDashboard, FolderKanban, Inbox, Settings, Check, ChevronDown, MessageSquarePlus, CalendarRange, Plus, Pencil, Mail } from "lucide-react";
import { PendingInvitesDialog } from "@/components/pending-invites-dialog";

export function AppSidebar() {
  const pathname = usePathname();
  const {
    userProjects, activeProjectId, setActiveProjectId, activeProject, user,
    transitionToNextWeek, refreshTeamMembers,
    weekMode, setWeekMode, transitionDay, transitionHour, setTransitionSchedule,
    refreshWorkspaces, pendingInvites,
  } = useWorkspace();
  const { backlogOpen, toggleBacklog } = useBacklog();
  const {
    googleCalendarConnected, connectGoogleCalendar, disconnectGoogleAccount,
    syncCalendarEvents, calendarConnections, updateSelectedCalendars,
  } = useCalendar();
  const { setOpenMobile } = useSidebar();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState("general");
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [logoError, setLogoError] = useState<Set<string>>(new Set());
  const [showInvites, setShowInvites] = useState(false);

  const handleLogoError = useCallback((projectId: string) => {
    setLogoError(prev => new Set(prev).add(projectId));
  }, []);

  const handleOpenSettings = async (tab = "general") => {
    setSettingsDefaultTab(tab);
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="cursor-pointer">
                    <div
                      className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg overflow-hidden transition-colors duration-200"
                      style={{ backgroundColor: activeProject?.color || '#FF3700' }}
                    >
                      {activeProject && (
                        activeProject.logo_url && !logoError.has(activeProject.id) ? (
                          <img
                            src={activeProject.logo_url}
                            alt={activeProject.name}
                            className="size-8 object-cover"
                            onError={() => handleLogoError(activeProject.id)}
                          />
                        ) : (
                          <img src="/logo-mark.svg" alt="Flowie" className="size-5" />
                        )
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 leading-none">
                      <span className="font-semibold">{activeProject?.name || "Flowie"}</span>
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
                        className="inline-flex w-5 h-5 rounded-md items-center justify-center overflow-hidden shrink-0"
                        style={{ backgroundColor: project.color || '#FF3700' }}
                      >
                        {project.logo_url && !logoError.has(project.id) ? (
                          <img
                            src={project.logo_url}
                            alt={project.name}
                            className="w-5 h-5 object-cover"
                            onError={() => handleLogoError(project.id)}
                          />
                        ) : (
                          <img src="/logo-mark.svg" alt="Flowie" className="size-3" />
                        )}
                      </span>
                      <span className={project.id === activeProjectId ? "font-semibold" : ""}>
                        {project.name}
                      </span>
                      {project.id === activeProjectId && (
                        <Check className="size-4 ml-auto text-white/60" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { handleOpenSettings("workspace"); setOpenMobile(false); }}
                    className="flex items-center gap-2"
                  >
                    <Pencil className="size-4" />
                    <span>Edit workspace</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowCreateWorkspace(true)}
                    className="flex items-center gap-2"
                  >
                    <Plus className="size-4" />
                    <span>New workspace</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                  <SidebarMenuButton asChild isActive={pathname === "/timeline"} tooltip="Timeline">
                    <Link href="/timeline" onClick={() => { if (backlogOpen) toggleBacklog(); setOpenMobile(false); }}>
                      <CalendarRange />
                      <span>Timeline</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/projects"} tooltip="Projects">
                    <Link href="/projects" onClick={() => { if (backlogOpen) toggleBacklog(); setOpenMobile(false); }}>
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
            {pendingInvites.length > 0 && (
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => { setShowInvites(true); setOpenMobile(false); }} tooltip="Invites">
                  <div className="relative">
                    <Mail />
                    <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">
                      {pendingInvites.length}
                    </span>
                  </div>
                  <span>Invites</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
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
          transitionDay={transitionDay}
          transitionHour={transitionHour}
          onSetTransitionSchedule={setTransitionSchedule}
          weekMode={weekMode}
          onWeekModeChange={setWeekMode}
          onProfileUpdate={refreshTeamMembers}
          activeProject={activeProject}
          refreshWorkspaces={refreshWorkspaces}
          userProjectCount={userProjects.length}
          defaultTab={settingsDefaultTab}
        />
      )}

      <CreateWorkspaceDialog
        open={showCreateWorkspace}
        onOpenChange={setShowCreateWorkspace}
      />

      <PendingInvitesDialog
        open={showInvites}
        onOpenChange={setShowInvites}
      />
    </>
  );
}
