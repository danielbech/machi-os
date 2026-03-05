"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-context";
import { useProjectData } from "@/lib/project-data-context";
import { createClientGroup, updateClientGroup } from "@/lib/supabase/client-groups";
import { uploadClientLogo, deleteClientLogo } from "@/lib/supabase/storage";
import type { ClientGroup } from "@/lib/types";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

interface ClientGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingGroup?: ClientGroup | null;
  onCreated?: (groupId: string) => void;
}

export function ClientGroupDialog({ open, onOpenChange, editingGroup = null, onCreated }: ClientGroupDialogProps) {
  const { activeProjectId } = useWorkspace();
  const { clientGroups, refreshClientGroups } = useProjectData();
  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editingGroup) {
      setName(editingGroup.name);
      setLogoFile(null);
      setLogoPreview(editingGroup.logo_url || null);
    } else {
      setName("");
      setLogoFile(null);
      setLogoPreview(null);
    }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, editingGroup]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!name.trim() || !activeProjectId) return;
    setSaving(true);
    try {
      if (editingGroup) {
        let logoUrl: string | null = editingGroup.logo_url || null;
        if (logoFile) {
          logoUrl = await uploadClientLogo(logoFile, `group-${editingGroup.id}`);
        } else if (!logoPreview && editingGroup.logo_url) {
          await deleteClientLogo(editingGroup.logo_url);
          logoUrl = null;
        }
        await updateClientGroup(editingGroup.id, {
          name: name.trim(),
          logo_url: logoUrl,
        });
        await refreshClientGroups();
        onOpenChange(false);
      } else {
        const group = await createClientGroup(activeProjectId, name.trim(), clientGroups.length);
        if (logoFile) {
          const logoUrl = await uploadClientLogo(logoFile, `group-${group.id}`);
          await updateClientGroup(group.id, { logo_url: logoUrl });
        }
        await refreshClientGroups();
        onCreated?.(group.id);
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error saving client:", error);
      toast.error("Failed to save client");
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
            ref={fileInputRef}
            type="file"
            accept="image/*,.svg"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            {logoPreview ? (
              <div className="group relative shrink-0">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="size-10 rounded-xl object-cover bg-foreground/5"
                />
                <button
                  type="button"
                  onClick={clearLogo}
                  className="absolute -top-1 -right-1 size-4 rounded-full bg-foreground/10 hover:bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove logo"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="size-10 rounded-xl border-2 border-dashed border-foreground/10 bg-foreground/[0.03] flex items-center justify-center cursor-pointer shrink-0 transition-colors hover:border-foreground/20 hover:bg-foreground/[0.06]"
                aria-label="Upload logo"
              >
                <Upload className="size-4 text-foreground/20" />
              </button>
            )}
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 text-lg font-semibold bg-transparent outline-none placeholder:text-foreground/20"
              placeholder="Client name..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-foreground/[0.06]">
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !name.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "Saving..." : editingGroup ? "Save" : "Add Client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
