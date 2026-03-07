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
  reorderDocs,
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
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { mergeAttributes } from "@tiptap/core";
import { common, createLowlight } from "lowlight";
import { ResizableImage } from "@/components/docs/image-extension";
import { Callout } from "@/components/docs/callout-extension";
import { ToggleList } from "@/components/docs/toggle-extension";
import {
  SlashCommandExtension,
  SlashCommandMenu,
  useSlashCommand,
} from "@/components/docs/slash-command";
import { EmojiPicker } from "@/components/docs/emoji-picker";
import { TableToolbar } from "@/components/docs/table-toolbar";
import { BubbleToolbar } from "@/components/docs/bubble-toolbar";
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
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
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
  GripVertical,
} from "lucide-react";

// ─── Lowlight (syntax highlighting) ──────────────────────────────────────────

const lowlight = createLowlight(common);

const CodeBlockWithLanguage = CodeBlockLowlight.extend({
  renderHTML({ node, HTMLAttributes }) {
    const language = node.attrs.language;
    return [
      "pre",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        ...(language ? { "data-language": language } : {}),
      }),
      [
        "code",
        {
          class: language
            ? this.options.languageClassPrefix + language
            : null,
        },
        0,
      ],
    ];
  },
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface DocTreeNode extends Doc {
  children: DocTreeNode[];
}

interface FlatItem {
  id: string;
  doc: Doc;
  depth: number;
  hasChildren: boolean;
  parentId: string | null;
}

type DropPosition = "before" | "after" | "child";

interface DropIndicator {
  overId: string;
  position: DropPosition;
  depth: number;
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

// ─── Drop indicator line ─────────────────────────────────────────────────────

function DropLine({ depth }: { depth: number }) {
  return (
    <div
      className="h-0.5 bg-primary rounded-full"
      style={{ marginLeft: `${depth * 16 + 8}px`, marginRight: 8 }}
    />
  );
}

// ─── Sortable page tree item ─────────────────────────────────────────────────

function SortableTreeItem({
  item,
  activeId: selectedId,
  onSelect,
  onCreateChild,
  onDelete,
  onToggle,
  expanded,
  dropIndicator,
}: {
  item: FlatItem;
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  expanded: boolean;
  dropIndicator: DropIndicator | null;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const isActive = selectedId === item.id;
  const isDropChild = dropIndicator?.overId === item.id && dropIndicator.position === "child";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} data-sortable-id={item.id}>
      {/* Drop line above */}
      {dropIndicator?.overId === item.id && dropIndicator.position === "before" && (
        <DropLine depth={dropIndicator.depth} />
      )}
      <div
        className={`group flex items-center gap-0.5 py-1 px-1 rounded-md text-sm cursor-pointer transition-colors ${
          isDropChild
            ? "bg-primary/10 ring-1 ring-primary/30"
            : isActive
              ? "bg-foreground/[0.08] text-foreground"
              : "text-foreground/60 hover:bg-foreground/[0.04] hover:text-foreground/80"
        }`}
        style={{ paddingLeft: `${item.depth * 16 + 4}px` }}
        onClick={() => onSelect(item.id)}
      >
        <div
          {...listeners}
          className="shrink-0 size-5 flex items-center justify-center rounded cursor-grab active:cursor-grabbing text-transparent group-hover:text-foreground/20 hover:!text-foreground/40 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="size-3" />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(item.id);
          }}
          className={`shrink-0 size-5 flex items-center justify-center rounded transition-colors hover:bg-foreground/[0.06] ${
            item.hasChildren ? "text-foreground/30" : "text-transparent"
          }`}
        >
          <ChevronRight
            className={`size-3 transition-transform duration-150 ${
              expanded ? "rotate-90" : ""
            }`}
          />
        </button>
        <span className="text-base leading-none shrink-0">
          {item.doc.icon || "📄"}
        </span>
        <span className="flex-1 truncate">{item.doc.title || "Untitled"}</span>
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateChild(item.id);
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
              <DropdownMenuItem onClick={() => onCreateChild(item.id)}>
                <FilePlus className="size-4" />
                Add sub-page
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Drop line below */}
      {dropIndicator?.overId === item.id && dropIndicator.position === "after" && (
        <DropLine depth={dropIndicator.depth} />
      )}
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (msg.includes("Bucket not found") || msg.includes("not found")) {
          toast.error("Image storage not configured. Create a 'doc-images' bucket in Supabase.");
        } else {
          toast.error(`Image upload failed: ${msg}`);
        }
        return null;
      }
    },
    []
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          heading: { levels: [1, 2, 3] },
        }),
        CodeBlockWithLanguage.configure({
          lowlight,
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
        ResizableImage.configure({
          HTMLAttributes: { class: "docs-image" },
        }),
        Callout,
        ToggleList,
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

          // Insert base64 immediately for instant feedback
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (pos) {
              const node = view.state.schema.nodes.image.create({ src: dataUrl, width: null });
              const tr = view.state.tr.insert(pos.pos, node);
              view.dispatch(tr);
            }

            // Upload in background and swap URL
            handleImageUpload(file).then((url) => {
              if (!url) return;
              const { state } = view;
              const swapTr = state.tr;
              state.doc.descendants((n, p) => {
                if (n.type.name === "image" && n.attrs.src === dataUrl) {
                  swapTr.setNodeMarkup(p, undefined, { ...n.attrs, src: url });
                }
              });
              if (swapTr.docChanged) view.dispatch(swapTr);
            });
          };
          reader.readAsDataURL(file);
          return true;
        },
        handlePaste: (view, event) => {
          const files = event.clipboardData?.files;
          if (!files?.length) return false;
          const file = files[0];
          if (!file.type.startsWith("image/")) return false;
          event.preventDefault();

          // Insert base64 immediately for instant feedback
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const node = view.state.schema.nodes.image.create({ src: dataUrl, width: null });
            const tr = view.state.tr.replaceSelectionWith(node);
            view.dispatch(tr);

            // Upload in background and swap URL
            handleImageUpload(file).then((url) => {
              if (!url) return;
              const { state } = view;
              const swapTr = state.tr;
              state.doc.descendants((n, p) => {
                if (n.type.name === "image" && n.attrs.src === dataUrl) {
                  swapTr.setNodeMarkup(p, undefined, { ...n.attrs, src: url });
                }
              });
              if (swapTr.docChanged) view.dispatch(swapTr);
            });
          };
          reader.readAsDataURL(file);
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
            {editor && <BubbleToolbar editor={editor} />}
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
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
        <div ref={sidebarRef} className="flex-1 overflow-y-auto px-1 pb-3">
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
              modifiers={[restrictToVerticalAxis]}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
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
                    onDelete={(id) => setDeleteConfirm(id)}
                    onToggle={toggleExpanded}
                    expanded={expandedIds.has(item.id)}
                    dropIndicator={
                      dragActiveId && dragActiveId !== item.id && dropIndicator?.overId === item.id
                        ? dropIndicator
                        : null
                    }
                  />
                ))}
              </SortableContext>
              <DragOverlay>
                {dragActiveId ? (() => {
                  const item = flatItems.find((i) => i.id === dragActiveId);
                  if (!item) return null;
                  return (
                    <div className="flex items-center gap-1 py-1 px-2 rounded-md text-sm bg-popover border border-foreground/[0.08] shadow-lg">
                      <span className="text-base leading-none shrink-0">
                        {item.doc.icon || "📄"}
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
