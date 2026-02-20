"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { removeUserFromWorkspace, getPendingInvites, cancelInvite, type WorkspaceMember } from "@/lib/supabase/workspace";
import type { PendingInvite } from "@/lib/types";
import type { ConnectionWithCalendars } from "@/lib/workspace-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, RefreshCw, Plus, X, ChevronDown } from "lucide-react";

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
}: SettingsDialogProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionResult, setTransitionResult] = useState<string | null>(null);
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());

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
      alert('Failed to cancel invite');
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
        <Tabs defaultValue="general" className="flex-1 min-h-0 flex flex-col">
          <TabsList variant="line" className="border-b border-white/5 px-0">
            <TabsTrigger value="general" className="text-white/40 data-[state=active]:text-white after:bg-white">General</TabsTrigger>
            <TabsTrigger value="calendar" className="text-white/40 data-[state=active]:text-white after:bg-white">Calendar</TabsTrigger>
            <TabsTrigger value="team" className="text-white/40 data-[state=active]:text-white after:bg-white">Team</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-6 py-4">
              {/* Week Transition */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Week Transition</h3>
                <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02] space-y-3">
                  <div className="text-xs text-white/40">
                    Archive completed tasks and move incomplete tasks to Monday. Runs automatically every Friday at 17:00.
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
                        } else {
                          onOpenChange(false);
                        }
                      } catch (err) {
                        console.error('Sign out failed:', err);
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

          {/* Team Tab */}
          <TabsContent value="team" className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3 py-4">
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

              {/* Members list */}
              <div className="space-y-2">
                {workspaceMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02]"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {member.email || member.user_id}
                        {member.role === 'owner' && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                            Owner
                          </span>
                        )}
                        {member.role === 'admin' && (
                          <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/40">
                        Joined {new Date(member.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {member.role !== 'owner' && (
                      <Button
                        size="sm"
                        variant="destructive-ghost"
                        onClick={async () => {
                          if (confirm('Remove this member from the workspace?')) {
                            try {
                              await removeUserFromWorkspace(member.id);
                              onMembersChange(workspaceMembers.filter(m => m.id !== member.id));
                            } catch (error) {
                              console.error('Failed to remove member:', error);
                              alert('Failed to remove member');
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
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
