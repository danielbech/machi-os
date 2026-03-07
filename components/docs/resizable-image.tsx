"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

export function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, width } = node.attrs;
  const imgRef = useRef<HTMLImageElement>(null);
  const [resizing, setResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = imgRef.current?.offsetWidth || 400;
  }, []);

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(100, startWidthRef.current + diff);
      updateAttributes({ width: newWidth });
    };

    const handleMouseUp = () => {
      setResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing, updateAttributes]);

  return (
    <NodeViewWrapper className="docs-image-wrapper" data-drag-handle>
      <div
        className={`relative inline-block group ${
          selected ? "ring-2 ring-primary/40 rounded-lg" : ""
        }`}
        style={{ width: width ? `${width}px` : undefined, maxWidth: "100%" }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt || ""}
          className="block rounded-lg w-full"
          draggable={false}
        />
        {/* Right resize handle */}
        <div
          onMouseDown={handleMouseDown}
          className={`absolute top-0 right-0 w-2 h-full cursor-ew-resize ${
            selected || resizing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          } transition-opacity`}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-foreground/20 hover:bg-foreground/40 transition-colors" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
