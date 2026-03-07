"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

export function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, width } = node.attrs;
  const containerRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);
  const [localWidth, setLocalWidth] = useState<number | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    setResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = container.offsetWidth;
    setLocalWidth(container.offsetWidth);
  }, []);

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(100, startWidthRef.current + diff);
      setLocalWidth(newWidth);
    };

    const handleMouseUp = () => {
      setResizing(false);
      if (localWidth !== null) {
        updateAttributes({ width: localWidth });
      }
      setLocalWidth(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing, localWidth, updateAttributes]);

  const displayWidth = localWidth ?? width;

  return (
    <NodeViewWrapper className="docs-image-wrapper">
      <div
        ref={containerRef}
        className={`relative inline-block group ${
          selected ? "ring-2 ring-primary/40 rounded-lg" : ""
        }`}
        style={{ width: displayWidth ? `${displayWidth}px` : undefined, maxWidth: "100%" }}
      >
        <img
          src={src}
          alt={alt || ""}
          className="block rounded-lg w-full"
          draggable={false}
        />
        {/* Right resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`absolute top-0 -right-1 w-3 h-full cursor-col-resize ${
            selected || resizing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          } transition-opacity`}
        >
          <div className="absolute right-0.5 top-1/2 -translate-y-1/2 w-1.5 h-10 rounded-full bg-primary/50 hover:bg-primary/80 transition-colors" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
