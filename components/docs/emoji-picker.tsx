"use client";

import { useState, useEffect, useRef } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface EmojiSelectEvent {
  native: string;
}

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-none shadow-none bg-transparent"
        align="start"
        side="right"
        sideOffset={4}
      >
        <Picker
          data={data}
          onEmojiSelect={(emoji: EmojiSelectEvent) => {
            onChange(emoji.native);
            setOpen(false);
          }}
          theme="auto"
          skinTonePosition="none"
          previewPosition="none"
          maxFrequentRows={1}
          perLine={8}
          set="native"
        />
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
