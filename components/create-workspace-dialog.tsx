"use client";

import { useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { WORKSPACE_COLORS } from "@/lib/colors";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceDialog({ open, onOpenChange }: CreateWorkspaceDialogProps) {
  const { setActiveProjectId, refreshWorkspaces } = useWorkspace();
  const [name, setName] = useState("");
  const [color, setColor] = useState(WORKSPACE_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create workspace");
        return;
      }

      await refreshWorkspaces();
      setActiveProjectId(data.project.id);
      onOpenChange(false);
      setName("");
      setColor(WORKSPACE_COLORS[0]);
    } catch {
      setError("Network error");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <label className="text-xs text-white/40">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Work, Personal, Side Project"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-white/40">Color</label>
            <div className="flex gap-2 flex-wrap">
              {WORKSPACE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? "2px solid white" : "2px solid transparent",
                    outlineOffset: "2px",
                  }}
                  aria-label={`Select color ${c}`}
                />
              ))}
            </div>
          </div>

          {error && <div className="text-xs text-red-400">{error}</div>}

          <Button
            className="w-full"
            disabled={creating || !name.trim()}
            onClick={handleCreate}
          >
            {creating ? "Creating..." : "Create workspace"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
