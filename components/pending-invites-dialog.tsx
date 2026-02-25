"use client";

import { useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import type { MyPendingInvite } from "@/lib/supabase/workspace";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PendingInvitesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PendingInvitesDialog({ open, onOpenChange }: PendingInvitesDialogProps) {
  const { pendingInvites, acceptInvite, declineInvite } = useWorkspace();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAccept = async (invite: MyPendingInvite) => {
    setLoadingId(invite.id);
    try {
      await acceptInvite(invite);
    } catch (error) {
      console.error("Failed to accept invite:", error);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDecline = async (invite: MyPendingInvite) => {
    setLoadingId(invite.id);
    try {
      await declineInvite(invite);
    } catch (error) {
      console.error("Failed to decline invite:", error);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Workspace invites</DialogTitle>
          <DialogDescription className="text-white/50">
            You&apos;ve been invited to join {pendingInvites.length === 1 ? "a workspace" : `${pendingInvites.length} workspaces`}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          {pendingInvites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3"
            >
              <div
                className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: invite.workspace_color || "#3b82f6" }}
              >
                <img src="/logo-mark.svg" alt="" className="size-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{invite.workspace_name}</p>
                <p className="text-xs text-white/40 capitalize">{invite.role}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loadingId === invite.id}
                  onClick={() => handleDecline(invite)}
                >
                  Decline
                </Button>
                <Button
                  size="sm"
                  disabled={loadingId === invite.id}
                  onClick={() => handleAccept(invite)}
                >
                  Accept
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
