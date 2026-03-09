"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import {
  loadDocs,
  createDoc,
  updateDoc,
  deleteDoc,
  duplicateDoc,
  reorderDocs,
} from "@/lib/supabase/docs";
import type { Doc } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  MeasuringStrategy,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Plus,
  FileText,
  Search,
  MessageSquare,
  Keyboard,
  Star,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DocEditor } from "@/components/docs/doc-editor";
import { SortableTreeItem } from "@/components/docs/sortable-tree-item";
import type { FlatItem, DropIndicator } from "@/components/docs/sortable-tree-item";
import { SearchDialog } from "@/components/docs/search-dialog";
import { KeyboardShortcutsDialog } from "@/components/docs/keyboard-shortcuts-dialog";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DocTreeNode extends Doc {
  children: DocTreeNode[];
}

// ─── Build nested tree from flat list ────────────────────────────────────────

function buildTree(docs: Doc[]): DocTreeNode[] {
  const map = new Map<string, DocTreeNode>();
  const roots: DocTreeNode[] = [];

  for (const doc of docs) {
    map.set(doc.id, { ...doc, children: [] });
  }

  for (const doc of docs) {
    const node = map.get(doc.id)!;
    if (doc.parent_id && map.has(doc.parent_id)) {
      map.get(doc.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort roots and children by sort_order so optimistic updates reorder immediately
  for (const node of map.values()) {
    node.children.sort((a, b) => a.sort_order - b.sort_order);
  }
  roots.sort((a, b) => a.sort_order - b.sort_order);

  return roots;
}

// ─── Flatten tree for sortable context ───────────────────────────────────────

function flattenTree(
  nodes: DocTreeNode[],
  depth: number,
  expandedIds: Set<string>,
): FlatItem[] {
  const result: FlatItem[] = [];
  for (const node of nodes) {
    const hasChildren = node.children.length > 0;
    result.push({ id: node.id, doc: node, depth, hasChildren, parentId: node.parent_id });
    if (hasChildren && expandedIds.has(node.id)) {
      result.push(...flattenTree(node.children, depth + 1, expandedIds));
    }
  }
  return result;
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function DocsPage() {
  const { user } = useAuth();
  const { activeProjectId } = useWorkspace();

  const [docs, setDocs] = useState<Doc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const sidebarRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Load favorites from localStorage
  useEffect(() => {
    if (!activeProjectId) return;
    try {
      const stored = localStorage.getItem(`doc-favorites-${activeProjectId}`);
      if (stored) {
        setFavorites(new Set(JSON.parse(stored)));
      }
    } catch {
      // Ignore parse errors
    }
  }, [activeProjectId]);

  // Save favorites to localStorage whenever they change
  const saveFavorites = useCallback(
    (next: Set<string>) => {
      if (!activeProjectId) return;
      setFavorites(next);
      localStorage.setItem(
        `doc-favorites-${activeProjectId}`,
        JSON.stringify([...next])
      );
    },
    [activeProjectId]
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      const next = new Set(favorites);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
    },
    [favorites, saveFavorites]
  );

  // Favorited docs for the sidebar section
  const favoritedDocs = useMemo(
    () => docs.filter((d) => favorites.has(d.id)),
    [docs, favorites]
  );

  // Load docs
  const loadAllDocs = useCallback(async () => {
    if (!activeProjectId) return;
    const d = await loadDocs(activeProjectId);
    setDocs(d);
    setLoading(false);
  }, [activeProjectId]);

  useEffect(() => {
    setLoading(true);
    loadAllDocs();
  }, [loadAllDocs]);

  // Auto-select first doc
  useEffect(() => {
    if (!loading && docs.length > 0 && !activeDocId) {
      setActiveDocId(docs[0].id);
    }
  }, [loading, docs, activeDocId]);

  // Expand all by default when docs first load
  useEffect(() => {
    if (docs.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set(docs.filter((d) => docs.some((c) => c.parent_id === d.id)).map((d) => d.id)));
    }
  }, [docs]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const tree = useMemo(() => buildTree(docs), [docs]);

  const flatItems = useMemo(
    () => flattenTree(tree, 0, expandedIds),
    [tree, expandedIds]
  );

  const activeDoc = useMemo(
    () => docs.find((d) => d.id === activeDocId) || null,
    [docs, activeDocId]
  );

  // Handlers
  const handleCreate = useCallback(
    async (parentId: string | null = null) => {
      if (!activeProjectId || !user) return;
      const siblings = docs.filter((d) => d.parent_id === parentId);
      const doc = await createDoc(
        activeProjectId,
        user.id,
        parentId,
        siblings.length,
      );
      setDocs((prev) => [...prev, doc]);
      setActiveDocId(doc.id);
    },
    [activeProjectId, user, docs]
  );

  const handleUpdate = useCallback(
    async (
      id: string,
      updates: { title?: string; content?: Record<string, unknown>; icon?: string | null; cover_image?: string | null }
    ) => {
      await updateDoc(id, updates);
      setDocs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...updates, updated_at: new Date().toISOString() } : d))
      );
    },
    []
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteDoc(id);
      // Remove the doc and all its descendants
      const idsToRemove = new Set<string>();
      const collectIds = (parentId: string) => {
        idsToRemove.add(parentId);
        docs.filter((d) => d.parent_id === parentId).forEach((d) => collectIds(d.id));
      };
      collectIds(id);
      setDocs((prev) => prev.filter((d) => !idsToRemove.has(d.id)));
      if (activeDocId && idsToRemove.has(activeDocId)) {
        setActiveDocId(null);
      }
      setDeleteConfirm(null);
    },
    [docs, activeDocId]
  );

  const handleDuplicate = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        const newDoc = await duplicateDoc(id, user.id);
        setDocs((prev) => [...prev, newDoc]);
        setActiveDocId(newDoc.id);
      } catch {
        toast.error("Failed to duplicate page");
      }
    },
    [user]
  );

  // Compute drop indicator based on pointer position relative to the over item
  const computeDropIndicator = useCallback(
    (overId: string, pointerY: number, pointerX: number): DropIndicator | null => {
      if (!sidebarRef.current) return null;
      const overItem = flatItems.find((i) => i.id === overId);
      if (!overItem) return null;

      // Find the DOM element for the over item
      const el = sidebarRef.current.querySelector(`[data-sortable-id="${overId}"]`);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const sidebarRect = sidebarRef.current.getBoundingClientRect();

      // How far right is the pointer from the sidebar left edge?
      const relativeX = pointerX - sidebarRect.left;
      // Threshold: if pointer is indented past the item's current indent + ~40px, treat as "nest inside"
      const nestThreshold = overItem.depth * 16 + 60;

      // Vertical position within the item
      const relativeY = pointerY - rect.top;
      const midY = rect.height / 2;

      if (relativeX > nestThreshold) {
        // Nesting — drop as child of this item
        return { overId, position: "child", depth: overItem.depth + 1 };
      } else if (relativeY < midY) {
        // Drop before (same level as over item)
        return { overId, position: "before", depth: overItem.depth };
      } else {
        // Drop after (same level as over item)
        return { overId, position: "after", depth: overItem.depth };
      }
    },
    [flatItems]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over, active } = event;
      if (!over || over.id === active.id) {
        setDropIndicator(null);
        return;
      }
      // Get pointer coordinates from the activator event
      const pointerEvent = event.activatorEvent as PointerEvent;
      // Use the current translated position
      const currentY = pointerEvent.clientY + (event.delta?.y || 0);
      const currentX = pointerEvent.clientX + (event.delta?.x || 0);
      const indicator = computeDropIndicator(over.id as string, currentY, currentX);
      setDropIndicator(indicator);
    },
    [computeDropIndicator]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const currentIndicator = dropIndicator;
      setDragActiveId(null);
      setDropIndicator(null);

      const { active, over } = event;
      if (!over || active.id === over.id || !currentIndicator) return;

      const activeItem = flatItems.find((i) => i.id === active.id);
      const overItem = flatItems.find((i) => i.id === over.id);
      if (!activeItem || !overItem) return;

      let newParentId: string | null;
      let targetSiblings: Doc[];
      let insertBeforeId: string | null = null;

      if (currentIndicator.position === "child") {
        // Drop as child of the over item
        newParentId = overItem.id;
        targetSiblings = docs
          .filter((d) => d.parent_id === newParentId && d.id !== activeItem.id)
          .sort((a, b) => a.sort_order - b.sort_order);
        // Append at end
      } else {
        // Drop as sibling (before or after the over item)
        newParentId = overItem.parentId;
        targetSiblings = docs
          .filter((d) => d.parent_id === newParentId && d.id !== activeItem.id)
          .sort((a, b) => a.sort_order - b.sort_order);

        if (currentIndicator.position === "before") {
          insertBeforeId = overItem.id;
        } else {
          // "after" — insert after the over item
          const overIdx = targetSiblings.findIndex((s) => s.id === overItem.id);
          if (overIdx >= 0 && overIdx + 1 < targetSiblings.length) {
            insertBeforeId = targetSiblings[overIdx + 1].id;
          }
        }
      }

      // Build new order
      const ordered: Doc[] = [];
      let inserted = false;
      for (const s of targetSiblings) {
        if (insertBeforeId && s.id === insertBeforeId) {
          ordered.push({ ...activeItem.doc, parent_id: newParentId });
          inserted = true;
        }
        ordered.push(s);
      }
      if (!inserted) {
        ordered.push({ ...activeItem.doc, parent_id: newParentId });
      }

      // Prepare updates
      const updates = ordered.map((d, i) => ({
        id: d.id,
        parent_id: newParentId,
        sort_order: i,
      }));

      // Optimistic update
      setDocs((prev) =>
        prev.map((d) => {
          const update = updates.find((u) => u.id === d.id);
          if (update) return { ...d, parent_id: update.parent_id, sort_order: update.sort_order };
          return d;
        })
      );

      // Expand the new parent
      if (newParentId) {
        setExpandedIds((prev) => new Set([...prev, newParentId]));
      }

      // Persist
      await reorderDocs(updates);
    },
    [flatItems, docs, dropIndicator]
  );

  if (loading) {
    return (
      <main className="flex min-h-screen">
        <div className="w-64 border-r border-foreground/[0.06] p-3">
          <div className="h-6 w-24 bg-foreground/5 rounded animate-pulse mb-4" />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-7 bg-foreground/[0.03] rounded mb-1 animate-pulse"
            />
          ))}
        </div>
        <div className="flex-1 p-8">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="h-10 w-64 bg-foreground/5 rounded animate-pulse" />
            <div className="h-4 w-full bg-foreground/[0.03] rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-foreground/[0.03] rounded animate-pulse" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen">
      {/* Sidebar tree */}
      <div className="w-64 shrink-0 border-r border-foreground/[0.06] flex flex-col">
        <div ref={sidebarRef} className="flex-1 overflow-y-auto pb-3">
          {/* Favorites section */}
          {favoritedDocs.length > 0 && (
            <div className="px-1">
              <div className="flex items-center px-3 pt-3 pb-2">
                <span className="text-xs font-medium text-foreground/40 uppercase tracking-wide">
                  Favorites
                </span>
              </div>
              {favoritedDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setActiveDocId(doc.id)}
                  className={`flex items-center gap-1.5 w-full py-1 px-2 rounded-md text-sm cursor-pointer transition-colors ${
                    activeDocId === doc.id
                      ? "bg-foreground/[0.08] text-foreground"
                      : "text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground/80"
                  }`}
                >
                  <Star className="size-3 text-primary shrink-0 fill-current" />
                  <span className="text-base leading-none shrink-0">
                    {doc.icon || "\ud83d\udcc4"}
                  </span>
                  <span className="flex-1 truncate">{doc.title || "Untitled"}</span>
                </button>
              ))}
            </div>
          )}
          {/* Pages section */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <span className="text-xs font-medium text-foreground/40 uppercase tracking-wide">
              Pages
            </span>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setSearchOpen(true)}
                className="text-foreground/30 hover:text-foreground/60"
                aria-label="Search pages"
              >
                <Search className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => handleCreate(null)}
                className="text-foreground/30 hover:text-foreground/60"
                aria-label="New page"
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
          <div className="px-1">
          {tree.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <FileText className="size-8 text-foreground/10 mx-auto mb-3" />
              <p className="text-xs text-foreground/30 mb-3">No pages yet</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCreate(null)}
                className="text-foreground/40"
              >
                <Plus className="size-3.5" />
                New page
              </Button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
            >
              <SortableContext
                items={flatItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                {flatItems.map((item) => (
                  <SortableTreeItem
                    key={item.id}
                    item={item}
                    activeId={activeDocId}
                    onSelect={setActiveDocId}
                    onCreateChild={(parentId) => handleCreate(parentId)}
                    onDuplicate={handleDuplicate}
                    onDelete={(id) => setDeleteConfirm(id)}
                    onToggle={toggleExpanded}
                    onToggleFavorite={toggleFavorite}
                    onUpdateIcon={(id, icon) => handleUpdate(id, { icon })}
                    expanded={expandedIds.has(item.id)}
                    isFavorited={favorites.has(item.id)}
                    dropIndicator={
                      dragActiveId && dragActiveId !== item.id && dropIndicator?.overId === item.id
                        ? dropIndicator
                        : null
                    }
                  />
                ))}
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {dragActiveId ? (() => {
                  const item = flatItems.find((i) => i.id === dragActiveId);
                  if (!item) return null;
                  return (
                    <div className="flex items-center gap-1 py-1 px-2 rounded-md text-sm bg-popover border border-foreground/[0.08] shadow-lg">
                      <span className="text-base leading-none shrink-0">
                        {item.doc.icon || "\ud83d\udcc4"}
                      </span>
                      <span className="truncate">{item.doc.title || "Untitled"}</span>
                    </div>
                  );
                })() : null}
              </DragOverlay>
            </DndContext>
          )}
          </div>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeDoc && (
          <div className="flex items-center justify-end gap-1 px-4 py-2 border-b border-foreground/[0.04]">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowComments((v) => !v)}
              className={`relative ${showComments ? "text-foreground/60" : "text-foreground/25 hover:text-foreground/50"}`}
              aria-label="Toggle comments"
            >
              <MessageSquare className="size-3.5" />
              {commentCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 size-3.5 flex items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                  {commentCount > 9 ? "9+" : commentCount}
                </span>
              )}
            </Button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
        {activeDoc ? (
          <DocEditor
            key={activeDoc.id}
            doc={activeDoc}
            docs={docs}
            onUpdate={handleUpdate}
            onNavigate={setActiveDocId}
            projectId={activeProjectId!}
            userId={user!.id}
            showComments={showComments}
            onCommentCountChange={setCommentCount}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <FileText className="size-12 text-foreground/10 mx-auto" />
              <p className="text-sm text-foreground/30">
                {docs.length === 0
                  ? "Create your first page to get started"
                  : "Select a page from the sidebar"}
              </p>
              {docs.length === 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCreate(null)}
                  className="text-foreground/50"
                >
                  <Plus className="size-3.5" />
                  New page
                </Button>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Floating keyboard shortcuts button */}
      <div className="fixed bottom-5 right-5 z-50">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShortcutsOpen((v) => !v)}
              className={`flex items-center justify-center size-10 rounded-full border shadow-lg transition-all ${
                shortcutsOpen
                  ? "bg-foreground/10 border-foreground/20 text-foreground"
                  : "bg-popover/90 border-border text-muted-foreground hover:text-foreground hover:border-ring/20"
              }`}
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={8}>
            Shortcuts
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Search dialog */}
      {activeProjectId && (
        <SearchDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          projectId={activeProjectId}
          onSelect={(docId) => setActiveDocId(docId)}
        />
      )}

      {/* Keyboard shortcuts dialog */}
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />

      {/* Delete confirmation */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
      >
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Delete page</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-foreground/60">
              Are you sure? This will permanently delete this page and all its
              sub-pages.
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
