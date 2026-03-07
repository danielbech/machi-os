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
} from "@/lib/supabase/docs";
import type { Doc } from "@/lib/types";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  FileText,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  FilePlus,
} from "lucide-react";

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

  return roots;
}

// ─── Page tree item ──────────────────────────────────────────────────────────

function TreeItem({
  node,
  depth,
  activeId,
  onSelect,
  onCreateChild,
  onDelete,
}: {
  node: DocTreeNode;
  depth: number;
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isActive = activeId === node.id;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 py-1 px-2 rounded-md text-sm cursor-pointer transition-colors ${
          isActive
            ? "bg-foreground/[0.08] text-foreground"
            : "text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground/80"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className={`shrink-0 size-5 flex items-center justify-center rounded transition-colors hover:bg-foreground/[0.06] ${
            hasChildren ? "text-foreground/30" : "text-transparent"
          }`}
        >
          <ChevronRight
            className={`size-3 transition-transform duration-150 ${
              expanded ? "rotate-90" : ""
            }`}
          />
        </button>
        <span className="text-base leading-none shrink-0">
          {node.icon || "📄"}
        </span>
        <span className="flex-1 truncate">{node.title || "Untitled"}</span>
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateChild(node.id);
            }}
            className="size-5 flex items-center justify-center rounded hover:bg-foreground/[0.08] text-foreground/30 hover:text-foreground/50"
            aria-label="Add sub-page"
          >
            <Plus className="size-3" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="size-5 flex items-center justify-center rounded hover:bg-foreground/[0.08] text-foreground/30 hover:text-foreground/50"
                aria-label="Page options"
              >
                <MoreHorizontal className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[160px]">
              <DropdownMenuItem onClick={() => onCreateChild(node.id)}>
                <FilePlus className="size-4" />
                Add sub-page
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(node.id)}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <TreeItem
            key={child.id}
            node={child}
            depth={depth + 1}
            activeId={activeId}
            onSelect={onSelect}
            onCreateChild={onCreateChild}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}

// ─── Editor component ────────────────────────────────────────────────────────

function DocEditor({
  doc,
  onUpdate,
}: {
  doc: Doc;
  onUpdate: (id: string, updates: { title?: string; content?: Record<string, unknown> }) => void;
}) {
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(doc.title);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docIdRef = useRef(doc.id);

  // Reset when doc changes
  useEffect(() => {
    setTitle(doc.title);
    docIdRef.current = doc.id;
  }, [doc.id, doc.title]);

  // Auto-resize title textarea
  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = "auto";
      titleRef.current.style.height = titleRef.current.scrollHeight + "px";
    }
  }, [title]);

  const debouncedSaveTitle = useCallback(
    (newTitle: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onUpdate(docIdRef.current, { title: newTitle });
      }, 500);
    },
    [onUpdate]
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: { class: "text-primary underline underline-offset-2" },
        }),
        Placeholder.configure({
          placeholder: "Start writing...",
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Underline,
      ],
      content: Object.keys(doc.content).length > 0 ? doc.content : undefined,
      editorProps: {
        attributes: {
          class: "outline-none min-h-[calc(100vh-280px)]",
        },
      },
      onUpdate: ({ editor: e }) => {
        const json = e.getJSON();
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          onUpdate(docIdRef.current, { content: json as Record<string, unknown> });
        }, 500);
      },
    },
    [doc.id]
  );

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-12 py-10">
      <textarea
        ref={titleRef}
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          debouncedSaveTitle(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            editor?.commands.focus("start");
          }
        }}
        placeholder="Untitled"
        className="w-full text-4xl font-bold bg-transparent outline-none resize-none placeholder:text-foreground/15 leading-tight mb-4"
        rows={1}
      />
      <div className="docs-editor prose-custom">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function DocsPage() {
  const { user } = useAuth();
  const { activeProjectId } = useWorkspace();

  const [docs, setDocs] = useState<Doc[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  const tree = useMemo(() => buildTree(docs), [docs]);

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
      updates: { title?: string; content?: Record<string, unknown> }
    ) => {
      await updateDoc(id, updates);
      setDocs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
      );
    },
    []
  );

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
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <span className="text-xs font-medium text-foreground/40 uppercase tracking-wide">
            Pages
          </span>
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
        <div className="flex-1 overflow-y-auto px-1 pb-3">
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
            tree.map((node) => (
              <TreeItem
                key={node.id}
                node={node}
                depth={0}
                activeId={activeDocId}
                onSelect={setActiveDocId}
                onCreateChild={(parentId) => handleCreate(parentId)}
                onDelete={(id) => setDeleteConfirm(id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto">
        {activeDoc ? (
          <DocEditor
            key={activeDoc.id}
            doc={activeDoc}
            onUpdate={handleUpdate}
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
