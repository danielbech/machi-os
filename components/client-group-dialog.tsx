"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-context";
import { createClientGroup } from "@/lib/supabase/client-groups";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ClientGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (groupId: string) => void;
}

export function ClientGroupDialog({ open, onOpenChange, onCreated }: ClientGroupDialogProps) {
  const { activeProjectId, clientGroups, refreshClientGroups } = useWorkspace();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSave = async () => {
    if (!name.trim() || !activeProjectId) return;
    setSaving(true);
    try {
      const group = await createClientGroup(activeProjectId, name.trim(), clientGroups.length);
      await refreshClientGroups();
      onCreated?.(group.id);
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating client:", error);
      toast.error("Failed to create client");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[360px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-lg font-semibold bg-transparent outline-none placeholder:text-white/20"
            placeholder="Client name..."
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !name.trim()}
              className="bg-white text-black hover:bg-white/90"
            >
              {saving ? "Creating..." : "Add Client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
