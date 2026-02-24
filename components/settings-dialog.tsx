"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { removeUserFromWorkspace, getPendingInvites, cancelInvite, updateWorkspace, type WorkspaceMember } from "@/lib/supabase/workspace";
import { loadCurrentProfile, updateProfile, uploadAvatar } from "@/lib/supabase/profiles";
import { uploadWorkspaceLogo, deleteWorkspaceLogo } from "@/lib/supabase/storage";
import { WORKSPACE_COLORS } from "@/lib/colors";
import type { PendingInvite, WeekMode, Project } from "@/lib/types";
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
import { Calendar, RefreshCw, Plus, X, ChevronDown, Camera, User as UserIcon, Trash2, Blocks } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  activeProjectId: string | null;
  googleCalendarConnected: boolean;
  onGoogleCalendarConnect: () => void;
  onDisconnectAccount: (connectionId: string) => Promise<void>;
  onSyncCalendarEvents: () => Promise<void>;
  workspaceMembers: WorkspaceMember[];
  onMembersChange: (members: WorkspaceMember[]) => void;
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
  // Profile updated callback
  onProfileUpdate?: () => void;
  // Workspace management
  activeProject?: Project;
  refreshWorkspaces?: () => Promise<void>;
  userProjectCount: number;
  defaultTab?: string;
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
  workspaceMembers,
  onMembersChange,
  calendarConnections,
  onUpdateSelectedCalendars,
  onTransitionWeek,
  transitionDay,
  transitionHour,
  onSetTransitionSchedule,
  weekMode,
  onWeekModeChange,
  onProfileUpdate,
  activeProject,
  refreshWorkspaces,
  userProjectCount,
  defaultTab = "general",
}: SettingsDialogProps) {
  const [settingsTab, setSettingsTab] = useState(defaultTab);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
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
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reset tab when dialog opens
  useEffect(() => {
    if (open) setSettingsTab(defaultTab);
  }, [open, defaultTab]);

  // Sync workspace settings when dialog opens or active project changes
  useEffect(() => {
    if (open && activeProject) {
      setWsName(activeProject.name);
      setWsColor(activeProject.color);
      setWsLogo(activeProject.logo_url);
      setDeleteConfirmName("");
      setDeleteError(null);
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
      await refreshWorkspaces?.();
    } catch (err) {
      console.error('Workspace logo upload failed:', err);
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
      await refreshWorkspaces?.();
    } catch (err) {
      console.error('Workspace logo remove failed:', err);
      toast.error("Failed to remove logo");
    } finally {
      setWsLogoUploading(false);
    }
  };

  // Load pending invites when dialog opens
  useEffect(() => {
    if (!open || !activeProjectId) return;

    getPendingInvites(activeProjectId).then(setPendingInvites);
  }, [open, activeProjectId]);

  // Clear message after 4 seconds
  useEffect(() => {
    if (!inviteMessage) return;
    const timeout = setTimeout(() => setInviteMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [inviteMessage]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !activeProjectId) return;

    setInviteLoading(true);
    setInviteMessage(null);

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          projectId: activeProjectId,
          role: inviteRole,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setInviteMessage({ type: 'error', text: data.error || 'Failed to invite' });
        return;
      }

      setInviteMessage({ type: 'success', text: data.message });
      setInviteEmail('');

      // Refresh pending invites
      const invites = await getPendingInvites(activeProjectId);
      setPendingInvites(invites);
    } catch {
      setInviteMessage({ type: 'error', text: 'Network error' });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      await cancelInvite(inviteId);
      setPendingInvites(pendingInvites.filter(i => i.id !== inviteId));
    } catch {
      toast.error("Failed to cancel invite");
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
      <DialogContent className="sm:max-w-[550px] overflow-hidden flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <Tabs value={settingsTab} onValueChange={setSettingsTab} className="flex-1 min-h-0 flex flex-col">
          <TabsList variant="line" className="border-b border-white/5 px-0">
            <TabsTrigger value="general" className="text-white/40 data-[state=active]:text-white after:bg-white">General</TabsTrigger>
            <TabsTrigger value="workspace" className="text-white/40 data-[state=active]:text-white after:bg-white">Workspace</TabsTrigger>
            <TabsTrigger value="calendar" className="text-white/40 data-[state=active]:text-white after:bg-white">Calendar</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-6 py-4">
              {/* Profile */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Profile</h3>
                <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02] space-y-4">
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
                        <label className="text-xs text-white/40 block mb-1">Display name</label>
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
                    className="w-full justify-center border border-white/10"
                    disabled={profileSaving}
                    onClick={handleProfileSave}
                  >
                    {profileSaving ? 'Saving...' : 'Save profile'}
                  </Button>
                </div>
              </div>

              {/* Week Mode */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Week Mode</h3>
                <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02] space-y-3">
                  <div className="text-xs text-white/40">
                    Choose how many days to show on the board.
                  </div>
                  <div className="flex gap-1 p-1 rounded-lg bg-white/[0.04]">
                    <button
                      type="button"
                      onClick={() => onWeekModeChange("5-day")}
                      className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        weekMode === "5-day"
                          ? "bg-white/10 text-white"
                          : "text-white/40 hover:text-white/60"
                      }`}
                    >
                      5-day work week
                    </button>
                    <button
                      type="button"
                      onClick={() => onWeekModeChange("7-day")}
                      className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        weekMode === "7-day"
                          ? "bg-white/10 text-white"
                          : "text-white/40 hover:text-white/60"
                      }`}
                    >
                      7-day full week
                    </button>
                  </div>
                </div>
              </div>

              {/* Week Transition */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Week Transition</h3>
                <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02] space-y-3">
                  <div className="text-xs text-white/40">
                    Archive completed tasks and move incomplete tasks to Monday.
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">Auto-transition:</span>
                    <select
                      value={transitionDay}
                      onChange={(e) => onSetTransitionSchedule(Number(e.target.value), transitionHour)}
                      className="px-2 py-1 rounded-md border border-white/10 bg-white/[0.02] text-sm outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
                    >
                      <option value={1}>Monday</option>
                      <option value={2}>Tuesday</option>
                      <option value={3}>Wednesday</option>
                      <option value={4}>Thursday</option>
                      <option value={5}>Friday</option>
                      <option value={6}>Saturday</option>
                      <option value={0}>Sunday</option>
                    </select>
                    <span className="text-xs text-white/50">at</span>
                    <select
                      value={transitionHour}
                      onChange={(e) => onSetTransitionSchedule(transitionDay, Number(e.target.value))}
                      className="px-2 py-1 rounded-md border border-white/10 bg-white/[0.02] text-sm outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full justify-center border border-white/10"
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
                    <div className="text-xs text-white/60">{transitionResult}</div>
                  )}
                </div>
              </div>

              {/* Account */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Account</h3>
                <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02]">
                  <div>
                    <div className="text-sm font-medium">Sign Out</div>
                    <div className="text-xs text-white/40">
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
              </div>
            </div>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3 py-4">
              {/* Connected accounts header + sync */}
              <div className="flex items-center justify-between">
                <div className="text-xs text-white/40">Connected accounts</div>
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
                  <div key={conn.id} className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden">
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
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 shrink-0">
                          <Calendar className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{conn.google_email || 'Google Account'}</div>
                          <div className="text-xs text-white/40">
                            {new Date(conn.expires_at) < new Date()
                              ? 'Expired — reconnect'
                              : totalCount > 0
                                ? `${selectedCount} of ${totalCount} calendars`
                                : 'Connected'}
                          </div>
                        </div>
                        {totalCount > 0 && (
                          <ChevronDown className={`size-3.5 text-white/30 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        )}
                      </button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="text-white/30 hover:text-red-400 hover:bg-red-500/10 ml-2 shrink-0"
                        onClick={() => onDisconnectAccount(conn.id)}
                        aria-label={`Disconnect ${conn.google_email}`}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>

                    {/* Collapsible calendar picker */}
                    {isExpanded && conn.availableCalendars.length > 0 && (
                      <div className="border-t border-white/5 p-3 space-y-2">
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
                            <div className="flex items-center justify-center w-4 h-4 rounded border border-white/20 peer-checked:bg-white/90 peer-checked:border-white/90 transition-colors">
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
                            <span className="text-sm text-white/70 group-hover:text-white/90 truncate">
                              {cal.summary}
                              {cal.primary && <span className="text-white/30 ml-1">(primary)</span>}
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
                className="w-full justify-center gap-2 border border-dashed border-white/10 text-white/50 hover:text-white/80 hover:border-white/20"
                onClick={onGoogleCalendarConnect}
              >
                <Plus className="size-3.5" />
                {googleCalendarConnected ? 'Add another Google account' : 'Connect Google Calendar'}
              </Button>
            </div>
          </TabsContent>

          {/* Workspace Tab */}
          <TabsContent value="workspace" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3 py-4">
              {/* Workspace settings */}
              {activeProject && (
                <div className="space-y-3">
                  <div className="text-xs text-white/40 px-1">Workspace settings</div>
                  <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02] space-y-3">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="relative group shrink-0"
                        onClick={() => wsLogoInputRef.current?.click()}
                        disabled={wsLogoUploading}
                        aria-label="Change workspace logo"
                      >
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden"
                          style={{ backgroundColor: wsColor || activeProject?.color || '#3b82f6' }}
                        >
                          {wsLogo ? (
                            <img src={wsLogo} alt="Workspace logo" className="w-full h-full object-cover" />
                          ) : (
                            <Blocks className="size-5 text-white/90" />
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
                        <div className="text-xs text-white/40">Workspace logo</div>
                        <div className="text-xs text-white/30">Click to upload</div>
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
                      <label className="text-xs text-white/40 block mb-1">Name</label>
                      <Input
                        value={wsName}
                        onChange={(e) => setWsName(e.target.value)}
                        placeholder="Workspace name"
                        className="h-8"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 block mb-1">Color</label>
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
                                await refreshWorkspaces?.();
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
                      className="w-full justify-center border border-white/10"
                      disabled={wsSaving || !wsName.trim() || wsName === activeProject.name}
                      onClick={async () => {
                        if (!activeProjectId) return;
                        setWsSaving(true);
                        try {
                          await updateWorkspace(activeProjectId, { name: wsName.trim() });
                          await refreshWorkspaces?.();
                        } catch (err) {
                          console.error("Failed to update workspace:", err);
                          toast.error("Failed to update workspace");
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

              {/* Members list */}
              <div className="space-y-2">
                <div className="text-xs text-white/40 px-1">Members</div>
                {workspaceMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02]"
                  >
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.display_name || ''}
                        className="size-8 rounded-full object-cover shrink-0"
                      />
                    ) : (
                      <div className="size-8 rounded-full bg-white/[0.06] flex items-center justify-center shrink-0">
                        <UserIcon className="size-4 text-white/30" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium flex items-center gap-2">
                        <span className="truncate">{member.display_name || member.email || member.user_id}</span>
                        {member.role === 'owner' && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 shrink-0">
                            Owner
                          </span>
                        )}
                        {member.role === 'admin' && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 shrink-0">
                            Admin
                          </span>
                        )}
                      </div>
                      {member.display_name && member.email && (
                        <div className="text-xs text-white/40 truncate">{member.email}</div>
                      )}
                    </div>
                    {member.role !== 'owner' && (
                      <Button
                        size="sm"
                        variant="destructive-ghost"
                        className="shrink-0"
                        onClick={async () => {
                          if (confirm('Remove this member from the workspace?')) {
                            try {
                              await removeUserFromWorkspace(member.id);
                              onMembersChange(workspaceMembers.filter(m => m.id !== member.id));
                            } catch (error) {
                              console.error('Failed to remove member:', error);
                              toast.error("Failed to remove member");
                            }
                          }
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Invite form */}
              <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02] space-y-3">
                <div className="text-xs text-white/40">
                  Invite members to collaborate on this workspace
                </div>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
                    className="flex-1"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                    className="px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.02] text-sm outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button
                    size="sm"
                    onClick={handleInvite}
                    disabled={inviteLoading || !inviteEmail.trim()}
                  >
                    {inviteLoading ? '...' : 'Invite'}
                  </Button>
                </div>
                {inviteMessage && (
                  <div className={`text-xs ${inviteMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {inviteMessage.text}
                  </div>
                )}
              </div>

              {/* Pending invites */}
              {pendingInvites.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-white/40 px-1">Pending invites</div>
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-dashed border-white/10 bg-white/[0.01]"
                    >
                      <div>
                        <div className="text-sm text-white/60">{invite.email}</div>
                        <div className="text-xs text-white/30">
                          {invite.role} &middot; invited {new Date(invite.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white/40 hover:text-red-400 hover:bg-red-500/10"
                        onClick={() => handleCancelInvite(invite.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Delete workspace */}
              {activeProject && activeProject.role === "owner" && userProjectCount > 1 && (
                <div className="space-y-3 pt-3">
                  <div className="text-xs text-white/40 px-1">Danger zone</div>
                  <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/[0.03] space-y-3">
                    <div className="flex items-center gap-2">
                      <Trash2 className="size-4 text-red-400 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-red-400">Delete workspace</div>
                        <div className="text-xs text-white/40">
                          This will permanently delete all tasks, clients, calendar data, and members.
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-white/40 block mb-1">
                        Type <span className="font-mono text-white/60">{activeProject.name}</span> to confirm
                      </label>
                      <Input
                        value={deleteConfirmName}
                        onChange={(e) => setDeleteConfirmName(e.target.value)}
                        placeholder={activeProject.name}
                        className="h-8"
                      />
                    </div>
                    {deleteError && <div className="text-xs text-red-400">{deleteError}</div>}
                    <Button
                      size="sm"
                      variant="destructive"
                      className="w-full"
                      disabled={deleting || deleteConfirmName !== activeProject.name}
                      onClick={async () => {
                        setDeleting(true);
                        setDeleteError(null);
                        try {
                          const res = await fetch("/api/workspace", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ projectId: activeProject.id }),
                          });
                          const data = await res.json();
                          if (!res.ok) {
                            setDeleteError(data.error || "Failed to delete");
                            return;
                          }
                          onOpenChange(false);
                          await refreshWorkspaces?.();
                        } catch {
                          setDeleteError("Network error");
                        } finally {
                          setDeleting(false);
                        }
                      }}
                    >
                      {deleting ? "Deleting..." : "Delete workspace permanently"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
