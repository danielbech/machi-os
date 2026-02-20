"use client";

import { useState, useRef } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { createClientRecord, updateClientRecord } from "@/lib/supabase/clients";
import { uploadClientLogo, deleteClientLogo } from "@/lib/supabase/storage";
import { getClientTextClassName, CLIENT_DOT_COLORS, COLOR_NAMES } from "@/lib/colors";
import type { Client } from "@/lib/types";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Upload, X } from "lucide-react";

function generateSlug(name: string, existingSlugs: string[]): string {
  const first = name.charAt(0).toLowerCase();
  if (first && !existingSlugs.includes(first)) return first;
  const two = name.slice(0, 2).toLowerCase();
  if (two.length === 2 && !existingSlugs.includes(two)) return two;
  for (let i = 1; i <= 9; i++) {
    const slug = `${first}${i}`;
    if (!existingSlugs.includes(slug)) return slug;
  }
  return first;
}

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingClient?: Client | null;
}

export function ProjectDialog({ open, onOpenChange, editingClient = null }: ProjectDialogProps) {
  const { activeProjectId, clients, refreshClients } = useWorkspace();

  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formColor, setFormColor] = useState("blue");
  const [formLogoUrl, setFormLogoUrl] = useState("");
  const [formLogoFile, setFormLogoFile] = useState<File | null>(null);
  const [formLogoPreview, setFormLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  // Reset form when dialog opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      if (editingClient) {
        setFormName(editingClient.name);
        setFormSlug(editingClient.slug);
        setFormColor(editingClient.color);
        setFormLogoUrl(editingClient.logo_url || "");
        setFormLogoFile(null);
        setFormLogoPreview(editingClient.logo_url || null);
      } else {
        setFormName("");
        setFormSlug("");
        setFormColor("blue");
        setFormLogoUrl("");
        setFormLogoFile(null);
        setFormLogoPreview(null);
      }
    }
    onOpenChange(nextOpen);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormLogoFile(file);
    setFormLogoPreview(URL.createObjectURL(file));
  };

  const clearLogo = () => {
    setFormLogoFile(null);
    setFormLogoPreview(null);
    setFormLogoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!editingClient) {
      const existingSlugs = clients.map((c) => c.slug);
      setFormSlug(generateSlug(name, existingSlugs));
    }
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSlug.trim() || !activeProjectId) return;
    setSaving(true);
    try {
      let logoUrl = formLogoUrl.trim() || null;

      if (editingClient) {
        if (formLogoFile) {
          logoUrl = await uploadClientLogo(formLogoFile, editingClient.id);
        }
        if (!logoUrl && editingClient.logo_url) {
          await deleteClientLogo(editingClient.logo_url);
        }
        await updateClientRecord(editingClient.id, {
          name: formName.trim(),
          slug: formSlug.trim().toLowerCase(),
          color: formColor,
          logo_url: logoUrl,
        });
      } else {
        const newClient = await createClientRecord(activeProjectId, {
          name: formName.trim(),
          slug: formSlug.trim().toLowerCase(),
          color: formColor,
          sort_order: clients.length,
          active: true,
        });
        if (formLogoFile) {
          logoUrl = await uploadClientLogo(formLogoFile, newClient.id);
          await updateClientRecord(newClient.id, { logo_url: logoUrl });
        }
      }
      await refreshClients();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving project:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[460px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-5">
          {/* Name — big, freestanding, auto-focused */}
          <div className="flex items-center gap-3">
            {/* Logo — inline with title */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.svg"
              onChange={handleFileSelect}
              className="hidden"
            />
            {formLogoPreview ? (
              <div className="group relative shrink-0">
                <img
                  src={formLogoPreview}
                  alt="Logo preview"
                  className="size-10 rounded-xl object-cover bg-white/5 cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                />
                <button
                  type="button"
                  onClick={clearLogo}
                  className="absolute -top-1 -right-1 size-4 rounded-full bg-white/10 hover:bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove logo"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="size-10 rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] flex items-center justify-center text-white/20 hover:text-white/40 hover:border-white/20 hover:bg-white/[0.04] transition-colors cursor-pointer shrink-0"
                aria-label="Upload logo"
              >
                <Upload className="size-4" />
              </button>
            )}

            <input
              ref={titleRef}
              type="text"
              value={formName}
              onChange={(e) => handleNameChange(e.target.value)}
              className={`flex-1 text-lg font-semibold bg-transparent outline-none placeholder:text-white/20 ${getClientTextClassName(formColor)}`}
              placeholder="Project name..."
            />
          </div>

          {/* Key + Color — compact row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-white/40">Key</label>
              <Input
                type="text"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value.slice(0, 3))}
                placeholder="b"
                maxLength={3}
                className="font-mono text-center w-14 h-8 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-white/40">Color</label>
              <div className="flex gap-1">
                {COLOR_NAMES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormColor(color)}
                    className={`size-5 rounded-full ${CLIENT_DOT_COLORS[color]} transition-all ${
                      formColor === color
                        ? "ring-2 ring-white/80 ring-offset-1 ring-offset-background"
                        : "opacity-40 hover:opacity-80"
                    }`}
                    title={color}
                    aria-label={`Select ${color} color`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !formName.trim() || !formSlug.trim()}
            >
              {saving ? "Saving..." : editingClient ? "Save" : "Add Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
