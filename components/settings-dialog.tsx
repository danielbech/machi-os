"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { updateWorkspace } from "@/lib/supabase/workspace";
import { loadCurrentProfile, updateProfile, uploadAvatar } from "@/lib/supabase/profiles";
import { uploadWorkspaceLogo, deleteWorkspaceLogo } from "@/lib/supabase/storage";
import { WORKSPACE_COLORS } from "@/lib/colors";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/lib/theme-context";
import { countOrphanedTasks, migrateBoardTasks } from "@/lib/supabase/tasks-simple";
import type { WeekMode, Project, BoardColumn } from "@/lib/types";
import type { ConnectionWithCalendars } from "@/lib/calendar-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, X, ChevronDown, Camera, Trash2, GitCommitHorizontal, Check, Sun, Moon, Monitor } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  activeProjectId: string | null;
  googleCalendarConnected: boolean;
  onGoogleCalendarConnect: () => void;
  onDisconnectAccount: (connectionId: string) => Promise<void>;
  onSyncCalendarEvents: () => Promise<void>;
  // Multi-account calendar
  calendarConnections: ConnectionWithCalendars[];
  onUpdateSelectedCalendars: (connectionId: string, calendarIds: string[]) => Promise<void>;
  // Weekly transition
  onTransitionWeek: () => Promise<{ deleted: number; carriedOver: number }>;
  transitionDay: number;
  transitionHour: number;
  onSetTransitionSchedule: (day: number, hour: number) => Promise<void>;
  // Week mode
  weekMode: WeekMode;
  onWeekModeChange: (mode: WeekMode) => Promise<void>;
  boardColumns: BoardColumn[];
  areaId: string | null;
  onTasksMigrated?: () => void;
  // UI preferences
  showCheckmarks: boolean;
  onShowCheckmarksChange: (v: boolean) => void;
  // Profile updated callback
  onProfileUpdate?: () => void;
  // Workspace management
  activeProject?: Project;
  lastSyncedAt?: Date | null;
  refreshWorkspace?: () => Promise<void>;
  defaultTab?: string;
}

function ModeButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
        active
          ? "border-ring/30 bg-muted text-foreground"
          : "border-border text-muted-foreground hover:border-ring/20 hover:text-foreground"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function ThemePreview({ theme, mode }: { theme: typeof THEMES[number]; mode: "light" | "dark" }) {
  const v = mode === "dark" ? theme.darkVariables : theme.lightVariables;
  const fontFamily = theme.sharedVariables?.["--font-sans"];
  return (
    <div className="rounded-md h-20 w-full overflow-hidden flex" style={{ backgroundColor: v["--background"], ...(fontFamily ? { fontFamily } : {}) }}>
      {/* Sidebar strip */}
      <div className="w-5 shrink-0 flex flex-col items-center gap-1 pt-2" style={{ backgroundColor: v["--sidebar"], borderRight: `1px solid ${v["--border"]}` }}>
        <div className="size-2 rounded-sm" style={{ backgroundColor: v["--sidebar-primary"] }} />
        <div className="size-2 rounded-sm" style={{ backgroundColor: v["--sidebar-accent"] }} />
      </div>
      {/* Main area */}
      <div className="flex-1 p-1.5 flex flex-col gap-1">
        {/* Card */}
        <div className="flex-1 rounded-sm p-1.5 flex flex-col gap-1" style={{ backgroundColor: v["--card"], border: `1px solid ${v["--border"]}` }}>
          <div className="h-1 w-10 rounded-full" style={{ backgroundColor: v["--foreground"], opacity: 0.7 }} />
          <div className="h-1 w-6 rounded-full" style={{ backgroundColor: v["--muted-foreground"], opacity: 0.5 }} />
        </div>
        {/* Bottom row: button + accent */}
        <div className="flex items-center gap-1">
          <div className="h-3 px-1.5 rounded-sm flex items-center" style={{ backgroundColor: v["--primary"] }}>
            <div className="h-1 w-4 rounded-full" style={{ backgroundColor: v["--primary-foreground"] }} />
          </div>
          <div className="flex-1" />
          <div className="size-2 rounded-full" style={{ backgroundColor: v["--ring"] }} />
        </div>
      </div>
    </div>
  );
}

function ThemeTabContent({ activeProject }: { activeProject?: Project }) {
  const { globalThemeId, setGlobalTheme, mode, resolvedMode, setMode } = useTheme();
  const activeId = globalThemeId;

  return (
    <TabsContent value="theme" className="flex-1 min-h-0 overflow-y-auto">
      <div className="space-y-6 py-4">
        {/* Mode toggle */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Appearance</h3>
          <div className="flex gap-2">
            <ModeButton active={mode === "light"} onClick={() => setMode("light")} icon={Sun} label="Light" />
            <ModeButton active={mode === "dark"} onClick={() => setMode("dark")} icon={Moon} label="Dark" />
            <ModeButton active={mode === "system"} onClick={() => setMode("system")} icon={Monitor} label="System" />
          </div>
        </div>

        {/* Theme heading */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Colour theme</h3>
        </div>

        {/* Theme grid */}
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map((theme) => {
            const isActive = theme.id === activeId;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => setGlobalTheme(theme.id)}
                className={`group relative rounded-lg border p-1 transition-colors text-left ${
                  isActive
                    ? "border-ring/30 bg-muted"
                    : "border-border hover:border-ring/20"
                }`}
              >
                <ThemePreview theme={theme} mode={resolvedMode} />
                <div className="flex items-center justify-between px-1 py-1.5">
                  <span className="text-xs text-foreground/70">{theme.name}</span>
                  {isActive && <Check className="size-3 text-foreground/50" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </TabsContent>
  );
}

export function SettingsDialog({
  open,
  onOpenChange,
  user,
  activeProjectId,
  googleCalendarConnected,
  onGoogleCalendarConnect,
  onDisconnectAccount,
  onSyncCalendarEvents,
  calendarConnections,
  onUpdateSelectedCalendars,
  onTransitionWeek,
  transitionDay,
  transitionHour,
  onSetTransitionSchedule,
  weekMode,
  onWeekModeChange,
  boardColumns,
  areaId,
  onTasksMigrated,
  showCheckmarks,
  onShowCheckmarksChange,
  onProfileUpdate,
  activeProject,
  lastSyncedAt,
  refreshWorkspace,
  defaultTab = "workspace",
}: SettingsDialogProps) {
  const [settingsTab, setSettingsTab] = useState(defaultTab);
  const [syncing, setSyncing] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionResult, setTransitionResult] = useState<string | null>(null);
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());

  // Profile state
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileInitials, setProfileInitials] = useState("");
  const [profileColor, setProfileColor] = useState("bg-blue-500");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Workspace settings state
  const [wsName, setWsName] = useState("");
  const [wsColor, setWsColor] = useState("");
  const [wsLogo, setWsLogo] = useState<string | undefined>(undefined);
  const [wsLogoUploading, setWsLogoUploading] = useState(false);
  const wsLogoInputRef = useRef<HTMLInputElement>(null);
  const [wsSaving, setWsSaving] = useState(false);
  // Delete account state
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // Mode switch confirmation state
  const [modeSwitchPending, setModeSwitchPending] = useState<WeekMode | null>(null);
  const [modeSwitchTaskCount, setModeSwitchTaskCount] = useState(0);
  const [modeSwitchLoading, setModeSwitchLoading] = useState(false);
  const [modeSwitchDescription, setModeSwitchDescription] = useState("");

  // About tab state
  const [commitCount, setCommitCount] = useState<number | null>(null);

  // Reset tab when dialog opens
  useEffect(() => {
    if (open) setSettingsTab(defaultTab);
  }, [open, defaultTab]);

  // Fetch commit count when about tab is shown
  useEffect(() => {
    if (!open || settingsTab !== "about" || commitCount !== null) return;

    fetch("https://api.github.com/repos/danielbech/machi-os/commits?per_page=1", { method: "HEAD" })
      .then((res) => {
        const link = res.headers.get("link");
        if (link) {
          const match = link.match(/[&?]page=(\d+)>;\s*rel="last"/);
          if (match) setCommitCount(parseInt(match[1], 10));
        }
      })
      .catch(() => {});
  }, [open, settingsTab, commitCount]);

  // Sync workspace settings when dialog opens or active project changes
  useEffect(() => {
    if (open && activeProject) {
      setWsName(activeProject.name);
      setWsColor(activeProject.color);
      setWsLogo(activeProject.logo_url);
    }
  }, [open, activeProject]);

  // Load profile when dialog opens
  useEffect(() => {
    if (!open || !user) return;

    loadCurrentProfile(user.id).then((profile) => {
      if (profile) {
        setProfileDisplayName(profile.display_name);
        setProfileInitials(profile.initials);
        setProfileColor(profile.color);
        setProfileAvatarUrl(profile.avatar_url);
      }
    });
  }, [open, user]);

  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setAvatarUploading(true);
    try {
      const url = await uploadAvatar(file, user.id);
      await updateProfile(user.id, { avatar_url: url });
      setProfileAvatarUrl(url);
      onProfileUpdate?.();
    } catch (err) {
      console.error('Avatar upload failed:', err);
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
      // Reset input so re-selecting the same file triggers onChange
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleProfileSave = async () => {
    if (!user) return;
    setProfileSaving(true);
    try {
      await updateProfile(user.id, {
        display_name: profileDisplayName,
        initials: profileInitials,
      });
      onProfileUpdate?.();
    } catch (err) {
      console.error('Profile save failed:', err);
      toast.error("Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleWsLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProjectId) return;

    setWsLogoUploading(true);
    try {
      const url = await uploadWorkspaceLogo(file, activeProjectId);
      await updateWorkspace(activeProjectId, { logo_url: url });
      setWsLogo(url);
      await refreshWorkspace?.();
    } catch (err) {
      console.error('Logo upload failed:', err);
      toast.error("Failed to upload logo");
    } finally {
      setWsLogoUploading(false);
      if (wsLogoInputRef.current) wsLogoInputRef.current.value = '';
    }
  };

  const handleWsLogoRemove = async () => {
    if (!activeProjectId || !wsLogo) return;

    setWsLogoUploading(true);
    try {
      await deleteWorkspaceLogo(wsLogo);
      await updateWorkspace(activeProjectId, { logo_url: null });
      setWsLogo(undefined);
      await refreshWorkspace?.();
    } catch (err) {
      console.error('Logo remove failed:', err);
      toast.error("Failed to remove logo");
    } finally {
      setWsLogoUploading(false);
    }
  };

  const handleToggleCalendar = async (connectionId: string, calendarId: string) => {
    const conn = calendarConnections.find(c => c.id === connectionId);
    if (!conn) return;

    const isSelected = conn.selected_calendars.includes(calendarId);
    let newSelection: string[];
    if (isSelected) {
      newSelection = conn.selected_calendars.filter(id => id !== calendarId);
      if (newSelection.length === 0) return;
    } else {
      newSelection = [...conn.selected_calendars, calendarId];
    }
    await onUpdateSelectedCalendars(connectionId, newSelection);
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await onSyncCalendarEvents();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[550px] overflow-hidden flex flex-col max-h-[85vh]"
        overlayClassName={settingsTab === "theme" ? "opacity-0" : ""}
      >
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs value={settingsTab} onValueChange={setSettingsTab} className="flex-1 min-h-0 flex flex-col">
          <TabsList variant="line" className="border-b border-border px-0">
            <TabsTrigger value="workspace" className="text-muted-foreground data-[state=active]:text-foreground">Flowie</TabsTrigger>
            <TabsTrigger value="general" className="text-muted-foreground data-[state=active]:text-foreground">General</TabsTrigger>
            <TabsTrigger value="calendar" className="text-muted-foreground data-[state=active]:text-foreground">Integrations</TabsTrigger>
            <TabsTrigger value="theme" className="text-muted-foreground data-[state=active]:text-foreground">Theme</TabsTrigger>
            <TabsTrigger value="about" className="text-muted-foreground data-[state=active]:text-foreground">About</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-6 py-4">
              {/* Profile */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Profile</h3>
                <div className="p-3 rounded-lg border border-border bg-muted/50 space-y-4">
                  {/* Avatar */}
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      className="relative group shrink-0"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarUploading}
                      aria-label="Change avatar"
                    >
                      {profileAvatarUrl ? (
                        <img
                          src={profileAvatarUrl}
                          alt={profileDisplayName}
                          className="w-14 h-14 rounded-full object-cover"
                        />
                      ) : (
                        <div className={`w-14 h-14 rounded-full ${profileColor} flex items-center justify-center text-white font-medium text-lg`}>
                          {profileInitials || '?'}
                        </div>
                      )}
                      <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="size-4 text-white" />
                      </div>
                      {avatarUploading && (
                        <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                          <RefreshCw className="size-4 text-white animate-spin" />
                        </div>
                      )}
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarSelect}
                    />
                    <div className="flex-1 space-y-2">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Display name</label>
                        <Input
                          value={profileDisplayName}
                          onChange={(e) => setProfileDisplayName(e.target.value)}
                          placeholder="Your name"
                          className="h-8"
                        />
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full justify-center border border-border"
                    disabled={profileSaving}
                    onClick={handleProfileSave}
                  >
                    {profileSaving ? 'Saving...' : 'Save profile'}
                  </Button>
                </div>
              </div>

              {/* Account */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Account</h3>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                  <div>
                    <div className="text-sm font-medium">Sign Out</div>
                    <div className="text-xs text-muted-foreground">
                      {user?.email || 'Not signed in'}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={async () => {
                      try {
                        const supabase = createClient();
                        const { error } = await supabase.auth.signOut();
                        if (error) {
                          console.error('Sign out error:', error);
                          toast.error("Failed to sign out");
                        } else {
                          onOpenChange(false);
                        }
                      } catch (err) {
                        console.error('Sign out failed:', err);
                        toast.error("Failed to sign out");
                      }
                    }}
                  >
                    Sign Out
                  </Button>
                </div>

                {/* Delete Account */}
                <div className="text-xs text-muted-foreground px-1 pt-2">Danger zone</div>
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/[0.03] space-y-3">
                  <div className="flex items-center gap-2">
                    <Trash2 className="size-4 text-red-400 shrink-0" />
                    <div>
                      <div className="text-sm font-medium text-red-400">Delete account</div>
                      <div className="text-xs text-muted-foreground">
                        Permanently delete your account and all associated data. This cannot be undone.
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Type <span className="font-mono text-foreground/60">{user?.email}</span> to confirm
                    </label>
                    <Input
                      value={deleteAccountConfirm}
                      onChange={(e) => setDeleteAccountConfirm(e.target.value)}
                      placeholder={user?.email || ""}
                      className="h-8"
                    />
                  </div>
                  {deleteAccountError && <div className="text-xs text-red-400">{deleteAccountError}</div>}
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    disabled={deletingAccount || deleteAccountConfirm !== user?.email}
                    onClick={async () => {
                      setDeletingAccount(true);
                      setDeleteAccountError(null);
                      try {
                        const res = await fetch("/api/delete-account", { method: "DELETE" });
                        const data = await res.json();
                        if (!res.ok) {
                          setDeleteAccountError(data.error || "Failed to delete account");
                          return;
                        }
                        // Clear all app state so re-signup starts fresh
                        localStorage.removeItem("flowie-active-project");
                        localStorage.removeItem("flowie-welcome-seen");
                        localStorage.removeItem("flowie-filter-mine");
                        localStorage.removeItem("flowie-hide-completed");
                        localStorage.removeItem("flowie-last-transition");
                        const supabase = createClient();
                        await supabase.auth.signOut();
                        onOpenChange(false);
                      } catch {
                        setDeleteAccountError("Network error");
                      } finally {
                        setDeletingAccount(false);
                      }
                    }}
                  >
                    {deletingAccount ? "Deleting..." : "Delete account permanently"}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3 py-4">
              {/* Connected accounts header + sync */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-xs text-muted-foreground">Connected accounts</div>
                  {lastSyncedAt && (
                    <div className="text-[10px] text-foreground/20">
                      synced {Math.max(0, Math.floor((Date.now() - lastSyncedAt.getTime()) / 60000))} min ago
                    </div>
                  )}
                </div>
                {googleCalendarConnected && (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={handleSyncNow}
                    disabled={syncing}
                    aria-label="Sync all accounts"
                  >
                    <RefreshCw className={`size-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  </Button>
                )}
              </div>

              {/* Connected accounts */}
              {calendarConnections.map((conn) => {
                const isExpanded = expandedConnections.has(conn.id);
                const selectedCount = conn.selected_calendars.length;
                const totalCount = conn.availableCalendars.length;

                return (
                  <div key={conn.id} className="rounded-lg border border-border bg-muted/50 overflow-hidden">
                    <div className="flex items-center justify-between p-3">
                      <button
                        type="button"
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        onClick={() => {
                          setExpandedConnections(prev => {
                            const next = new Set(prev);
                            if (next.has(conn.id)) next.delete(conn.id);
                            else next.add(conn.id);
                            return next;
                          });
                        }}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted shrink-0">
                          <img src="/google-calendar.svg" alt="Google Calendar" className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{conn.google_email || 'Google Account'}</div>
                          <div className="text-xs text-muted-foreground">
                            {totalCount > 0
                              ? `${selectedCount} of ${totalCount} calendars`
                              : conn.selected_calendars.length > 0
                                ? `${conn.selected_calendars.length} calendars synced`
                                : 'Connected'}
                          </div>
                        </div>
                        {totalCount > 0 && (
                          <ChevronDown className={`size-3.5 text-foreground/30 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                      </button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="text-foreground/30 hover:text-red-400 hover:bg-red-500/10 ml-2 shrink-0"
                        onClick={() => onDisconnectAccount(conn.id)}
                        aria-label={`Disconnect ${conn.google_email}`}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>

                    {/* Collapsible calendar picker */}
                    {isExpanded && conn.availableCalendars.length > 0 && (
                      <div className="border-t border-border p-3 space-y-2">
                        {conn.availableCalendars.map((cal) => (
                          <label
                            key={cal.id}
                            className="flex items-center gap-2.5 py-1 cursor-pointer group"
                          >
                            <input
                              type="checkbox"
                              checked={conn.selected_calendars.includes(cal.id)}
                              onChange={() => handleToggleCalendar(conn.id, cal.id)}
                              className="sr-only peer"
                            />
                            <div className="flex items-center justify-center w-4 h-4 rounded border border-border peer-checked:bg-primary peer-checked:border-primary transition-colors">
                              {conn.selected_calendars.includes(cal.id) && (
                                <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cal.backgroundColor }}
                            />
                            <span className="text-sm text-foreground/70 group-hover:text-foreground/90 truncate">
                              {cal.summary}
                              {cal.primary && <span className="text-foreground/30 ml-1">(primary)</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add account button */}
              <Button
                size="sm"
                variant="ghost"
                className="w-full justify-center gap-2 border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-ring/30"
                onClick={onGoogleCalendarConnect}
              >
                <Plus className="size-3.5" />
                {googleCalendarConnected ? 'Add another Google account' : 'Connect Google Calendar'}
              </Button>
            </div>
          </TabsContent>

          {/* Flowie Tab */}
          <TabsContent value="workspace" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3 py-4">
              {/* Project settings */}
              {activeProject && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground px-1">Project settings</div>
                  <div className="p-3 rounded-lg border border-border bg-muted/50 space-y-3">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="relative group shrink-0 cursor-pointer"
                        onClick={() => wsLogoInputRef.current?.click()}
                        disabled={wsLogoUploading}
                        aria-label="Change logo"
                      >
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden"
                          style={{ backgroundColor: wsColor || activeProject?.color || '#FF3700' }}
                        >
                          {wsLogo ? (
                            <img src={wsLogo} alt="Logo" className="w-full h-full object-cover" />
                          ) : (
                            <img src="/logo-mark.svg" alt="Flowie" className="size-7" />
                          )}
                        </div>
                        <div className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Camera className="size-4 text-white" />
                        </div>
                        {wsLogoUploading && (
                          <div className="absolute inset-0 rounded-lg bg-black/60 flex items-center justify-center">
                            <RefreshCw className="size-4 text-white animate-spin" />
                          </div>
                        )}
                      </button>
                      <input
                        ref={wsLogoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleWsLogoSelect}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted-foreground">Logo</div>
                        <button
                          type="button"
                          className="text-xs text-foreground/50 hover:text-foreground/80 transition-colors cursor-pointer flex items-center gap-1"
                          onClick={() => wsLogoInputRef.current?.click()}
                          disabled={wsLogoUploading}
                        >
                          <Camera className="size-3" />
                          <span>Upload image</span>
                        </button>
                      </div>
                      {wsLogo && (
                        <Button
                          size="sm"
                          variant="destructive-ghost"
                          className="shrink-0"
                          disabled={wsLogoUploading}
                          onClick={handleWsLogoRemove}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Name</label>
                      <Input
                        value={wsName}
                        onChange={(e) => setWsName(e.target.value)}
                        placeholder="Name"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Color</label>
                      <div className="flex gap-2 flex-wrap">
                        {WORKSPACE_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={async () => {
                              setWsColor(c);
                              if (!activeProjectId || c === activeProject.color) return;
                              try {
                                await updateWorkspace(activeProjectId, { color: c });
                                await refreshWorkspace?.();
                              } catch (err) {
                                console.error("Failed to update color:", err);
                                toast.error("Failed to update color");
                                setWsColor(activeProject.color);
                              }
                            }}
                            className="w-6 h-6 rounded-full transition-all"
                            style={{
                              backgroundColor: c,
                              outline: wsColor === c ? "2px solid white" : "2px solid transparent",
                              outlineOffset: "2px",
                            }}
                            aria-label={`Select color ${c}`}
                          />
                        ))}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full justify-center border border-border"
                      disabled={wsSaving || !wsName.trim() || wsName === activeProject.name}
                      onClick={async () => {
                        if (!activeProjectId) return;
                        setWsSaving(true);
                        try {
                          await updateWorkspace(activeProjectId, { name: wsName.trim() });
                          await refreshWorkspace?.();
                        } catch (err) {
                          console.error("Failed to save:", err);
                          toast.error("Failed to save");
                        } finally {
                          setWsSaving(false);
                        }
                      }}
                    >
                      {wsSaving ? "Saving..." : "Save name"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Board View */}
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground px-1">Board view</div>
                <div className="p-3 rounded-lg border border-border bg-muted/50 space-y-3">
                  <div className="flex gap-1 p-1 rounded-lg bg-muted">
                    {(["5-day", "7-day", "rolling", "custom"] as WeekMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={modeSwitchLoading}
                        onClick={async () => {
                          if (mode === weekMode) return;
                          const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                          const weekdaySet = new Set(weekdays);
                          const weekendSet = new Set(['saturday', 'sunday']);
                          const isISODate = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day);

                          // Determine which tasks would be orphaned
                          let orphanFilter: ((day: string) => boolean) | null = null;
                          let description = "";

                          if (weekMode === "custom" && mode !== "custom") {
                            // Custom → weekly/rolling: tasks with UUID day values get orphaned
                            orphanFilter = (day) => !weekdaySet.has(day) && !isISODate(day);
                            description = mode === "rolling" ? "Move tasks to today" : "Move tasks to Monday";
                          } else if (weekMode !== "custom" && mode === "custom") {
                            // Weekly/rolling → custom: tasks with weekday/ISO day values get orphaned
                            orphanFilter = (day) => weekdaySet.has(day) || isISODate(day);
                            description = "Move tasks to first column";
                          } else if (weekMode === "rolling" && (mode === "5-day" || mode === "7-day")) {
                            // Rolling → weekly: ISO date tasks get orphaned
                            orphanFilter = (day) => isISODate(day);
                            description = "Move tasks to Monday";
                          } else if ((weekMode === "5-day" || weekMode === "7-day") && mode === "rolling") {
                            // Weekly → rolling: weekday-named tasks get orphaned
                            orphanFilter = (day) => weekdaySet.has(day);
                            description = "Move tasks to today";
                          } else if (weekMode === "7-day" && mode === "5-day") {
                            // 7-day → 5-day: only weekend tasks get orphaned
                            orphanFilter = (day) => weekendSet.has(day);
                            description = "Move weekend tasks to Friday";
                          }

                          // 5-day → 7-day is always safe (only adds days)
                          if (!orphanFilter) {
                            onWeekModeChange(mode);
                            return;
                          }

                          const count = await countOrphanedTasks(activeProjectId!, orphanFilter, areaId);
                          if (count === 0) {
                            onWeekModeChange(mode);
                            return;
                          }
                          setModeSwitchTaskCount(count);
                          setModeSwitchDescription(description);
                          setModeSwitchPending(mode);
                        }}
                        className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          weekMode === mode
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:text-foreground/60"
                        }`}
                      >
                        {mode === "5-day" ? "5-day" : mode === "7-day" ? "7-day" : mode === "rolling" ? "Rolling" : "Custom"}
                      </button>
                    ))}
                  </div>

                  {/* Mode switch confirmation */}
                  {modeSwitchPending && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                      <div className="text-sm text-amber-200/90">
                        You have <span className="font-semibold text-amber-100">{modeSwitchTaskCount} task{modeSwitchTaskCount !== 1 ? "s" : ""}</span> that won&apos;t be visible. What would you like to do?
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex-1 border border-border"
                          disabled={modeSwitchLoading}
                          onClick={async () => {
                            setModeSwitchLoading(true);
                            try {
                              await onWeekModeChange(modeSwitchPending);
                            } finally {
                              setModeSwitchPending(null);
                              setModeSwitchLoading(false);
                            }
                          }}
                        >
                          Clean slate
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                          disabled={modeSwitchLoading}
                          onClick={async () => {
                            setModeSwitchLoading(true);
                            try {
                              const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                              const weekdaySet = new Set(weekdays);
                              const weekendSet = new Set(['saturday', 'sunday']);
                              const isISODate = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day);
                              const { getTodayISO } = await import("@/lib/date-utils");

                              if (weekMode !== "custom" && modeSwitchPending === "custom") {
                                // Weekly/rolling → custom
                                await onWeekModeChange(modeSwitchPending);
                                const { loadBoardColumns } = await import("@/lib/supabase/board-columns");
                                const cols = await loadBoardColumns(activeProjectId!);
                                if (cols.length > 0) {
                                  const migrated = await migrateBoardTasks(
                                    activeProjectId!, (day) => weekdaySet.has(day) || isISODate(day), cols[0].id, areaId
                                  );
                                  toast.success(`Moved ${migrated} task${migrated !== 1 ? "s" : ""} to ${cols[0].title}`);
                                }
                              } else if (weekMode === "custom" && modeSwitchPending !== "custom") {
                                // Custom → weekly/rolling
                                const targetDay = modeSwitchPending === "rolling" ? getTodayISO() : "monday";
                                await onWeekModeChange(modeSwitchPending);
                                const migrated = await migrateBoardTasks(
                                  activeProjectId!, (day) => !weekdaySet.has(day) && !isISODate(day), targetDay, areaId
                                );
                                toast.success(`Moved ${migrated} task${migrated !== 1 ? "s" : ""} to ${modeSwitchPending === "rolling" ? "today" : "Monday"}`);
                              } else if (weekMode === "rolling" && (modeSwitchPending === "5-day" || modeSwitchPending === "7-day")) {
                                // Rolling → weekly: move ISO date tasks to Monday
                                await onWeekModeChange(modeSwitchPending);
                                const migrated = await migrateBoardTasks(
                                  activeProjectId!, (day) => isISODate(day), "monday", areaId
                                );
                                toast.success(`Moved ${migrated} task${migrated !== 1 ? "s" : ""} to Monday`);
                              } else if ((weekMode === "5-day" || weekMode === "7-day") && modeSwitchPending === "rolling") {
                                // Weekly → rolling: move weekday-named tasks to today
                                await onWeekModeChange(modeSwitchPending);
                                const migrated = await migrateBoardTasks(
                                  activeProjectId!, (day) => weekdaySet.has(day), getTodayISO(), areaId
                                );
                                toast.success(`Moved ${migrated} task${migrated !== 1 ? "s" : ""} to today`);
                              } else if (weekMode === "7-day" && modeSwitchPending === "5-day") {
                                // 7-day → 5-day: move weekend tasks to Friday
                                await onWeekModeChange(modeSwitchPending);
                                const migrated = await migrateBoardTasks(
                                  activeProjectId!, (day) => weekendSet.has(day), "friday", areaId
                                );
                                toast.success(`Moved ${migrated} task${migrated !== 1 ? "s" : ""} to Friday`);
                              }
                              onTasksMigrated?.();
                            } catch (err) {
                              toast.error("Failed to migrate tasks");
                            } finally {
                              setModeSwitchPending(null);
                              setModeSwitchLoading(false);
                            }
                          }}
                        >
                          {modeSwitchLoading ? "Moving..." : modeSwitchDescription}
                        </Button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModeSwitchPending(null)}
                        className="text-xs text-foreground/30 hover:text-foreground/50 transition-colors"
                        disabled={modeSwitchLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  <div className="border-t border-border pt-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm">Show checkmarks</div>
                      <div className="text-xs text-muted-foreground">Display completion checkmarks on task cards</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onShowCheckmarksChange(!showCheckmarks)}
                      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
                        showCheckmarks ? "bg-primary" : "bg-muted"
                      }`}
                      aria-label="Toggle checkmarks"
                    >
                      <span className={`pointer-events-none inline-block size-4 rounded-full bg-foreground shadow-sm transition-transform ${
                        showCheckmarks ? "translate-x-[18px]" : "translate-x-0.5"
                      }`} style={{ marginTop: '2px' }} />
                    </button>
                  </div>
                  {weekMode !== "custom" && weekMode !== "rolling" && (
                    <>
                      <div className="border-t border-border pt-3">
                        <div className="text-xs text-muted-foreground mb-2">Week transition</div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-foreground/50">Auto-transition:</span>
                          <select
                            value={transitionDay}
                            onChange={(e) => onSetTransitionSchedule(Number(e.target.value), transitionHour)}
                            className="px-2 py-1 rounded-md border border-border bg-input text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
                          >
                            <option value={1}>Monday</option>
                            <option value={2}>Tuesday</option>
                            <option value={3}>Wednesday</option>
                            <option value={4}>Thursday</option>
                            <option value={5}>Friday</option>
                            <option value={6}>Saturday</option>
                            <option value={0}>Sunday</option>
                          </select>
                          <span className="text-xs text-foreground/50">at</span>
                          <select
                            value={transitionHour}
                            onChange={(e) => onSetTransitionSchedule(transitionDay, Number(e.target.value))}
                            className="px-2 py-1 rounded-md border border-border bg-input text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring/30"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full justify-center border border-border"
                        disabled={transitioning}
                        onClick={async () => {
                          setTransitioning(true);
                          setTransitionResult(null);
                          try {
                            const result = await onTransitionWeek();
                            setTransitionResult(`Archived ${result.deleted} tasks, carried over ${result.carriedOver}`);
                          } catch {
                            setTransitionResult("Failed to transition");
                          } finally {
                            setTransitioning(false);
                          }
                        }}
                      >
                        {transitioning ? "Transitioning..." : "Transition to next week"}
                      </Button>
                      {transitionResult && (
                        <div className="text-xs text-foreground/60">{transitionResult}</div>
                      )}
                    </>
                  )}
                </div>
              </div>

            </div>
          </TabsContent>
          {/* Theme Tab */}
          <ThemeTabContent activeProject={activeProject} />

          {/* About Tab */}
          <TabsContent value="about" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-6 py-4">
              <div className="space-y-3">
                <p className="text-sm text-foreground/60 leading-relaxed">
                  Flowie is a product of{" "}
                  <a
                    href="https://oimachi.co"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                  >
                    Oimachi
                  </a>
                  , initially built to create better workflows and stay in the flow internally.
                </p>
              </div>

              {/* Commit count & days since first commit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-border bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                      <GitCommitHorizontal className="size-5 text-foreground/50" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold tabular-nums">
                        {commitCount !== null ? commitCount.toLocaleString() : (
                          <span className="inline-block w-12 h-7 bg-muted rounded animate-pulse" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">commits shipped</div>
                    </div>
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                      <span className="text-lg">🗓️</span>
                    </div>
                    <div>
                      <div className="text-2xl font-bold tabular-nums">
                        {Math.floor((Date.now() - new Date("2026-02-15").getTime()) / 86400000)}
                      </div>
                      <div className="text-xs text-muted-foreground">days since first commit</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
