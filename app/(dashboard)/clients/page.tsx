"use client";

import { useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { createClientRecord, updateClientRecord, deleteClientRecord } from "@/lib/supabase/clients";
import { getClientClassName, CLIENT_DOT_COLORS, COLOR_NAMES } from "@/lib/colors";
import type { Client } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";

function generateSlug(name: string, existingSlugs: string[]): string {
  const first = name.charAt(0).toLowerCase();
  if (first && !existingSlugs.includes(first)) return first;
  // Try first two letters
  const two = name.slice(0, 2).toLowerCase();
  if (two.length === 2 && !existingSlugs.includes(two)) return two;
  // Fallback: first letter + number
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
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const openAdd = () => {
    setEditingClient(null);
    setFormName("");
    setFormSlug("");
    setFormColor("blue");
    setFormLogoUrl("");
    setDialogOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setFormName(client.name);
    setFormSlug(client.slug);
    setFormColor(client.color);
    setFormLogoUrl(client.logo_url || "");
    setDialogOpen(true);
  };

  const handleNameChange = (name: string) => {
    setFormName(name);
    // Auto-generate slug only when adding new
    if (!editingClient) {
      const existingSlugs = clients.map((c) => c.slug);
      setFormSlug(generateSlug(name, existingSlugs));
    }
  };

  const handleSave = async () => {
    if (!formName.trim() || !formSlug.trim() || !activeProjectId) return;
    setSaving(true);
    try {
      if (editingClient) {
        await updateClientRecord(editingClient.id, {
          name: formName.trim(),
          slug: formSlug.trim().toLowerCase(),
          color: formColor,
          logo_url: formLogoUrl.trim() || null,
        });
      } else {
        await createClientRecord(activeProjectId, {
          name: formName.trim(),
          slug: formSlug.trim().toLowerCase(),
          color: formColor,
          logo_url: formLogoUrl.trim() || undefined,
          sort_order: clients.length,
        });
      }
      await refreshClients();
      setDialogOpen(false);
    } catch (error) {
      console.error("Error saving client:", error);
    } finally {
      setSaving(false);
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

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8 bg-black/50">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors"
        >
          <Plus className="size-4" />
          Add Client
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="text-white/40 text-sm">No clients yet</div>
            <button
              onClick={openAdd}
              className="text-sm text-white/60 hover:text-white underline underline-offset-4 transition-colors"
            >
              Add your first client
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {clients.map((client) => (
            <div
              key={client.id}
              className="group relative rounded-xl border border-white/5 bg-white/[0.02] p-4 hover:bg-white/[0.04] hover:border-white/10 transition-all"
            >
              <div className="flex items-start gap-3">
                {client.logo_url ? (
                  <img
                    src={client.logo_url}
                    alt={client.name}
                    className="size-10 rounded-lg object-cover bg-white/5"
                  />
                ) : (
                  <div className={`size-10 rounded-lg ${CLIENT_DOT_COLORS[client.color] || "bg-blue-500"} flex items-center justify-center text-white font-bold text-sm`}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{client.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={getClientClassName(client.color)}>
                      {client.name}
                    </Badge>
                    <span className="text-xs text-white/30 font-mono">{client.slug}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(client)}
                  className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  onClick={() => setDeleteConfirm(client.id)}
                  className="p-1.5 rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
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
              <input
                type="text"
                value={formName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Client name"
                autoFocus
                className="w-full rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Keyboard Shortcut</label>
              <input
                type="text"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value.slice(0, 3))}
                placeholder="e.g. b"
                maxLength={3}
                className="w-20 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm font-mono outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
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
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Logo URL <span className="text-white/30 font-normal">(optional)</span></label>
              <input
                type="url"
                value={formLogoUrl}
                onChange={(e) => setFormLogoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
              />
            </div>

            {/* Preview */}
            {formName.trim() && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/40">Preview</label>
                <Badge className={getClientClassName(formColor)}>{formName.trim()}</Badge>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 rounded-md text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !formName.trim() || !formSlug.trim()}
                className="px-4 py-2 rounded-md text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : editingClient ? "Save" : "Add Client"}
              </button>
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
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-md text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                className="px-4 py-2 rounded-md text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
