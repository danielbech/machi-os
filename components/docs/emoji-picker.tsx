"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EmojiEntry {
  emoji: string;
  keywords: string[];
}

const EMOJI_DATA: { name: string; entries: EmojiEntry[] }[] = [
  {
    name: "Smileys",
    entries: [
      { emoji: "😀", keywords: ["grin", "happy", "smile"] },
      { emoji: "😃", keywords: ["happy", "smile", "big"] },
      { emoji: "😄", keywords: ["laugh", "happy", "smile"] },
      { emoji: "😁", keywords: ["grin", "beam", "happy"] },
      { emoji: "😅", keywords: ["sweat", "nervous", "laugh"] },
      { emoji: "😂", keywords: ["cry", "laugh", "tears", "joy"] },
      { emoji: "🤣", keywords: ["rolling", "laugh", "floor"] },
      { emoji: "😊", keywords: ["blush", "happy", "smile"] },
      { emoji: "😇", keywords: ["angel", "halo", "innocent"] },
      { emoji: "🙂", keywords: ["smile", "slight"] },
      { emoji: "😉", keywords: ["wink"] },
      { emoji: "😌", keywords: ["relieved", "content", "calm"] },
      { emoji: "😍", keywords: ["love", "heart", "eyes"] },
      { emoji: "🥰", keywords: ["love", "hearts", "adore"] },
      { emoji: "😘", keywords: ["kiss", "love", "blow"] },
      { emoji: "😎", keywords: ["cool", "sunglasses"] },
      { emoji: "🤩", keywords: ["star", "struck", "excited"] },
      { emoji: "🥳", keywords: ["party", "celebrate", "birthday"] },
      { emoji: "😏", keywords: ["smirk", "sly"] },
      { emoji: "🤔", keywords: ["think", "hmm", "question"] },
      { emoji: "🤫", keywords: ["quiet", "shush", "secret"] },
      { emoji: "🤭", keywords: ["oops", "giggle", "cover"] },
      { emoji: "😐", keywords: ["neutral", "blank"] },
      { emoji: "😑", keywords: ["expressionless", "flat"] },
      { emoji: "😶", keywords: ["silent", "mute", "quiet"] },
      { emoji: "🙄", keywords: ["eye", "roll", "annoyed"] },
      { emoji: "😬", keywords: ["grimace", "awkward"] },
      { emoji: "😷", keywords: ["mask", "sick", "medical"] },
      { emoji: "🤒", keywords: ["sick", "thermometer", "fever"] },
      { emoji: "👋", keywords: ["wave", "hello", "hi", "bye"] },
      { emoji: "👍", keywords: ["thumbs", "up", "yes", "good", "like"] },
      { emoji: "👎", keywords: ["thumbs", "down", "no", "bad", "dislike"] },
      { emoji: "👏", keywords: ["clap", "applause", "bravo"] },
      { emoji: "🤝", keywords: ["handshake", "deal", "agree"] },
      { emoji: "💪", keywords: ["strong", "muscle", "flex", "power"] },
    ],
  },
  {
    name: "Objects",
    entries: [
      { emoji: "📄", keywords: ["page", "document", "file", "paper"] },
      { emoji: "📝", keywords: ["memo", "note", "write", "edit"] },
      { emoji: "📋", keywords: ["clipboard", "list", "checklist"] },
      { emoji: "📁", keywords: ["folder", "directory"] },
      { emoji: "📂", keywords: ["folder", "open", "directory"] },
      { emoji: "📌", keywords: ["pin", "pushpin", "location"] },
      { emoji: "📎", keywords: ["paperclip", "attach"] },
      { emoji: "🔗", keywords: ["link", "chain", "url"] },
      { emoji: "📐", keywords: ["ruler", "triangle", "math"] },
      { emoji: "📏", keywords: ["ruler", "straight", "measure"] },
      { emoji: "🗂️", keywords: ["divider", "tab", "index"] },
      { emoji: "🗃️", keywords: ["card", "box", "file"] },
      { emoji: "🗄️", keywords: ["cabinet", "filing"] },
      { emoji: "📊", keywords: ["chart", "bar", "graph", "stats"] },
      { emoji: "📈", keywords: ["chart", "up", "growth", "trending"] },
      { emoji: "📉", keywords: ["chart", "down", "decline"] },
      { emoji: "🗒️", keywords: ["notepad", "spiral"] },
      { emoji: "🗓️", keywords: ["calendar", "spiral", "date"] },
      { emoji: "📆", keywords: ["calendar", "date", "schedule"] },
      { emoji: "📅", keywords: ["calendar", "date"] },
      { emoji: "🔖", keywords: ["bookmark", "tag"] },
      { emoji: "🏷️", keywords: ["label", "tag", "price"] },
      { emoji: "📧", keywords: ["email", "mail", "envelope"] },
      { emoji: "💌", keywords: ["love", "letter", "mail"] },
      { emoji: "📦", keywords: ["package", "box", "delivery"] },
      { emoji: "🔑", keywords: ["key", "lock", "password", "access"] },
      { emoji: "🔒", keywords: ["lock", "secure", "private"] },
      { emoji: "🔓", keywords: ["unlock", "open"] },
      { emoji: "🔔", keywords: ["bell", "notification", "alert"] },
      { emoji: "📣", keywords: ["megaphone", "announce"] },
    ],
  },
  {
    name: "Symbols",
    entries: [
      { emoji: "⭐", keywords: ["star", "favorite", "important"] },
      { emoji: "🌟", keywords: ["star", "glow", "shine"] },
      { emoji: "✨", keywords: ["sparkle", "magic", "new"] },
      { emoji: "💫", keywords: ["dizzy", "star", "shooting"] },
      { emoji: "🔥", keywords: ["fire", "hot", "trending", "lit"] },
      { emoji: "💡", keywords: ["idea", "bulb", "light", "tip"] },
      { emoji: "💎", keywords: ["gem", "diamond", "jewel", "premium"] },
      { emoji: "🎯", keywords: ["target", "goal", "bullseye", "aim"] },
      { emoji: "🏆", keywords: ["trophy", "winner", "award", "first"] },
      { emoji: "🎨", keywords: ["art", "paint", "palette", "design", "color"] },
      { emoji: "🎬", keywords: ["movie", "film", "clapper", "action"] },
      { emoji: "🎵", keywords: ["music", "note", "song"] },
      { emoji: "🎶", keywords: ["music", "notes", "song"] },
      { emoji: "💬", keywords: ["speech", "bubble", "chat", "comment"] },
      { emoji: "💭", keywords: ["thought", "bubble", "think"] },
      { emoji: "❤️", keywords: ["heart", "love", "red"] },
      { emoji: "🧡", keywords: ["heart", "orange"] },
      { emoji: "💛", keywords: ["heart", "yellow"] },
      { emoji: "💚", keywords: ["heart", "green"] },
      { emoji: "💙", keywords: ["heart", "blue"] },
      { emoji: "💜", keywords: ["heart", "purple"] },
      { emoji: "🖤", keywords: ["heart", "black"] },
      { emoji: "🤍", keywords: ["heart", "white"] },
      { emoji: "💯", keywords: ["hundred", "perfect", "score"] },
      { emoji: "✅", keywords: ["check", "done", "complete", "yes"] },
      { emoji: "❌", keywords: ["cross", "no", "wrong", "cancel"] },
      { emoji: "⚠️", keywords: ["warning", "alert", "caution"] },
      { emoji: "🚫", keywords: ["forbidden", "prohibited", "no"] },
      { emoji: "❓", keywords: ["question", "help", "ask"] },
      { emoji: "❗", keywords: ["exclamation", "important", "alert"] },
    ],
  },
  {
    name: "Nature",
    entries: [
      { emoji: "🌍", keywords: ["earth", "globe", "world", "europe"] },
      { emoji: "🌎", keywords: ["earth", "globe", "world", "americas"] },
      { emoji: "🌏", keywords: ["earth", "globe", "world", "asia"] },
      { emoji: "🌕", keywords: ["moon", "full"] },
      { emoji: "🌙", keywords: ["moon", "crescent", "night"] },
      { emoji: "☀️", keywords: ["sun", "sunny", "bright"] },
      { emoji: "⛅", keywords: ["cloud", "sun", "weather"] },
      { emoji: "🌈", keywords: ["rainbow"] },
      { emoji: "🌊", keywords: ["wave", "ocean", "sea", "water"] },
      { emoji: "🌸", keywords: ["cherry", "blossom", "flower", "spring"] },
      { emoji: "🌺", keywords: ["hibiscus", "flower"] },
      { emoji: "🌻", keywords: ["sunflower", "flower"] },
      { emoji: "🌹", keywords: ["rose", "flower", "love"] },
      { emoji: "🍀", keywords: ["clover", "luck", "four", "leaf"] },
      { emoji: "🌿", keywords: ["herb", "leaf", "green", "plant"] },
      { emoji: "🌱", keywords: ["seedling", "grow", "plant", "sprout"] },
      { emoji: "🌲", keywords: ["tree", "evergreen", "pine"] },
      { emoji: "🌳", keywords: ["tree", "deciduous"] },
      { emoji: "🍃", keywords: ["leaf", "wind", "flutter"] },
      { emoji: "🍂", keywords: ["leaf", "fall", "autumn"] },
      { emoji: "🐕", keywords: ["dog", "pet", "puppy"] },
      { emoji: "🐈", keywords: ["cat", "pet", "kitten"] },
      { emoji: "🦊", keywords: ["fox", "face"] },
      { emoji: "🐻", keywords: ["bear", "face"] },
      { emoji: "🐼", keywords: ["panda", "bear"] },
      { emoji: "🐨", keywords: ["koala"] },
      { emoji: "🐯", keywords: ["tiger", "face"] },
      { emoji: "🦁", keywords: ["lion", "face", "king"] },
      { emoji: "🐸", keywords: ["frog", "face"] },
      { emoji: "🦋", keywords: ["butterfly"] },
    ],
  },
  {
    name: "Work",
    entries: [
      { emoji: "💻", keywords: ["laptop", "computer", "code", "dev"] },
      { emoji: "🖥️", keywords: ["desktop", "computer", "monitor", "screen"] },
      { emoji: "⌨️", keywords: ["keyboard", "type"] },
      { emoji: "🖱️", keywords: ["mouse", "click"] },
      { emoji: "🖨️", keywords: ["printer", "print"] },
      { emoji: "📱", keywords: ["phone", "mobile", "cell", "app"] },
      { emoji: "📞", keywords: ["phone", "call", "telephone"] },
      { emoji: "🔧", keywords: ["wrench", "tool", "fix", "settings"] },
      { emoji: "🔨", keywords: ["hammer", "tool", "build"] },
      { emoji: "⚙️", keywords: ["gear", "settings", "config"] },
      { emoji: "🛠️", keywords: ["tools", "build", "fix", "hammer", "wrench"] },
      { emoji: "🔬", keywords: ["microscope", "science", "research"] },
      { emoji: "🔭", keywords: ["telescope", "explore", "space"] },
      { emoji: "📡", keywords: ["satellite", "antenna", "signal"] },
      { emoji: "💰", keywords: ["money", "bag", "rich", "dollar"] },
      { emoji: "💳", keywords: ["card", "credit", "payment"] },
      { emoji: "💵", keywords: ["money", "dollar", "bill", "cash"] },
      { emoji: "🏦", keywords: ["bank", "money", "finance"] },
      { emoji: "🏢", keywords: ["office", "building", "work"] },
      { emoji: "🏗️", keywords: ["construction", "build", "crane"] },
      { emoji: "🏠", keywords: ["house", "home"] },
      { emoji: "🏡", keywords: ["house", "garden", "home"] },
      { emoji: "🏛️", keywords: ["classical", "building", "museum"] },
      { emoji: "⚖️", keywords: ["scales", "balance", "justice", "law"] },
      { emoji: "🚀", keywords: ["rocket", "launch", "ship", "fast", "startup"] },
      { emoji: "✈️", keywords: ["airplane", "travel", "flight"] },
      { emoji: "🚂", keywords: ["train", "locomotive", "railway"] },
      { emoji: "🚗", keywords: ["car", "automobile", "drive"] },
      { emoji: "🛒", keywords: ["cart", "shopping"] },
      { emoji: "🧪", keywords: ["test", "tube", "experiment", "science"] },
    ],
  },
  {
    name: "Food",
    entries: [
      { emoji: "☕", keywords: ["coffee", "cup", "hot", "drink", "cafe"] },
      { emoji: "🍵", keywords: ["tea", "cup", "drink", "green"] },
      { emoji: "🧃", keywords: ["juice", "box", "drink"] },
      { emoji: "🥤", keywords: ["cup", "straw", "drink", "soda"] },
      { emoji: "🍷", keywords: ["wine", "glass", "drink", "red"] },
      { emoji: "🍺", keywords: ["beer", "mug", "drink"] },
      { emoji: "🍕", keywords: ["pizza", "slice", "food"] },
      { emoji: "🍔", keywords: ["burger", "hamburger", "food"] },
      { emoji: "🌮", keywords: ["taco", "food", "mexican"] },
      { emoji: "🍣", keywords: ["sushi", "food", "japanese"] },
      { emoji: "🍜", keywords: ["noodle", "ramen", "food", "bowl"] },
      { emoji: "🍝", keywords: ["spaghetti", "pasta", "food"] },
      { emoji: "🥗", keywords: ["salad", "food", "healthy", "green"] },
      { emoji: "🍰", keywords: ["cake", "shortcake", "dessert"] },
      { emoji: "🎂", keywords: ["cake", "birthday", "party"] },
      { emoji: "🍫", keywords: ["chocolate", "candy", "sweet"] },
      { emoji: "🍬", keywords: ["candy", "sweet"] },
      { emoji: "🍭", keywords: ["lollipop", "candy", "sweet"] },
      { emoji: "🍩", keywords: ["donut", "doughnut", "sweet"] },
      { emoji: "🧁", keywords: ["cupcake", "sweet", "dessert"] },
      { emoji: "🍎", keywords: ["apple", "red", "fruit"] },
      { emoji: "🍊", keywords: ["orange", "tangerine", "fruit"] },
      { emoji: "🍋", keywords: ["lemon", "yellow", "fruit"] },
      { emoji: "🍇", keywords: ["grapes", "fruit", "purple"] },
      { emoji: "🍓", keywords: ["strawberry", "fruit", "berry"] },
      { emoji: "🫐", keywords: ["blueberry", "fruit", "berry"] },
      { emoji: "🥑", keywords: ["avocado", "fruit", "green"] },
      { emoji: "🥕", keywords: ["carrot", "vegetable", "orange"] },
      { emoji: "🌽", keywords: ["corn", "maize", "vegetable"] },
      { emoji: "🥦", keywords: ["broccoli", "vegetable", "green"] },
    ],
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

  const filtered = useMemo(() => {
    if (!search.trim()) return EMOJI_DATA;

    const q = search.toLowerCase().trim();
    const matchingEntries = EMOJI_DATA.flatMap((cat) =>
      cat.entries.filter((e) =>
        e.keywords.some((k) => k.includes(q))
      )
    );

    if (matchingEntries.length === 0) return [];
    return [{ name: "Results", entries: matchingEntries }];
  }, [search]);

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
          {filtered.length === 0 ? (
            <p className="text-xs text-foreground/25 text-center py-6">No emoji found</p>
          ) : (
            filtered.map((cat) => (
              <div key={cat.name}>
                <p className="text-[10px] font-medium text-foreground/30 uppercase tracking-wide mb-1 mt-2 first:mt-0 px-0.5">
                  {cat.name}
                </p>
                <div className="grid grid-cols-8 gap-0.5">
                  {cat.entries.map((entry) => (
                    <button
                      key={entry.emoji}
                      onClick={() => {
                        onChange(entry.emoji);
                        setOpen(false);
                      }}
                      className={`size-8 flex items-center justify-center rounded hover:bg-foreground/[0.06] text-lg transition-colors ${
                        value === entry.emoji ? "bg-foreground/[0.08]" : ""
                      }`}
                    >
                      {entry.emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
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
