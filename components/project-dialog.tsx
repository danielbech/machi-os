"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-context";
import { createClientRecord, updateClientRecord } from "@/lib/supabase/clients";
import { CLIENT_DOT_COLORS, COLOR_NAMES } from "@/lib/colors";
import { ClientIcon } from "@/components/client-icon";
import type { Client } from "@/lib/types";
import { ClientGroupDialog } from "@/components/client-group-dialog";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, Building2, Check, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { iconNames } from "lucide-react/dynamic";

function generateSlug(name: string): string {
  return name.charAt(0).toLowerCase() || "";
}

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingClient?: Client | null;
  /** When true, newly created projects will have show_in_backlog set */
  showInBacklog?: boolean;
}

export function ProjectDialog({ open, onOpenChange, editingClient = null, showInBacklog = false }: ProjectDialogProps) {
  const { activeProjectId, clients, refreshClients, clientGroups } = useWorkspace();

  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formColor, setFormColor] = useState("blue");
  const [formIcon, setFormIcon] = useState<string | null>(null);
  const [formClientGroupId, setFormClientGroupId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [clientGroupDialogOpen, setClientGroupDialogOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const iconSearchRef = useRef<HTMLInputElement>(null);

  // Resolve selected client group
  const selectedGroup = formClientGroupId
    ? clientGroups.find((g) => g.id === formClientGroupId)
    : null;

  // Filter icons based on search
  const filteredIcons = useMemo(() => {
    const query = iconSearch.toLowerCase().trim();
    if (!query) return iconNames.slice(0, 80);
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
      setFormClientGroupId(editingClient.client_group_id || null);
    } else {
      setFormName("");
      setFormSlug("");
      setFormColor("blue");
      setFormIcon(null);
      setFormClientGroupId(null);
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

  const handleNameChange = (name: string) => {
    setFormName(name);
    setFormSlug(generateSlug(name));
  };

  const handleSave = async () => {
    if (!formName.trim() || !activeProjectId) return;
    setSaving(true);
    try {
      if (editingClient) {
        await updateClientRecord(editingClient.id, {
          name: formName.trim(),
          slug: formSlug.trim().toLowerCase(),
          color: formColor,
          icon: formIcon || null,
          client_group_id: formClientGroupId,
        });
      } else {
        await createClientRecord(activeProjectId, {
          name: formName.trim(),
          slug: formSlug.trim().toLowerCase(),
          color: formColor,
          icon: formIcon || undefined,
          sort_order: clients.length,
          active: true,
          client_group_id: formClientGroupId || undefined,
          show_in_backlog: showInBacklog || undefined,
        });
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

  // Avatar: show client_group logo > project icon > empty
  const renderAvatar = () => {
    if (selectedGroup?.logo_url) {
      return (
        <div className="size-10 rounded-xl overflow-hidden shrink-0">
          <img
            src={selectedGroup.logo_url}
            alt={selectedGroup.name}
            className="size-10 object-cover bg-foreground/5"
          />
        </div>
      );
    }

    if (formIcon) {
      return (
        <button
          type="button"
          onClick={() => setShowIconPicker(!showIconPicker)}
          className="size-10 rounded-xl bg-foreground/[0.06] flex items-center justify-center text-zinc-400 cursor-pointer shrink-0 transition-colors hover:bg-foreground/[0.10]"
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
        className="size-10 rounded-xl border-2 border-dashed border-foreground/10 bg-foreground/[0.03] flex items-center justify-center cursor-pointer shrink-0 transition-colors hover:border-foreground/20 hover:bg-foreground/[0.06]"
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
          {/* Name */}
          <div className="flex items-center gap-3">
            {renderAvatar()}

            <input
              ref={titleRef}
              type="text"
              value={formName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="flex-1 text-lg font-semibold bg-transparent outline-none placeholder:text-foreground/20"
              placeholder="Project name..."
            />
          </div>

          {/* Icon picker — collapsible (only when no client_group logo) */}
          {showIconPicker && !selectedGroup?.logo_url && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground/20" />
                <input
                  ref={iconSearchRef}
                  type="text"
                  value={iconSearch}
                  onChange={(e) => setIconSearch(e.target.value)}
                  placeholder="Search icons..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-foreground/[0.04] border border-foreground/[0.06] text-sm text-foreground/80 outline-none placeholder:text-foreground/20 focus:border-foreground/15"
                />
              </div>

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
                        ? "bg-foreground/15 text-foreground ring-1 ring-foreground/30"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-foreground/[0.06]"
                    }`}
                    title={name}
                    aria-label={`Select ${name} icon`}
                  >
                    <ClientIcon icon={name} className="size-4" />
                  </button>
                ))}
                {filteredIcons.length === 0 && (
                  <div className="col-span-8 py-4 text-center text-xs text-foreground/20">No icons found</div>
                )}
              </div>

              {formIcon && (
                <button
                  type="button"
                  onClick={() => { setFormIcon(null); setShowIconPicker(false); setIconSearch(""); }}
                  className="text-xs text-foreground/30 hover:text-foreground/50 transition-colors"
                >
                  Remove icon
                </button>
              )}
            </div>
          )}

          {/* Client group */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-foreground/40">Client</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-foreground/[0.06] transition-colors"
                >
                  <Building2 className="size-3 text-foreground/30" />
                  {formClientGroupId
                    ? clientGroups.find((g) => g.id === formClientGroupId)?.name || "Unknown"
                    : <span className="text-foreground/30">None</span>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem onClick={() => setFormClientGroupId(null)}>
                  <span className={!formClientGroupId ? "text-white" : "text-foreground/40"}>None</span>
                  {!formClientGroupId && <Check className="size-3.5 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {clientGroups.map((g) => (
                  <DropdownMenuItem
                    key={g.id}
                    onClick={() => setFormClientGroupId(g.id)}
                  >
                    {g.logo_url && (
                      <img src={g.logo_url} alt="" className="size-4 rounded object-cover shrink-0" />
                    )}
                    {g.name}
                    {formClientGroupId === g.id && <Check className="size-3.5 ml-auto" />}
                  </DropdownMenuItem>
                ))}
                {clientGroups.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-foreground/20">No clients yet</div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setClientGroupDialogOpen(true)}>
                  <Plus className="size-4" />
                  New client
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ClientGroupDialog
              open={clientGroupDialogOpen}
              onOpenChange={setClientGroupDialogOpen}
              onCreated={(groupId) => setFormClientGroupId(groupId)}
            />
          </div>

          {/* Text color */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-foreground/40">Text color</label>
            <div className="flex gap-1">
              {COLOR_NAMES.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormColor(color)}
                  className={`size-5 rounded-full ${CLIENT_DOT_COLORS[color]} transition-all ${
                    formColor === color
                      ? "ring-2 ring-foreground/80 ring-offset-1 ring-offset-background"
                      : "opacity-40 hover:opacity-80"
                  }`}
                  title={color}
                  aria-label={`Select ${color} color`}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-foreground/[0.06]">
            <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !formName.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "Saving..." : editingClient ? "Save" : "Add Project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
