"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-context";
import { createClientRecord, updateClientRecord } from "@/lib/supabase/clients";
import { uploadClientLogo, deleteClientLogo } from "@/lib/supabase/storage";
import { CLIENT_DOT_COLORS, COLOR_NAMES } from "@/lib/colors";
import { ClientIcon } from "@/components/client-icon";
import type { Client } from "@/lib/types";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, X, Search } from "lucide-react";
import { iconNames } from "lucide-react/dynamic";

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
  const [formIcon, setFormIcon] = useState<string | null>(null);
  const [formLogoUrl, setFormLogoUrl] = useState("");
  const [formLogoFile, setFormLogoFile] = useState<File | null>(null);
  const [formLogoPreview, setFormLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const iconSearchRef = useRef<HTMLInputElement>(null);

  // Filter icons based on search
  const filteredIcons = useMemo(() => {
    const query = iconSearch.toLowerCase().trim();
    if (!query) return iconNames.slice(0, 80); // Show first 80 by default
    return iconNames.filter((name) => name.includes(query)).slice(0, 80);
  }, [iconSearch]);

  // Reset form when dialog opens or editingClient changes
  useEffect(() => {
    if (!open) return;
    if (editingClient) {
      setFormName(editingClient.name);
      setFormSlug(editingClient.slug);
      setFormColor(editingClient.color);
      setFormIcon(editingClient.icon || null);
      setFormLogoUrl(editingClient.logo_url || "");
      setFormLogoFile(null);
      setFormLogoPreview(editingClient.logo_url || null);
    } else {
      setFormName("");
      setFormSlug("");
      setFormColor("blue");
      setFormIcon(null);
      setFormLogoUrl("");
      setFormLogoFile(null);
      setFormLogoPreview(null);
    }
    setShowIconPicker(false);
    setIconSearch("");
  }, [open, editingClient]);

  // Focus search when icon picker opens
  useEffect(() => {
    if (showIconPicker) {
      setTimeout(() => iconSearchRef.current?.focus(), 50);
    }
  }, [showIconPicker]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormLogoFile(file);
    setFormLogoPreview(URL.createObjectURL(file));
    setFormIcon(null); // logo takes precedence
  };

  const clearLogo = () => {
    setFormLogoFile(null);
    setFormLogoPreview(null);
    setFormLogoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleNameChange = (name: string) => {
    setFormName(name);
    const existingSlugs = clients
      .filter((c) => c.id !== editingClient?.id)
      .map((c) => c.slug);
    setFormSlug(generateSlug(name, existingSlugs));
  };

  const handleSave = async () => {
    if (!formName.trim() || !activeProjectId) return;
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
          icon: formIcon || null,
          logo_url: logoUrl,
        });
      } else {
        const newClient = await createClientRecord(activeProjectId, {
          name: formName.trim(),
          slug: formSlug.trim().toLowerCase(),
          color: formColor,
          icon: formIcon || undefined,
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
      toast.error("Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  // What to show in the avatar area next to the title
  const renderAvatar = () => {
    if (formLogoPreview) {
      return (
        <div className="group relative shrink-0">
          <img
            src={formLogoPreview}
            alt="Logo preview"
            className="size-10 rounded-xl object-cover bg-white/5 cursor-pointer"
            onClick={() => setShowIconPicker(!showIconPicker)}
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
      );
    }

    if (formIcon) {
      return (
        <button
          type="button"
          onClick={() => setShowIconPicker(!showIconPicker)}
          className="size-10 rounded-xl bg-white/[0.06] flex items-center justify-center text-zinc-400 cursor-pointer shrink-0 transition-colors hover:bg-white/[0.10]"
          aria-label="Change icon"
        >
          <ClientIcon icon={formIcon} className="size-5" />
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setShowIconPicker(!showIconPicker)}
        className="size-10 rounded-xl border-2 border-dashed border-white/10 bg-white/[0.03] flex items-center justify-center cursor-pointer shrink-0 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
        aria-label="Pick icon"
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.svg"
              onChange={handleFileSelect}
              className="hidden"
            />
            {renderAvatar()}

            <input
              ref={titleRef}
              type="text"
              value={formName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="flex-1 text-lg font-semibold bg-transparent outline-none placeholder:text-white/20"
              placeholder="Project name..."
            />
          </div>

          {/* Icon picker — collapsible */}
          {showIconPicker && (
            <div className="space-y-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-white/20" />
                <input
                  ref={iconSearchRef}
                  type="text"
                  value={iconSearch}
                  onChange={(e) => setIconSearch(e.target.value)}
                  placeholder="Search icons..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-sm text-white/80 outline-none placeholder:text-white/20 focus:border-white/15"
                />
              </div>

              {/* Icon grid */}
              <div className="grid grid-cols-8 gap-1 max-h-[200px] overflow-y-auto">
                {filteredIcons.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setFormIcon(formIcon === name ? null : name);
                      setShowIconPicker(false);
                      setIconSearch("");
                    }}
                    className={`flex items-center justify-center size-9 rounded-lg transition-all ${
                      formIcon === name
                        ? "bg-white/15 text-white ring-1 ring-white/30"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06]"
                    }`}
                    title={name}
                    aria-label={`Select ${name} icon`}
                  >
                    <ClientIcon icon={name} className="size-4" />
                  </button>
                ))}
                {filteredIcons.length === 0 && (
                  <div className="col-span-8 py-4 text-center text-xs text-white/20">No icons found</div>
                )}
              </div>

              {/* Actions below grid */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors"
                >
                  <Upload className="size-3" />
                  Upload logo instead
                </button>
                {formIcon && (
                  <button
                    type="button"
                    onClick={() => { setFormIcon(null); setShowIconPicker(false); setIconSearch(""); }}
                    className="text-xs text-white/30 hover:text-white/50 ml-auto transition-colors"
                  >
                    Remove icon
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Text color */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/40">Text color</label>
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

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !formName.trim()}
              className="bg-white text-black hover:bg-white/90"
            >
              {saving ? "Saving..." : editingClient ? "Save" : "Add Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
