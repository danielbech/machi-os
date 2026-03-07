"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import data from "@emoji-mart/data";

export function EmojiPicker({
  value,
  onChange,
  children,
}: {
  value?: string;
  onChange: (emoji: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<unknown>(null);

  const handleSelect = useCallback(
    (emoji: { native: string }) => {
      onChange(emoji.native);
      setOpen(false);
    },
    [onChange]
  );

  useEffect(() => {
    if (!open || !containerRef.current) return;

    // Dynamically import emoji-mart (vanilla) to avoid SSR issues
    let cancelled = false;
    import("emoji-mart").then(({ Picker }) => {
      if (cancelled || !containerRef.current) return;
      // Clear previous picker
      containerRef.current.innerHTML = "";
      pickerRef.current = new Picker({
        data,
        onEmojiSelect: handleSelect,
        theme: "auto",
        skinTonePosition: "none",
        previewPosition: "none",
        maxFrequentRows: 1,
        perLine: 8,
        set: "native",
      });
      containerRef.current.appendChild(pickerRef.current as unknown as Node);
    });

    return () => {
      cancelled = true;
    };
  }, [open, handleSelect]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-none shadow-none bg-transparent"
        align="start"
        side="right"
        sideOffset={4}
      >
        <div ref={containerRef} />
        {value && (
          <div className="bg-popover border border-foreground/[0.08] border-t-0 rounded-b-lg px-3 py-2">
            <button
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="text-xs text-foreground/40 hover:text-foreground/60 transition-colors"
            >
              Remove icon
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
