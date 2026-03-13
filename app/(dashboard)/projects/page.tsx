"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import { useProjectData } from "@/lib/project-data-context";
import { updateClientRecord, deleteClientRecord } from "@/lib/supabase/clients";
import { deleteClientGroup } from "@/lib/supabase/client-groups";
import { ClientGroupDialog } from "@/components/client-group-dialog";
import { CLIENT_DOT_COLORS, BADGE_COLOR_STYLES, getBadgeColorStyle } from "@/lib/colors";
import { ClientIcon } from "@/components/client-icon";
import type { Client, ClientGroup, ClientStatusDef } from "@/lib/types";

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  Check,
  Building2,
} from "lucide-react";

// ─── Shared helpers ──────────────────────────────────────────────────────────

// Status colors use the central BADGE_COLOR_STYLES, CLIENT_DOT_COLORS, and COLOR_NAMES from lib/colors.ts

function StatusFilter({
  value,
  onChange,
  statuses,
}: {
  value: string;
  onChange: (value: string) => void;
  statuses: ClientStatusDef[];
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-foreground/5 p-0.5">
      <button
        onClick={() => onChange("all")}
        className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
          value === "all"
            ? "bg-foreground/10 text-foreground"
            : "text-foreground/30 hover:text-foreground/50"
        }`}
      >
        All
      </button>
      {statuses.map((s) => (
        <button
          key={s.id}
          onClick={() => onChange(s.id)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
            value === s.id
              ? "bg-foreground/10 text-foreground"
              : "text-foreground/30 hover:text-foreground/50"
          }`}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}

function StatusPicker({
  statusId,
  statuses,
  onChangeStatus,
}: {
  statusId?: string;
  statuses: ClientStatusDef[];
  onChangeStatus: (statusId: string) => void;
}) {
  const current = statuses.find((s) => s.id === statusId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="focus:outline-none">
          {current ? (
            <Badge className={`${getBadgeColorStyle(current.color)} cursor-pointer hover:opacity-80 transition-opacity`}>
              {current.name}
            </Badge>
          ) : (
            <span className="text-xs text-foreground/20 cursor-pointer">None</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        {statuses.map((s) => (
          <DropdownMenuItem key={s.id} onClick={() => onChangeStatus(s.id)}>
            <Badge className={`${getBadgeColorStyle(s.color)} text-[10px] px-1.5 py-0`}>
              {s.name}
            </Badge>
            {statusId === s.id && <Check className="size-3.5 ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SortIcon({ sorted }: { sorted: false | "asc" | "desc" }) {
  if (sorted === "asc") return <ArrowUp className="size-3.5" />;
  if (sorted === "desc") return <ArrowDown className="size-3.5" />;
  return <ArrowUpDown className="size-3.5 opacity-30" />;
}

function ClientGroupPicker({
  currentGroupId,
  currentGroupName,
  clientGroups,
  onSelect,
  onRequestCreate,
}: {
  currentGroupId?: string;
  currentGroupName?: string;
  clientGroups: ClientGroup[];
  onSelect: (groupId: string | null) => void;
  onRequestCreate: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs hover:text-foreground/60 transition-colors text-left">
          {currentGroupName ? (
            <span className="text-foreground/50">{currentGroupName}</span>
          ) : (
            <span className="text-foreground/20">None</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-48 p-1 bg-popover/95 backdrop-blur-md border-border">
        <button
          onClick={() => { onSelect(null); setOpen(false); }}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm hover:bg-foreground/[0.08] transition-colors ${!currentGroupId ? "text-white" : "text-foreground/40"}`}
        >
          None
          {!currentGroupId && <Check className="size-3.5 ml-auto" />}
        </button>
        <div className="h-px bg-foreground/[0.06] my-1" />
        {clientGroups.map((g) => (
          <button
            key={g.id}
            onClick={() => { onSelect(g.id); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm hover:bg-foreground/[0.08] transition-colors ${currentGroupId === g.id ? "text-foreground" : ""}`}
          >
            {g.logo_url && (
              <img src={g.logo_url} alt="" className="size-4 rounded object-cover shrink-0" />
            )}
            {g.name}
            {currentGroupId === g.id && <Check className="size-3.5 ml-auto" />}
          </button>
        ))}
        {clientGroups.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-foreground/20">No clients yet</div>
        )}
        <div className="h-px bg-foreground/[0.06] my-1" />
        <button
          onClick={() => { setOpen(false); onRequestCreate(); }}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-sm text-foreground/40 hover:text-foreground/60 hover:bg-foreground/[0.08] transition-colors"
        >
          <Plus className="size-3.5" />
          New client
        </button>
      </PopoverContent>
    </Popover>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
        active
          ? "bg-foreground/10 text-foreground"
          : "text-foreground/30 hover:text-foreground/50"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Clients Tab ─────────────────────────────────────────────────────────────

function ClientsTab() {
  const { activeProjectId } = useWorkspace();
  const { clients, clientGroups, refreshClientGroups, refreshClients } = useProjectData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ClientGroup | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const openAdd = () => {
    setEditingGroup(null);
    setDialogOpen(true);
  };

  const openEdit = (group: ClientGroup) => {
    setEditingGroup(group);
    setDialogOpen(true);
  };

  const handleDelete = async (groupId: string) => {
    try {
      await deleteClientGroup(groupId);
      await Promise.all([refreshClientGroups(), refreshClients()]);
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting client:", error);
      toast.error("Failed to delete client");
    }
  };

  const projectCountByGroup = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of clients) {
      if (c.client_group_id) {
        counts[c.client_group_id] = (counts[c.client_group_id] || 0) + 1;
      }
    }
    return counts;
  }, [clients]);

  if (clientGroups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-foreground/40 text-sm">No clients yet</div>
          <Button
            variant="link"
            onClick={openAdd}
            className="text-foreground/60 hover:text-foreground"
          >
            Add your first client
          </Button>
          <ClientGroupDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-foreground/30">
          {clientGroups.length} client{clientGroups.length !== 1 ? "s" : ""}
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4" />
          Add Client
        </Button>
      </div>

      <div className="rounded-lg border border-foreground/[0.06] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-foreground/[0.06] bg-foreground/[0.02] hover:bg-foreground/[0.02]">
              <TableHead>Client</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientGroups.map((group) => (
              <TableRow key={group.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {group.logo_url ? (
                      <img
                        src={group.logo_url}
                        alt={group.name}
                        className="size-7 rounded-lg object-cover bg-foreground/5 shrink-0"
                      />
                    ) : (
                      <div className="size-7 rounded-lg bg-foreground/[0.06] flex items-center justify-center shrink-0">
                        <Building2 className="size-3.5 text-foreground/30" />
                      </div>
                    )}
                    <span className="font-medium">{group.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-foreground/30">
                    {projectCountByGroup[group.id] || 0}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-foreground/30 hover:text-foreground/60"
                          aria-label={`Actions for ${group.name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(group)}>
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteConfirm(group.id)}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ClientGroupDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingGroup={editingGroup}
      />

      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-foreground/60">
              Are you sure you want to delete this client? Projects assigned to
              this client will be unlinked.
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
    </div>
  );
}


// ─── Projects Tab ────────────────────────────────────────────────────────────

function ProjectsTab() {
  const { activeProjectId } = useWorkspace();
  const { clients, refreshClients, clientGroups, refreshClientGroups, clientStatuses, refreshClientStatuses } = useProjectData();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [clientGroupDialogOpen, setClientGroupDialogOpen] = useState(false);
  const [pendingGroupAssignClientId, setPendingGroupAssignClientId] = useState<string | null>(null);

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

  const handleChangeStatus = async (clientId: string, statusId: string) => {
    try {
      await updateClientRecord(clientId, {
        status_id: statusId,
      });
      await refreshClients();
    } catch (error) {
      console.error("Error updating project status:", error);
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

  const handleGroupCreated = async (groupId: string) => {
    await refreshClientGroups();
    if (pendingGroupAssignClientId) {
      await handleChangeClientGroup(pendingGroupAssignClientId, groupId);
      setPendingGroupAssignClientId(null);
    }
  };

  const openCreateGroupForClient = (clientId: string) => {
    setPendingGroupAssignClientId(clientId);
    setClientGroupDialogOpen(true);
  };

  const filteredClients = useMemo(() => {
    if (statusFilter === "all") return clients;
    return clients.filter((c) => c.status_id === statusFilter);
  }, [clients, statusFilter]);

  const columns = useMemo<ColumnDef<Client>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Project",
        cell: ({ row }) => {
          const client = row.original;
          const group = clientGroups.find((g) => g.id === client.client_group_id);
          const logoUrl = group?.logo_url || client.logo_url;
          return (
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={client.name}
                  className="size-7 rounded-lg object-cover bg-foreground/5 shrink-0"
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
            <ClientGroupPicker
              currentGroupId={client.client_group_id}
              currentGroupName={group?.name}
              clientGroups={clientGroups}
              onSelect={(groupId) => handleChangeClientGroup(client.id, groupId)}
              onRequestCreate={() => openCreateGroupForClient(client.id)}
            />
          );
        },
        sortingFn: (rowA, rowB) => {
          const groupA = clientGroups.find((g) => g.id === rowA.original.client_group_id);
          const groupB = clientGroups.find((g) => g.id === rowB.original.client_group_id);
          return (groupA?.name || "").localeCompare(groupB?.name || "");
        },
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
              <span className="text-xs text-foreground/50 capitalize">{color}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "status_id",
        header: "Status",
        cell: ({ row }) => {
          const client = row.original;
          return (
            <StatusPicker
              statusId={client.status_id}
              statuses={clientStatuses}
              onChangeStatus={(s) => handleChangeStatus(client.id, s)}
            />
          );
        },
        sortingFn: (rowA, rowB) => {
          const sA = clientStatuses.find((s) => s.id === rowA.original.status_id);
          const sB = clientStatuses.find((s) => s.id === rowB.original.status_id);
          return (sA?.sort_order ?? 99) - (sB?.sort_order ?? 99);
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
                    className="text-foreground/30 hover:text-foreground/60"
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
    [clientGroups, clientStatuses]
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

  if (clients.length === 0) {
    return (
      <>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="text-foreground/40 text-sm">No projects yet</div>
            <Button
              variant="link"
              onClick={openAdd}
              className="text-foreground/60 hover:text-foreground"
            >
              Add your first project
            </Button>
          </div>
        </div>
        <ProjectDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editingClient={editingClient}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-foreground/30" />
            <Input
              placeholder="Search projects..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8 h-8 text-xs bg-foreground/[0.04] border-foreground/[0.06]"
            />
            {globalFilter && (
              <button
                onClick={() => setGlobalFilter("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground/60"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
          <StatusFilter value={statusFilter} onChange={setStatusFilter} statuses={clientStatuses} />
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs text-foreground/30">
              {table.getFilteredRowModel().rows.length} project
              {table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
            </span>
            <Button size="sm" onClick={openAdd}>
              <Plus className="size-4" />
              Add Project
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-foreground/[0.06] overflow-hidden">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="border-foreground/[0.06] bg-foreground/[0.02] hover:bg-foreground/[0.02]"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={
                        header.column.getCanSort()
                          ? "cursor-pointer select-none hover:text-foreground/60 transition-colors"
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
                    className="h-24 text-center text-foreground/30"
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

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingClient={editingClient}
      />

      <ClientGroupDialog
        open={clientGroupDialogOpen}
        onOpenChange={setClientGroupDialogOpen}
        onCreated={handleGroupCreated}
      />

      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-foreground/60">
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
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { activeProjectId } = useWorkspace();
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"projects" | "clients">("projects");

  useEffect(() => {
    if (activeProjectId) setInitialLoading(false);
  }, [activeProjectId]);

  if (initialLoading) {
    return (
      <main className="flex min-h-screen flex-col p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="h-8 w-32 bg-foreground/5 rounded animate-pulse" />
          <div className="h-9 w-28 bg-foreground/5 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-14 bg-foreground/[0.02] rounded-lg border border-foreground/5 animate-pulse"
            />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col p-4 md:p-8">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-0.5 rounded-md bg-foreground/5 p-0.5">
          <TabButton active={activeTab === "projects"} onClick={() => setActiveTab("projects")}>
            Projects
          </TabButton>
          <TabButton active={activeTab === "clients"} onClick={() => setActiveTab("clients")}>
            Clients
          </TabButton>
        </div>
      </div>

      {activeTab === "projects" ? <ProjectsTab /> : <ClientsTab />}
    </main>
  );
}
