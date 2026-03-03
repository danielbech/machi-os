// ─── Central color palette ──────────────────────────────────────────────────
// All color names used across the app. Add new colors here and they
// propagate everywhere (board cards, statuses, timeline, color pickers, etc.)

// Dot / swatch colors for color pickers
export const CLIENT_DOT_COLORS: Record<string, string> = {
  white: "bg-white",
  blue: "bg-blue-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  cyan: "bg-cyan-500",
  amber: "bg-amber-500",
  gray: "bg-foreground/30",
};

// Text-only colors (client labels on cards, etc.)
export const CLIENT_TEXT_COLORS: Record<string, string> = {
  white: "text-white",
  blue: "text-blue-400",
  green: "text-green-400",
  purple: "text-purple-400",
  orange: "text-orange-400",
  pink: "text-pink-400",
  red: "text-red-400",
  yellow: "text-yellow-400",
  cyan: "text-cyan-400",
  amber: "text-amber-400",
  gray: "text-foreground/30",
};

// Raw RGB values for dynamic CSS (glow effects, etc.)
export const CLIENT_RGB_COLORS: Record<string, string> = {
  white: "255, 255, 255",
  blue: "96, 165, 250",
  green: "74, 222, 128",
  purple: "192, 132, 252",
  orange: "251, 146, 60",
  pink: "244, 114, 182",
  red: "248, 113, 113",
  yellow: "250, 204, 21",
  cyan: "34, 211, 238",
  amber: "245, 158, 11",
  gray: "255, 255, 255",
};

// Hex values (timeline bars, gantt chart, presence cursors)
export const CLIENT_HEX_COLORS: Record<string, string> = {
  white: "#ffffff",
  blue: "#3b82f6",
  green: "#22c55e",
  purple: "#a855f7",
  orange: "#f97316",
  pink: "#ec4899",
  red: "#ef4444",
  yellow: "#eab308",
  cyan: "#06b6d4",
  amber: "#f59e0b",
  gray: "#6b7280",
};

// Badge styles (status badges, etc.) — bg + text + border
export const BADGE_COLOR_STYLES: Record<string, string> = {
  white: "bg-foreground/10 text-white border-foreground/20",
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  green: "bg-green-500/10 text-green-400 border-green-500/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  pink: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  red: "bg-red-500/10 text-red-400 border-red-500/20",
  yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  cyan: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  gray: "bg-foreground/5 text-foreground/30 border-foreground/10",
};

// All color names (derived from the palette)
export const COLOR_NAMES = Object.keys(CLIENT_DOT_COLORS);

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getClientTextClassName(color: string): string {
  return CLIENT_TEXT_COLORS[color] || CLIENT_TEXT_COLORS.blue;
}

export function getBadgeColorStyle(color: string): string {
  return BADGE_COLOR_STYLES[color] || BADGE_COLOR_STYLES.gray;
}

// Convert Tailwind bg class (e.g. "bg-blue-500") to hex — used for presence cursors
// Builds lookup from CLIENT_DOT_COLORS → CLIENT_HEX_COLORS so it stays in sync
const TW_TO_HEX: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [name, twClass] of Object.entries(CLIENT_DOT_COLORS)) {
    if (CLIENT_HEX_COLORS[name]) {
      map[twClass] = CLIENT_HEX_COLORS[name];
    }
  }
  return map;
})();

export function getHexFromTailwind(tw: string): string {
  return TW_TO_HEX[tw] || "#3b82f6";
}

// ─── Workspace colors (hex, for workspace/member profile swatches) ──────────
export const WORKSPACE_COLORS = [
  "#FF3700", "#3b82f6", "#22c55e", "#a855f7", "#ec4899",
  "#ef4444", "#eab308", "#06b6d4", "#6366f1", "#14b8a6",
];
