"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { useProjectData } from "@/lib/project-data-context";
import { useBacklog } from "@/lib/backlog-context";
import { useCalendar } from "@/lib/calendar-context";
import { SettingsDialog } from "@/components/settings-dialog";
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
import { LayoutDashboard, FolderKanban, Inbox, Settings, GanttChart, MessageSquarePlus, Clock, FileText, DollarSign } from "lucide-react";

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const {
    activeProjectId, activeProject,
    transitionToNextWeek,
    weekMode, setWeekMode, transitionDay, transitionHour, setTransitionSchedule,
    showCheckmarks, setShowCheckmarks,
    boardColumns, triggerTaskRefresh,
    refreshWorkspace,
  } = useWorkspace();
  const { refreshTeamMembers, areaId } = useProjectData();
  const { backlogOpen, toggleBacklog } = useBacklog();
  const {
    googleCalendarConnected, connectGoogleCalendar, disconnectGoogleAccount,
    syncCalendarEvents, calendarConnections, updateSelectedCalendars, lastSyncedAt,
  } = useCalendar();
  const { setOpenMobile } = useSidebar();
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState("workspace");
  const [logoError, setLogoError] = useState(false);

  const handleOpenSettings = (tab = "workspace") => {
    setSettingsDefaultTab(tab);
    setShowSettings(true);
  };

  return (
    <>
      <Sidebar collapsible="icon" variant="sidebar">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" className="cursor-default" onClick={() => handleOpenSettings("workspace")}>
                <div
                  className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg overflow-hidden transition-colors duration-200"
                  style={{ backgroundColor: activeProject?.color || '#FF3700' }}
                >
                  {activeProject && (
                    activeProject.logo_url && !logoError ? (
                      <img
                        src={activeProject.logo_url}
                        alt={activeProject.name}
                        className="size-8 object-cover"
                        onError={() => setLogoError(true)}
                      />
                    ) : (
                      <img src="/logo-mark.svg" alt="Flowie" className="size-5" />
                    )
                  )}
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">{activeProject?.name || "Flowie"}</span>
                </div>
              </SidebarMenuButton>
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
                      <GanttChart />
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
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/hours"} tooltip="Hours">
                    <Link href="/hours" onClick={() => { if (backlogOpen) toggleBacklog(); setOpenMobile(false); }}>
                      <Clock />
                      <span>Hours</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/docs")} tooltip="Docs">
                    <Link href="/docs" onClick={() => { if (backlogOpen) toggleBacklog(); setOpenMobile(false); }}>
                      <FileText />
                      <span>Docs</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/finance"} tooltip="Finance">
                    <Link href="/finance" onClick={() => { if (backlogOpen) toggleBacklog(); setOpenMobile(false); }}>
                      <DollarSign />
                      <span>Finance</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname === "/feedback"} tooltip="Feedback">
                    <Link href="/feedback" onClick={() => { if (backlogOpen) toggleBacklog(); setOpenMobile(false); }}>
                      <MessageSquarePlus />
                      <span>Feedback</span>
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
          calendarConnections={calendarConnections}
          onUpdateSelectedCalendars={updateSelectedCalendars}
          onTransitionWeek={transitionToNextWeek}
          transitionDay={transitionDay}
          transitionHour={transitionHour}
          onSetTransitionSchedule={setTransitionSchedule}
          weekMode={weekMode}
          onWeekModeChange={setWeekMode}
          boardColumns={boardColumns}
          areaId={areaId}
          onTasksMigrated={triggerTaskRefresh}
          showCheckmarks={showCheckmarks}
          onShowCheckmarksChange={setShowCheckmarks}
          onProfileUpdate={refreshTeamMembers}
          activeProject={activeProject}
          lastSyncedAt={lastSyncedAt}
          refreshWorkspace={refreshWorkspace}
          defaultTab={settingsDefaultTab}
        />
      )}
    </>
  );
}
