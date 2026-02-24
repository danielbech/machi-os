"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace-context";
import { updateClientRecord, deleteClientRecord } from "@/lib/supabase/clients";
import { getClientTextClassName, CLIENT_DOT_COLORS } from "@/lib/colors";
import { ClientIcon } from "@/components/client-icon";
import type { Client } from "@/lib/types";
import { ProjectDialog } from "@/components/project-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";

export default function ProjectsPage() {
  const { activeProjectId, clients, refreshClients } = useWorkspace();
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (activeProjectId) setInitialLoading(false);
  }, [activeProjectId]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const activeClients = clients.filter((c) => c.active);
  const idleClients = clients.filter((c) => !c.active);

  const openAdd = () => {
    setEditingClient(null);
    setDialogOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setDialogOpen(true);
  };

  const handleToggleActive = async (client: Client) => {
    try {
      await updateClientRecord(client.id, { active: !client.active });
      await refreshClients();
    } catch (error) {
      console.error("Error toggling project status:", error);
      toast.error("Failed to update project");
    }
  };

  const handleDelete = async (clientId: string) => {
    try {
      await deleteClientRecord(clientId);
      await refreshClients();
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
    }
  };

  const ClientRow = ({ client }: { client: Client }) => (
    <div className="group flex items-center gap-4 px-4 py-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all">
      {/* Logo / Icon / Avatar */}
      {client.logo_url ? (
        <img
          src={client.logo_url}
          alt={client.name}
          className="size-8 rounded-lg object-cover bg-white/5 shrink-0"
        />
      ) : (
        <div className={`size-8 rounded-lg ${CLIENT_DOT_COLORS[client.color] || "bg-blue-500"} flex items-center justify-center text-white shrink-0`}>
          {client.icon ? (
            <ClientIcon icon={client.icon} className="size-4" />
          ) : (
            <span className="font-bold text-xs">{client.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
      )}

      {/* Name */}
      <span className={`flex-1 min-w-0 font-medium truncate ${getClientTextClassName(client.color)}`}>{client.name}</span>

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
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
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

  if (initialLoading) {
    return (
      <main className="flex min-h-screen flex-col p-4 md:p-8 bg-black/50">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-8 w-32 bg-white/5 rounded animate-pulse" />
          <div className="h-9 w-28 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-white/[0.02] rounded-lg border border-white/5 animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

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
      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingClient={editingClient}
      />

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
