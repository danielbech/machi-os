"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  initiateGoogleAuth,
  clearAccessToken,
} from "@/lib/google-calendar";
import { removeUserFromWorkspace, type WorkspaceMember } from "@/lib/supabase/workspace";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "lucide-react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  googleCalendarConnected: boolean;
  onGoogleCalendarConnect: () => void;
  onGoogleCalendarDisconnect: () => void;
  workspaceMembers: WorkspaceMember[];
  onMembersChange: (members: WorkspaceMember[]) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  user,
  googleCalendarConnected,
  onGoogleCalendarConnect,
  onGoogleCalendarDisconnect,
  workspaceMembers,
  onMembersChange,
}: SettingsDialogProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");

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
            <div className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/[0.02]">
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
              <button
                onClick={() => {
                  if (googleCalendarConnected) {
                    clearAccessToken();
                    onGoogleCalendarDisconnect();
                  } else {
                    initiateGoogleAuth();
                    onGoogleCalendarConnect();
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  googleCalendarConnected
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : 'bg-white text-black hover:bg-white/90'
                }`}
              >
                {googleCalendarConnected ? 'Disconnect' : 'Connect'}
              </button>
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
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.02] text-sm outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}
                  className="px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.02] text-sm outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={() => {
                    alert('Invite feature coming soon! For now, users need to sign up with the same workspace.');
                    setInviteEmail('');
                  }}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-white text-black hover:bg-white/90 transition-colors"
                >
                  Invite
                </button>
              </div>
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
                    <button
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
                      className="px-3 py-1.5 rounded-md text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
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
              <button
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
                className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
