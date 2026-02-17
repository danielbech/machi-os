"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { removeUserFromWorkspace, getPendingInvites, cancelInvite, type WorkspaceMember } from "@/lib/supabase/workspace";
import type { PendingInvite } from "@/lib/types";
import type { GoogleCalendarInfo } from "@/lib/google-calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, RefreshCw } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  activeProjectId: string | null;
  googleCalendarConnected: boolean;
  onGoogleCalendarConnect: () => void;
  onGoogleCalendarDisconnect: () => void;
  onSyncCalendarEvents: () => Promise<void>;
  workspaceMembers: WorkspaceMember[];
  onMembersChange: (members: WorkspaceMember[]) => void;
  // Calendar picker
  availableCalendars: GoogleCalendarInfo[];
  selectedCalendars: string[];
  onUpdateSelectedCalendars: (calendarIds: string[]) => Promise<void>;
}

export function SettingsDialog({
  open,
  onOpenChange,
  user,
  activeProjectId,
  googleCalendarConnected,
  onGoogleCalendarConnect,
  onGoogleCalendarDisconnect,
  onSyncCalendarEvents,
  workspaceMembers,
  onMembersChange,
  availableCalendars,
  selectedCalendars,
  onUpdateSelectedCalendars,
}: SettingsDialogProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [syncing, setSyncing] = useState(false);

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

  const handleToggleCalendar = async (calendarId: string) => {
    const isSelected = selectedCalendars.includes(calendarId);
    let newSelection: string[];
    if (isSelected) {
      newSelection = selectedCalendars.filter(id => id !== calendarId);
      // Don't allow deselecting all
      if (newSelection.length === 0) return;
    } else {
      newSelection = [...selectedCalendars, calendarId];
    }
    await onUpdateSelectedCalendars(newSelection);
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Integrations Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Integrations</h3>

            {/* Google Calendar */}
            <div className="rounded-lg border border-white/5 bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5">
                    <Calendar className="size-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Google Calendar</div>
                    <div className="text-xs text-white/40">
                      {googleCalendarConnected ? 'Connected' : 'Sync your calendar events'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {googleCalendarConnected && (
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={handleSyncNow}
                      disabled={syncing}
                      aria-label="Sync now"
                    >
                      <RefreshCw className={`size-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={googleCalendarConnected ? "destructive" : "default"}
                    onClick={() => {
                      if (googleCalendarConnected) {
                        onGoogleCalendarDisconnect();
                      } else {
                        onGoogleCalendarConnect();
                      }
                    }}
                  >
                    {googleCalendarConnected ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>
              </div>

              {/* Calendar picker (only when connected and calendars are loaded) */}
              {googleCalendarConnected && availableCalendars.length > 0 && (
                <div className="border-t border-white/5 p-3 space-y-2">
                  <div className="text-xs text-white/40">Select calendars to sync</div>
                  {availableCalendars.map((cal) => (
                    <label
                      key={cal.id}
                      className="flex items-center gap-2.5 py-1 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCalendars.includes(cal.id)}
                        onChange={() => handleToggleCalendar(cal.id)}
                        className="sr-only peer"
                      />
                      <div className="flex items-center justify-center w-4 h-4 rounded border border-white/20 peer-checked:bg-white/90 peer-checked:border-white/90 transition-colors">
                        {selectedCalendars.includes(cal.id) && (
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
          </div>

          {/* Team Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Team</h3>

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
                      {member.user_id}
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

          {/* Account Section */}
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
      </DialogContent>
    </Dialog>
  );
}
