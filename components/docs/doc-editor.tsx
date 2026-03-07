"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { uploadDocImage } from "@/lib/supabase/storage";
import type { Doc, DocComment } from "@/lib/types";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
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
import { Embed } from "@/components/docs/embed-extension";
import { TableOfContents } from "@/components/docs/toc-extension";
import {
  SlashCommandExtension,
  SlashCommandMenu,
  useSlashCommand,
} from "@/components/docs/slash-command";
import { createMentionExtension } from "@/components/docs/mention-extension";
import { EmojiPicker } from "@/components/docs/emoji-picker";
import { TableToolbar } from "@/components/docs/table-toolbar";
import { BubbleToolbar } from "@/components/docs/bubble-toolbar";
import { Breadcrumbs } from "@/components/docs/breadcrumbs";
import { CommentsPanel } from "@/components/docs/comments-panel";
import { CommentMark } from "@/components/docs/comment-mark";
import { loadDocComments } from "@/lib/supabase/docs";
import { ImagePlus } from "lucide-react";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Editor component ────────────────────────────────────────────────────────

export function DocEditor({
  doc,
  docs,
  onUpdate,
  onNavigate,
  projectId,
  userId,
  showComments,
}: {
  doc: Doc;
  docs: Doc[];
  onUpdate: (id: string, updates: { title?: string; content?: Record<string, unknown>; icon?: string | null; cover_image?: string | null }) => void;
  onNavigate: (docId: string) => void;
  projectId: string;
  userId: string;
  showComments: boolean;
}) {
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(doc.title);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docIdRef = useRef(doc.id);
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverHovered, setCoverHovered] = useState(false);
  const [titleHovered, setTitleHovered] = useState(false);
  const [wordCount, setWordCount] = useState({ words: 0, characters: 0 });

  // ─── Comments state ─────────────────────────────────────────────────────
  const [comments, setComments] = useState<DocComment[]>([]);
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);

  // Load comments on mount
  useEffect(() => {
    loadDocComments(doc.id).then((c) => setComments(c));
  }, [doc.id]);

  // Reset when doc changes
  useEffect(() => {
    setTitle(doc.title);
    docIdRef.current = doc.id;
    setCoverHovered(false);
    setTitleHovered(false);
    setPendingSelection(null);
    setActiveCommentId(null);
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

  const handleCoverUpload = useCallback(
    async (file: File) => {
      try {
        const url = await uploadDocImage(file, docIdRef.current);
        onUpdate(docIdRef.current, { cover_image: url });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Cover upload failed: ${msg}`);
      }
    },
    [onUpdate]
  );

  // ─── Comment handler from bubble toolbar ────────────────────────────────
  const handleComment = useCallback(
    (selectedText: string) => {
      setPendingSelection(selectedText);
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
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        Table.configure({ resizable: false, allowTableNodeSelection: true }),
        TableRow,
        TableCell,
        TableHeader,
        ResizableImage.configure({
          HTMLAttributes: { class: "docs-image" },
        }),
        Callout,
        ToggleList,
        Embed,
        TableOfContents,
        SlashCommandExtension,
        createMentionExtension(() => docsRef.current),
        CommentMark,
      ],
      content: Object.keys(doc.content).length > 0 ? doc.content : undefined,
      editorProps: {
        attributes: {
          class: "outline-none min-h-[calc(100vh-280px)]",
        },
        handleClick: (view, pos, event) => {
          const target = event.target as HTMLElement;

          // Handle clicking on comment highlights
          const commentEl = target.closest?.(".comment-highlight");
          if (commentEl) {
            const commentId = commentEl.getAttribute("data-comment-id");
            if (commentId) {
              setActiveCommentId(commentId);
              return false; // Don't prevent default cursor placement
            }
          }

          const mentionEl = target.closest?.(".mention");
          if (mentionEl) {
            const docId = mentionEl.getAttribute("data-id");
            if (docId) {
              onNavigate(docId);
              return true;
            }
          }
          return false;
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
      onCreate: ({ editor: e }) => {
        const text = e.state.doc.textContent;
        const words = text.split(/\s+/).filter(Boolean).length;
        setWordCount({ words, characters: text.length });

        // Apply resolved styles to comment marks on load
        applyResolvedStyles(e, comments);
      },
      onUpdate: ({ editor: e }) => {
        const json = e.getJSON();
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          onUpdate(docIdRef.current, { content: json as Record<string, unknown> });
        }, 500);
        const text = e.state.doc.textContent;
        const words = text.split(/\s+/).filter(Boolean).length;
        setWordCount({ words, characters: text.length });
      },
    },
    [doc.id]
  );

  // Apply resolved styles after comments load
  useEffect(() => {
    if (editor && comments.length > 0) {
      // Small delay to ensure DOM is ready
      setTimeout(() => applyResolvedStyles(editor, comments), 100);
    }
  }, [editor, comments]);

  const slash = useSlashCommand(editor);

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-y-auto">
        {/* Cover image */}
        {doc.cover_image ? (
          <div
            className="relative w-full h-[200px] group/cover"
            onMouseEnter={() => setCoverHovered(true)}
            onMouseLeave={() => setCoverHovered(false)}
          >
            <img
              src={doc.cover_image}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/80 to-transparent" />
            {coverHovered && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-foreground/10 backdrop-blur-sm text-foreground/70 hover:text-foreground hover:bg-foreground/20 transition-colors"
                >
                  Change cover
                </button>
                <button
                  onClick={() => onUpdate(doc.id, { cover_image: null })}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-foreground/10 backdrop-blur-sm text-foreground/70 hover:text-foreground hover:bg-foreground/20 transition-colors"
                >
                  Remove cover
                </button>
              </div>
            )}
          </div>
        ) : null}
        <div className="max-w-3xl mx-auto px-4 md:px-12 py-10">
          {/* Breadcrumbs */}
          <Breadcrumbs docs={docs} activeDocId={doc.id} onNavigate={onNavigate} />
          {/* Icon + Title — pt-8 creates hover zone above for the "Add cover" button */}
          <div
            className="mb-4 relative pt-8 -mt-8"
            onMouseEnter={() => setTitleHovered(true)}
            onMouseLeave={() => setTitleHovered(false)}
          >
            {/* Add cover button — shown on hover when no cover image */}
            {!doc.cover_image && titleHovered && (
              <button
                onClick={() => coverInputRef.current?.click()}
                className="absolute top-1 left-0 flex items-center gap-1 px-2 py-0.5 text-xs text-foreground/30 hover:text-foreground/50 hover:bg-foreground/[0.04] rounded transition-colors"
              >
                <ImagePlus className="size-3.5" />
                Add cover
              </button>
            )}
            <EmojiPicker
              value={doc.icon || undefined}
              onChange={(emoji) => onUpdate(doc.id, { icon: emoji || null })}
            >
              <button className="text-4xl mb-2 hover:bg-foreground/[0.04] rounded-lg p-1 -ml-1 transition-colors">
                {doc.icon || "\ud83d\udcc4"}
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
            {doc.updated_at !== doc.created_at && (
              <p className="text-[11px] text-foreground/25 mt-1">
                Last edited {getRelativeTime(doc.updated_at)}
              </p>
            )}
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
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await handleCoverUpload(file);
              e.target.value = "";
            }}
          />
          <div className="docs-editor prose-custom relative">
            {editor && <TableToolbar editor={editor} />}
            {editor && (
              <BubbleToolbar editor={editor} onComment={handleComment} />
            )}
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
          {/* Word count */}
          <div className="flex justify-end pt-8 pb-4">
            <span className="text-[11px] text-foreground/20">
              {wordCount.words} words &middot; {wordCount.characters} characters
            </span>
          </div>
        </div>
      </div>
      {/* Comments sidebar */}
      {showComments && (
        <div className="w-80 shrink-0 border-l border-foreground/[0.06] flex flex-col">
          <CommentsPanel
            docId={doc.id}
            projectId={projectId}
            userId={userId}
            editor={editor}
            comments={comments}
            onCommentsChange={setComments}
            pendingSelection={pendingSelection}
            onClearPending={() => setPendingSelection(null)}
            activeCommentId={activeCommentId}
            onSetActiveComment={setActiveCommentId}
          />
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * After loading comments, apply the "resolved" CSS class to matching
 * comment-highlight spans in the editor DOM.
 */
function applyResolvedStyles(
  editor: { view: { dom: HTMLElement } },
  comments: DocComment[]
) {
  const resolvedIds = new Set(
    comments.filter((c) => c.resolved_at).map((c) => c.id)
  );

  const editorDom = editor.view.dom;
  const spans = editorDom.querySelectorAll("span[data-comment-id]");
  spans.forEach((span) => {
    const id = span.getAttribute("data-comment-id");
    if (id && resolvedIds.has(id)) {
      span.classList.add("resolved");
    }
  });
}
