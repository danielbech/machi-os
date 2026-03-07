"use client";

import { useState, useRef, useEffect } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    emojis: ["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "😉", "😌", "😍", "🥰", "😘", "😎", "🤩", "🥳", "😏", "🤔", "🤫", "🤭", "😐", "😑", "😶", "🙄", "😬", "🤥", "😷", "🤒"],
  },
  {
    name: "Objects",
    emojis: ["📄", "📝", "📋", "📁", "📂", "📌", "📎", "🔗", "📐", "📏", "🗂️", "🗃️", "🗄️", "📊", "📈", "📉", "🗒️", "🗓️", "📆", "📅", "🔖", "🏷️", "📧", "💌", "📮", "📦", "📫", "📬", "📭", "📪"],
  },
  {
    name: "Symbols",
    emojis: ["⭐", "🌟", "✨", "💫", "🔥", "💡", "💎", "🎯", "🏆", "🎨", "🎬", "🎵", "🎶", "🔔", "📣", "💬", "💭", "🗯️", "❤️", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤", "🤍", "💯", "✅", "❌"],
  },
  {
    name: "Nature",
    emojis: ["🌍", "🌎", "🌏", "🌕", "🌙", "⛅", "🌈", "🌊", "🌸", "🌺", "🌻", "🌹", "🍀", "🌿", "🌱", "🌲", "🌳", "🍃", "🍂", "🍁", "🐕", "🐈", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐸", "🦋"],
  },
  {
    name: "Work",
    emojis: ["💻", "🖥️", "⌨️", "🖱️", "🖨️", "📱", "📞", "☎️", "🔧", "🔨", "⚙️", "🛠️", "🔬", "🔭", "📡", "💰", "💳", "💵", "🏦", "🏢", "🏗️", "🏠", "🏡", "🏛️", "⚖️", "🚀", "✈️", "🚂", "🚗", "🛒"],
  },
  {
    name: "Food",
    emojis: ["☕", "🍵", "🧃", "🥤", "🍷", "🍺", "🍕", "🍔", "🌮", "🍣", "🍜", "🍝", "🥗", "🍰", "🎂", "🍫", "🍬", "🍭", "🍩", "🧁", "🍎", "🍊", "🍋", "🍇", "🍓", "🫐", "🥑", "🥕", "🌽", "🥦"],
  },
];

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
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filteredCategories = search
    ? [{
        name: "Results",
        emojis: EMOJI_CATEGORIES.flatMap((c) => c.emojis),
      }]
    : EMOJI_CATEGORIES;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-[280px] p-0"
        align="start"
        side="right"
        sideOffset={4}
      >
        <div className="p-2 border-b border-foreground/[0.06]">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emoji..."
            className="w-full text-sm bg-transparent outline-none placeholder:text-foreground/20"
          />
        </div>
        <div className="max-h-[240px] overflow-y-auto p-2">
          {filteredCategories.map((cat) => (
            <div key={cat.name}>
              <p className="text-[10px] font-medium text-foreground/30 uppercase tracking-wide mb-1 mt-2 first:mt-0 px-0.5">
                {cat.name}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {cat.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onChange(emoji);
                      setOpen(false);
                    }}
                    className={`size-8 flex items-center justify-center rounded hover:bg-foreground/[0.06] text-lg transition-colors ${
                      value === emoji ? "bg-foreground/[0.08]" : ""
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {value && (
          <div className="p-2 border-t border-foreground/[0.06]">
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
