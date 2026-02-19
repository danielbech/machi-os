"use client";

import { useState, useRef } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { createClientRecord, updateClientRecord, deleteClientRecord } from "@/lib/supabase/clients";
import { uploadClientLogo, deleteClientLogo } from "@/lib/supabase/storage";
import { getClientClassName, CLIENT_DOT_COLORS, COLOR_NAMES } from "@/lib/colors";
import type { Client } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Upload, X } from "lucide-react";

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

export default function ProjectsPage() {
  const { activeProjectId, clients, refreshClients } = useWorkspace();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formColor, setFormColor] = useState("blue");
  const [formLogoUrl, setFormLogoUrl] = useState("");
  const [formLogoFile, setFormLogoFile] = useState<File | null>(null);
  const [formLogoPreview, setFormLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeClients = clients.filter((c) => c.active);
  const idleClients = clients.filter((c) => !c.active);

  const openAdd = () => {
    setEditingClient(null);
    setFormName("");
    setFormSlug("");
    setFormColor("blue");
    setFormLogoUrl("");
    setFormLogoFile(null);
    setFormLogoPreview(null);
    setDialogOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setFormName(client.name);
    setFormSlug(client.slug);
    setFormColor(client.color);
    setFormLogoUrl(client.logo_url || "");
    setFormLogoFile(null);
    setFormLogoPreview(client.logo_url || null);
    setDialogOpen(true);
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
      setDialogOpen(false);
    } catch (error) {
      console.error("Error saving project:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (client: Client) => {
    try {
      await updateClientRecord(client.id, { active: !client.active });
      await refreshClients();
    } catch (error) {
      console.error("Error toggling project status:", error);
    }
  };

  const handleDelete = async (clientId: string) => {
    try {
      await deleteClientRecord(clientId);
      await refreshClients();
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  const ClientRow = ({ client }: { client: Client }) => (
    <div className="group flex items-center gap-4 px-4 py-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all">
      {/* Logo / Avatar */}
      {client.logo_url ? (
        <img
          src={client.logo_url}
          alt={client.name}
          className="size-8 rounded-lg object-cover bg-white/5 shrink-0"
        />
      ) : (
        <div className={`size-8 rounded-lg ${CLIENT_DOT_COLORS[client.color] || "bg-blue-500"} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
          {client.name.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name + Badge */}
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span className="font-medium truncate">{client.name}</span>
        <Badge className={getClientClassName(client.color)}>
          {client.name}
        </Badge>
      </div>

      {/* Shortcut */}
      <span className="text-xs text-white/30 font-mono w-8 text-center shrink-0">{client.slug}</span>

      {/* Status toggle */}
      <Button
        variant="ghost"
        size="sm"
        className={client.active
          ? "text-green-400 hover:text-orange-400 hover:bg-orange-500/10"
          : "text-white/30 hover:text-green-400 hover:bg-green-500/10"
        }
        onClick={() => handleToggleActive(client)}
      >
        {client.active ? "Active" : "Idle"}
      </Button>

      {/* Actions */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-white/40 hover:text-white hover:bg-white/10"
          onClick={() => openEdit(client)}
          aria-label={`Edit ${client.name}`}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-white/40 hover:text-red-400 hover:bg-red-500/10"
          onClick={() => setDeleteConfirm(client.id)}
          aria-label={`Delete ${client.name}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8 bg-black/50">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button onClick={openAdd}>
          <Plus className="size-4" />
          Add Project
        </Button>
      </div>

      {clients.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="text-white/40 text-sm">No projects yet</div>
            <Button variant="link" onClick={openAdd} className="text-white/60 hover:text-white">
              Add your first project
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active projects */}
          {activeClients.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider px-1">
                Active ({activeClients.length})
              </div>
              <div className="space-y-1">
                {activeClients.map((client) => (
                  <ClientRow key={client.id} client={client} />
                ))}
              </div>
            </div>
          )}

          {/* Idle projects */}
          {idleClients.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-white/40 uppercase tracking-wider px-1">
                Idle ({idleClients.length})
              </div>
              <div className="space-y-1 opacity-60">
                {idleClients.map((client) => (
                  <ClientRow key={client.id} client={client} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Edit Project" : "Add Project"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Name + Shortcut row */}
            <div className="flex gap-3">
              <div className="flex-1 space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  type="text"
                  value={formName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Project name"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Shortcut</label>
                <Input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value.slice(0, 3))}
                  placeholder="e.g. b"
                  maxLength={3}
                  className="w-16 font-mono text-center"
                />
              </div>
            </div>

            <div className="border-t border-white/[0.06]" />

            {/* Logo */}
            <div className="space-y-2.5">
              <label className="text-sm font-medium">Logo <span className="text-white/30 font-normal">(optional)</span></label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.svg"
                onChange={handleFileSelect}
                className="hidden"
              />
              {formLogoPreview ? (
                <div className="flex items-center gap-4">
                  <img
                    src={formLogoPreview}
                    alt="Logo preview"
                    className="size-16 rounded-xl object-cover bg-white/5"
                  />
                  <div className="flex flex-col gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/40 hover:text-white/60"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="size-3" />
                      Replace
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white/40 hover:text-red-400 hover:bg-red-500/10"
                      onClick={clearLogo}
                    >
                      <X className="size-3" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 w-full rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-5 text-sm text-white/30 hover:text-white/50 hover:border-white/20 transition-colors"
                >
                  <Upload className="size-4" />
                  Upload logo
                </button>
              )}
            </div>

            <div className="border-t border-white/[0.06]" />

            {/* Color */}
            <div className="space-y-2.5">
              <label className="text-sm font-medium">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_NAMES.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormColor(color)}
                    className={`size-8 rounded-full ${CLIENT_DOT_COLORS[color]} transition-all ${
                      formColor === color
                        ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-110"
                        : "opacity-60 hover:opacity-100"
                    }`}
                    title={color}
                    aria-label={`Select ${color} color`}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            {formName.trim() && (
              <>
                <div className="border-t border-white/[0.06]" />
                <div className="space-y-2.5">
                  <label className="text-sm font-medium text-white/40">Preview</label>
                  <div className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                    {formLogoPreview ? (
                      <img
                        src={formLogoPreview}
                        alt=""
                        className="size-6 rounded-md object-cover bg-white/5 shrink-0"
                      />
                    ) : (
                      <div className={`size-6 rounded-md ${CLIENT_DOT_COLORS[formColor] || "bg-blue-500"} flex items-center justify-center text-white font-bold text-[10px] shrink-0`}>
                        {formName.trim().charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-white/80">{formName.trim()}</span>
                    <Badge className={`${getClientClassName(formColor)} ml-auto`}>{formName.trim()}</Badge>
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-white/20">Press shortcut key on a task card to assign this project</span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !formName.trim() || !formSlug.trim()}
                >
                  {saving ? "Saving..." : editingClient ? "Save" : "Add Project"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-white/60">
              Are you sure you want to delete this project? Tasks assigned to this project will keep their assignment but it won&apos;t be visible.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
