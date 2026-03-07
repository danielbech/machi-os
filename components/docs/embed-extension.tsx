"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { useState, useRef, useCallback, useEffect } from "react";
import { X, Globe, ExternalLink } from "lucide-react";

// ─── URL detection helpers ──────────────────────────────────────────────────

type EmbedType = "youtube" | "figma" | "generic";

function detectEmbedType(url: string): EmbedType {
  if (
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)/i.test(url)
  ) {
    return "youtube";
  }
  if (/figma\.com\//i.test(url)) {
    return "figma";
  }
  return "generic";
}

function extractYouTubeId(url: string): string | null {
  // youtube.com/watch?v=ID
  const longMatch = url.match(
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
  );
  if (longMatch) return longMatch[1];

  // youtu.be/ID
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];

  return null;
}

function getYouTubeEmbedUrl(url: string): string | null {
  const id = extractYouTubeId(url);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}`;
}

function getFigmaEmbedUrl(url: string): string {
  return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
}

// ─── React component for the node view ──────────────────────────────────────

function EmbedView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { src, type, width } = node.attrs as {
    src: string;
    type: EmbedType;
    width: string;
  };

  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the input when the embed has no src
  useEffect(() => {
    if (!src && inputRef.current) {
      // Small delay so Tiptap finishes inserting the node
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [src]);

  const handleSubmit = useCallback(() => {
    const url = inputValue.trim();
    if (!url) return;

    const detectedType = detectEmbedType(url);
    updateAttributes({ src: url, type: detectedType });
    setInputValue("");
  }, [inputValue, updateAttributes]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleSubmit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        deleteNode();
      }
      // Prevent Tiptap from handling typing inside the input
      e.stopPropagation();
    },
    [handleSubmit, deleteNode]
  );

  // ── Empty state: show URL input ──────────────────────────────────────────

  if (!src) {
    return (
      <NodeViewWrapper className="embed-wrapper" data-embed-type="input">
        <div className="embed-input-card" contentEditable={false}>
          <Globe className="embed-input-icon" size={18} />
          <input
            ref={inputRef}
            type="url"
            className="embed-url-input"
            placeholder="Paste a URL (YouTube, Figma, or any link)..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className="embed-remove-btn"
            onClick={() => deleteNode()}
            aria-label="Remove embed"
          >
            <X size={14} />
          </button>
        </div>
      </NodeViewWrapper>
    );
  }

  // ── YouTube embed ────────────────────────────────────────────────────────

  if (type === "youtube") {
    const embedUrl = getYouTubeEmbedUrl(src);
    return (
      <NodeViewWrapper className="embed-wrapper" data-embed-type="youtube" style={{ width }}>
        <div className="embed-iframe-container" contentEditable={false}>
          <div className="embed-aspect-ratio">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                className="embed-iframe"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                allowFullScreen
                loading="lazy"
                title="YouTube video"
              />
            ) : (
              <div className="embed-error">Invalid YouTube URL</div>
            )}
          </div>
          <button
            type="button"
            className="embed-remove-btn embed-remove-overlay"
            onClick={() => deleteNode()}
            aria-label="Remove embed"
          >
            <X size={14} />
          </button>
        </div>
      </NodeViewWrapper>
    );
  }

  // ── Figma embed ──────────────────────────────────────────────────────────

  if (type === "figma") {
    const embedUrl = getFigmaEmbedUrl(src);
    return (
      <NodeViewWrapper className="embed-wrapper" data-embed-type="figma" style={{ width }}>
        <div className="embed-iframe-container" contentEditable={false}>
          <div className="embed-aspect-ratio embed-aspect-figma">
            <iframe
              src={embedUrl}
              className="embed-iframe"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              allowFullScreen
              loading="lazy"
              title="Figma embed"
            />
          </div>
          <button
            type="button"
            className="embed-remove-btn embed-remove-overlay"
            onClick={() => deleteNode()}
            aria-label="Remove embed"
          >
            <X size={14} />
          </button>
        </div>
      </NodeViewWrapper>
    );
  }

  // ── Generic URL card ─────────────────────────────────────────────────────

  return (
    <NodeViewWrapper className="embed-wrapper" data-embed-type="generic" style={{ width }}>
      <div className="embed-link-card" contentEditable={false}>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="embed-link-anchor"
        >
          <ExternalLink className="embed-link-icon" size={16} />
          <span className="embed-link-url">{src}</span>
        </a>
        <button
          type="button"
          className="embed-remove-btn"
          onClick={() => deleteNode()}
          aria-label="Remove embed"
        >
          <X size={14} />
        </button>
      </div>
    </NodeViewWrapper>
  );
}

// ─── Tiptap Node extension ──────────────────────────────────────────────────

export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-embed-src") || "",
        renderHTML: (attributes) => ({
          "data-embed-src": attributes.src,
        }),
      },
      type: {
        default: "generic",
        parseHTML: (element) => element.getAttribute("data-embed-type") || "generic",
        renderHTML: (attributes) => ({
          "data-embed-type": attributes.type,
        }),
      },
      width: {
        default: "100%",
        parseHTML: (element) => element.getAttribute("data-embed-width") || "100%",
        renderHTML: (attributes) => ({
          "data-embed-width": attributes.width,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-embed-src]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { class: "embed-wrapper" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedView);
  },

  addCommands() {
    return {
      setEmbed:
        (attrs?: { src?: string }) =>
        ({ commands }: { commands: any }) => {
          const src = attrs?.src || "";
          const type = src ? detectEmbedType(src) : "generic";
          return commands.insertContent({
            type: this.name,
            attrs: { src, type },
          });
        },
    } as any;
  },
});
