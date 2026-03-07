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
  searchDocs,
  loadDocComments,
  createDocComment,
  deleteDocComment,
} from "@/lib/supabase/docs";
import { uploadDocImage } from "@/lib/supabase/storage";
import type { Doc, DocComment } from "@/lib/types";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Image from "@tiptap/extension-image";
import {
  SlashCommandExtension,
  SlashCommandMenu,
  useSlashCommand,
} from "@/components/docs/slash-command";
import { EmojiPicker } from "@/components/docs/emoji-picker";
import { TableToolbar } from "@/components/docs/table-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search,
  MessageSquare,
  Send,
  X,
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

// ─── Comments panel ──────────────────────────────────────────────────────────

function CommentsPanel({
  docId,
  projectId,
  userId,
}: {
  docId: string;
  projectId: string;
  userId: string;
}) {
  const [comments, setComments] = useState<DocComment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    loadDocComments(docId).then((c) => {
      setComments(c);
      setLoading(false);
    });
  }, [docId]);

  const handleSubmit = async () => {
    if (!draft.trim()) return;
    const comment = await createDocComment({
      doc_id: docId,
      project_id: projectId,
      user_id: userId,
      content: draft.trim(),
    });
    setComments((prev) => [...prev, comment]);
    setDraft("");
    inputRef.current?.focus();
  };

  const handleDelete = async (id: string) => {
    await deleteDocComment(id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const topLevel = comments.filter((c) => !c.parent_id);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-foreground/[0.06]">
        <span className="text-xs font-medium text-foreground/40 uppercase tracking-wide">
          Comments ({topLevel.length})
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 bg-foreground/[0.03] rounded animate-pulse" />
            ))}
          </div>
        ) : topLevel.length === 0 ? (
          <p className="text-xs text-foreground/25 text-center py-4">No comments yet</p>
        ) : (
          topLevel.map((comment) => {
            const replies = comments.filter((c) => c.parent_id === comment.id);
            return (
              <div key={comment.id} className="group">
                <div className="rounded-lg bg-foreground/[0.03] px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-foreground/30">
                      {new Date(comment.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                    {comment.user_id === userId && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="text-foreground/15 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-foreground/70 whitespace-pre-wrap">{comment.content}</p>
                </div>
                {replies.map((reply) => (
                  <div key={reply.id} className="ml-4 mt-1.5 group/reply">
                    <div className="rounded-lg bg-foreground/[0.02] px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-foreground/25">
                          {new Date(reply.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        {reply.user_id === userId && (
                          <button
                            onClick={() => handleDelete(reply.id)}
                            className="text-foreground/15 hover:text-destructive opacity-0 group-hover/reply:opacity-100 transition-opacity"
                            aria-label="Delete reply"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-foreground/60 whitespace-pre-wrap">{reply.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
      <div className="p-3 border-t border-foreground/[0.06]">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Add a comment..."
            className="text-sm"
          />
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={handleSubmit}
            disabled={!draft.trim()}
            className="shrink-0 text-foreground/30 hover:text-foreground/60"
            aria-label="Send comment"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Search dialog ───────────────────────────────────────────────────────────

function SearchDialog({
  open,
  onOpenChange,
  projectId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSelect: (docId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Doc[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const r = await searchDocs(projectId, query.trim());
      setResults(r);
      setSearching(false);
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, projectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-foreground/[0.06]">
          <Search className="size-4 text-foreground/30 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-foreground/25"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-foreground/20 hover:text-foreground/40">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {!query.trim() ? (
            <p className="text-xs text-foreground/25 text-center py-8">
              Type to search across all pages
            </p>
          ) : searching ? (
            <div className="py-8 text-center">
              <p className="text-xs text-foreground/25">Searching...</p>
            </div>
          ) : results.length === 0 ? (
            <p className="text-xs text-foreground/25 text-center py-8">No pages found</p>
          ) : (
            results.map((doc) => (
              <button
                key={doc.id}
                onClick={() => {
                  onSelect(doc.id);
                  onOpenChange(false);
                }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-foreground/[0.04] transition-colors"
              >
                <span className="text-base shrink-0">{doc.icon || "📄"}</span>
                <span className="text-sm truncate">{doc.title || "Untitled"}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Editor component ────────────────────────────────────────────────────────

function DocEditor({
  doc,
  onUpdate,
  projectId,
  userId,
  showComments,
}: {
  doc: Doc;
  onUpdate: (id: string, updates: { title?: string; content?: Record<string, unknown>; icon?: string | null }) => void;
  projectId: string;
  userId: string;
  showComments: boolean;
}) {
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(doc.title);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docIdRef = useRef(doc.id);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageUpload = useCallback(
    async (file: File) => {
      try {
        const url = await uploadDocImage(file, docIdRef.current);
        return url;
      } catch {
        toast.error("Failed to upload image");
        return null;
      }
    },
    []
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
          placeholder: "Type '/' for commands...",
        }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Underline,
        Table.configure({ resizable: false, allowTableNodeSelection: true }),
        TableRow,
        TableCell,
        TableHeader,
        Image.configure({
          HTMLAttributes: { class: "docs-image" },
        }),
        SlashCommandExtension,
      ],
      content: Object.keys(doc.content).length > 0 ? doc.content : undefined,
      editorProps: {
        attributes: {
          class: "outline-none min-h-[calc(100vh-280px)]",
        },
        handleDrop: (view, event) => {
          const files = event.dataTransfer?.files;
          if (!files?.length) return false;
          const file = files[0];
          if (!file.type.startsWith("image/")) return false;
          event.preventDefault();
          handleImageUpload(file).then((url) => {
            if (url) {
              const { tr } = view.state;
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (pos) {
                const node = view.state.schema.nodes.image.create({ src: url });
                view.dispatch(tr.insert(pos.pos, node));
              }
            }
          });
          return true;
        },
        handlePaste: (view, event) => {
          const files = event.clipboardData?.files;
          if (!files?.length) return false;
          const file = files[0];
          if (!file.type.startsWith("image/")) return false;
          event.preventDefault();
          handleImageUpload(file).then((url) => {
            if (url) {
              const { tr, selection } = view.state;
              const node = view.state.schema.nodes.image.create({ src: url });
              view.dispatch(tr.replaceSelectionWith(node));
            }
          });
          return true;
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

  const slash = useSlashCommand(editor);

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-12 py-10">
          {/* Icon + Title */}
          <div className="mb-4">
            <EmojiPicker
              value={doc.icon || undefined}
              onChange={(emoji) => onUpdate(doc.id, { icon: emoji || null })}
            >
              <button className="text-4xl mb-2 hover:bg-foreground/[0.04] rounded-lg p-1 -ml-1 transition-colors">
                {doc.icon || "📄"}
              </button>
            </EmojiPicker>
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
              className="w-full text-4xl font-bold bg-transparent outline-none resize-none placeholder:text-foreground/15 leading-tight"
              rows={1}
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            data-doc-image-upload
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !editor) return;
              const url = await handleImageUpload(file);
              if (url) {
                editor.chain().focus().setImage({ src: url }).run();
              }
              e.target.value = "";
            }}
          />
          <div className="docs-editor prose-custom relative">
            {editor && <TableToolbar editor={editor} />}
            <EditorContent editor={editor} />
            {slash.active && slash.range && slash.coords && editor && (
              <div
                className="fixed z-50"
                style={{ top: slash.coords.top, left: slash.coords.left }}
              >
                <SlashCommandMenu
                  editor={editor}
                  range={slash.range}
                  query={slash.query}
                  onClose={slash.close}
                />
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Comments sidebar */}
      {showComments && (
        <div className="w-72 shrink-0 border-l border-foreground/[0.06] flex flex-col">
          <CommentsPanel docId={doc.id} projectId={projectId} userId={userId} />
        </div>
      )}
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
  const [showComments, setShowComments] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

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
      updates: { title?: string; content?: Record<string, unknown>; icon?: string | null }
    ) => {
      await updateDoc(id, updates);
      setDocs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
      );
    },
    []
  );

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
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
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeDoc && (
          <div className="flex items-center justify-end gap-1 px-4 py-2 border-b border-foreground/[0.04]">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setShowComments((v) => !v)}
              className={`${showComments ? "text-foreground/60" : "text-foreground/25 hover:text-foreground/50"}`}
              aria-label="Toggle comments"
            >
              <MessageSquare className="size-3.5" />
            </Button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">
        {activeDoc ? (
          <DocEditor
            key={activeDoc.id}
            doc={activeDoc}
            onUpdate={handleUpdate}
            projectId={activeProjectId!}
            userId={user!.id}
            showComments={showComments}
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

      {/* Search dialog */}
      {activeProjectId && (
        <SearchDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          projectId={activeProjectId}
          onSelect={(docId) => setActiveDocId(docId)}
        />
      )}

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
