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

export default function ClientsPage() {
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
      console.error("Error saving client:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (client: Client) => {
    try {
      await updateClientRecord(client.id, { active: !client.active });
      await refreshClients();
    } catch (error) {
      console.error("Error toggling client status:", error);
    }
  };

  const handleDelete = async (clientId: string) => {
    try {
      await deleteClientRecord(clientId);
      await refreshClients();
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting client:", error);
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
        <h1 className="text-2xl font-bold">Clients</h1>
        <Button onClick={openAdd}>
          <Plus className="size-4" />
          Add Client
        </Button>
      </div>

      {clients.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="text-white/40 text-sm">No clients yet</div>
            <Button variant="link" onClick={openAdd} className="text-white/60 hover:text-white">
              Add your first client
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active clients */}
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

          {/* Idle clients */}
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
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Edit Client" : "Add Client"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                type="text"
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Client name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Keyboard Shortcut</label>
              <Input
                type="text"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value.slice(0, 3))}
                placeholder="e.g. b"
                maxLength={3}
                className="w-20 font-mono"
              />
              <div className="text-xs text-white/30">Press this key on a task card to assign this client</div>
            </div>

            <div className="space-y-2">
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Logo <span className="text-white/30 font-normal">(optional)</span></label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              {formLogoPreview ? (
                <div className="flex items-center gap-3">
                  <img
                    src={formLogoPreview}
                    alt="Logo preview"
                    className="size-12 rounded-lg object-cover bg-white/5"
                  />
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
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 w-full rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-white/40 hover:text-white/60 hover:border-white/20 transition-colors"
                >
                  <Upload className="size-4" />
                  Upload logo
                </button>
              )}
            </div>

            {/* Preview */}
            {formName.trim() && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/40">Preview</label>
                <Badge className={getClientClassName(formColor)}>{formName.trim()}</Badge>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formSlug.trim()}
              >
                {saving ? "Saving..." : editingClient ? "Save" : "Add Client"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-white/60">
              Are you sure you want to delete this client? Tasks assigned to this client will keep their assignment but it won&apos;t be visible.
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
