"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  flexRender,
} from "@tanstack/react-table";
import { useWorkspace } from "@/lib/workspace-context";
import { updateClientRecord, deleteClientRecord } from "@/lib/supabase/clients";
import { createClientGroup, updateClientGroup, deleteClientGroup } from "@/lib/supabase/client-groups";
import { CLIENT_DOT_COLORS } from "@/lib/colors";
import { ClientIcon } from "@/components/client-icon";
import type { Client, ClientGroup } from "@/lib/types";
import { ProjectDialog } from "@/components/project-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  Building2,
  Check,
} from "lucide-react";

function StatusFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const options = ["all", "active", "idle"] as const;
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-white/5 p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-all capitalize ${
            value === opt
              ? "bg-white/10 text-white"
              : "text-white/30 hover:text-white/50"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ArrowUp className="size-3.5" />;
  if (sorted === "desc") return <ArrowDown className="size-3.5" />;
  return <ArrowUpDown className="size-3.5 opacity-30" />;
}

export default function ProjectsPage() {
  const { activeProjectId, clients, refreshClients, clientGroups, refreshClientGroups } = useWorkspace();
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (activeProjectId) setInitialLoading(false);
  }, [activeProjectId]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  const handleChangeClientGroup = async (clientId: string, groupId: string | null) => {
    try {
      await updateClientRecord(clientId, { client_group_id: groupId });
      await refreshClients();
    } catch (error) {
      console.error("Error updating client group:", error);
      toast.error("Failed to update client");
    }
  };

  const handleCreateClientGroup = async () => {
    if (!activeProjectId || !newGroupName.trim()) return;
    try {
      await createClientGroup(activeProjectId, newGroupName.trim(), clientGroups.length);
      setNewGroupName("");
      await refreshClientGroups();
    } catch (error) {
      console.error("Error creating client group:", error);
      toast.error("Failed to create client");
    }
  };

  const filteredClients = useMemo(() => {
    if (statusFilter === "all") return clients;
    if (statusFilter === "active") return clients.filter((c) => c.active);
    return clients.filter((c) => !c.active);
  }, [clients, statusFilter]);

  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Project",
        cell: ({ row }) => {
          const client = row.original;
          return (
            <div className="flex items-center gap-3">
              {client.logo_url ? (
                <img
                  src={client.logo_url}
                  alt={client.name}
                  className="size-7 rounded-lg object-cover bg-white/5 shrink-0"
                />
              ) : (
                <div
                  className={`size-7 rounded-lg ${CLIENT_DOT_COLORS[client.color] || "bg-blue-500"} flex items-center justify-center text-white shrink-0`}
                >
                  {client.icon ? (
                    <ClientIcon icon={client.icon} className="size-3.5" />
                  ) : (
                    <span className="font-bold text-[10px]">
                      {client.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              )}
              <span className="font-medium">
                {client.name}
              </span>
            </div>
          );
        },
        filterFn: "includesString",
      },
      {
        accessorKey: "client_group_id",
        header: "Client",
        cell: ({ row }) => {
          const client = row.original;
          const group = clientGroups.find((g) => g.id === client.client_group_id);
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs hover:text-white/60 transition-colors text-left">
                  {group ? (
                    <span className="text-white/50">{group.name}</span>
                  ) : (
                    <span className="text-white/20">None</span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuItem
                  onClick={() => handleChangeClientGroup(client.id, null)}
                >
                  <span className="text-white/30">None</span>
                  {!client.client_group_id && <Check className="size-3.5 ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {clientGroups.map((g) => (
                  <DropdownMenuItem
                    key={g.id}
                    onClick={() => handleChangeClientGroup(client.id, g.id)}
                  >
                    {g.name}
                    {client.client_group_id === g.id && <Check className="size-3.5 ml-auto" />}
                  </DropdownMenuItem>
                ))}
                {clientGroups.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-white/20">No clients yet</div>
                )}
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleCreateClientGroup(); }}
                    className="flex items-center gap-1"
                  >
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="New client..."
                      className="flex-1 text-xs bg-transparent outline-none placeholder:text-white/20"
                    />
                    {newGroupName.trim() && (
                      <button type="submit" className="text-white/40 hover:text-white/60">
                        <Plus className="size-3" />
                      </button>
                    )}
                  </form>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        sortingFn: (rowA, rowB) => {
          const groupA = clientGroups.find((g) => g.id === rowA.original.client_group_id);
          const groupB = clientGroups.find((g) => g.id === rowB.original.client_group_id);
          return (groupA?.name || "").localeCompare(groupB?.name || "");
        },
      },
      {
        accessorKey: "slug",
        header: "Shortcut",
        cell: ({ getValue }) => (
          <span className="text-xs text-white/30 font-mono">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: "color",
        header: "Color",
        cell: ({ getValue }) => {
          const color = getValue<string>();
          return (
            <div className="flex items-center gap-2">
              <div
                className={`size-3 rounded-full ${CLIENT_DOT_COLORS[color] || "bg-blue-500"}`}
              />
              <span className="text-xs text-white/50 capitalize">{color}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "active",
        header: "Status",
        cell: ({ getValue }) => {
          const active = getValue<boolean>();
          return (
            <Badge
              className={
                active
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-white/5 text-white/30 border-white/10"
              }
            >
              {active ? "Active" : "Idle"}
            </Badge>
          );
        },
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.active ? 1 : 0;
          const b = rowB.original.active ? 1 : 0;
          return a - b;
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const client = row.original;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-white/30 hover:text-white/60"
                    aria-label={`Actions for ${client.name}`}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(client)}>
                    <Pencil className="size-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleActive(client)}>
                    {client.active ? "Set Idle" : "Set Active"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteConfirm(client.id)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const table = useReactTable({
    data: filteredClients,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
  });

  if (initialLoading) {
    return (
      <main className="flex min-h-screen flex-col p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-8 w-32 bg-white/5 rounded animate-pulse" />
          <div className="h-9 w-28 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 bg-white/[0.02] rounded-lg border border-white/5 animate-pulse"
            />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8">
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
            <Button
              variant="link"
              onClick={openAdd}
              className="text-white/60 hover:text-white"
            >
              Add your first project
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-white/30" />
              <Input
                placeholder="Search projects..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
              {globalFilter && (
                <button
                  onClick={() => setGlobalFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
            <StatusFilter value={statusFilter} onChange={setStatusFilter} />
            <div className="ml-auto text-xs text-white/30">
              {table.getFilteredRowModel().rows.length} project
              {table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border border-white/[0.06] overflow-hidden">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.02]"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={
                          header.column.getCanSort()
                            ? "cursor-pointer select-none hover:text-white/60 transition-colors"
                            : ""
                        }
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-1.5">
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                          {header.column.getCanSort() && (
                            <SortIcon
                              sorted={header.column.getIsSorted()}
                            />
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center text-white/30"
                    >
                      {globalFilter || statusFilter !== "all"
                        ? "No matching projects."
                        : "No projects yet."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingClient={editingClient}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-white/60">
              Are you sure you want to delete this project? Tasks assigned to
              this project will keep their assignment but it won&apos;t be
              visible.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setDeleteConfirm(null)}
              >
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
