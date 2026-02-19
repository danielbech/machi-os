// Map color names to Tailwind badge classes (light bg + dark text / dark bg + light text)
export const CLIENT_COLORS: Record<string, string> = {
  white: "bg-white/10 text-white dark:bg-white/10 dark:text-white",
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  green: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  purple: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  pink: "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  yellow: "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  cyan: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
};

// Dot colors for color picker swatches
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
};

// Text-only colors (no background)
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
};

export const COLOR_NAMES = Object.keys(CLIENT_COLORS);

export function getClientClassName(color: string): string {
  return CLIENT_COLORS[color] || CLIENT_COLORS.blue;
}

export function getClientTextClassName(color: string): string {
  return CLIENT_TEXT_COLORS[color] || CLIENT_TEXT_COLORS.blue;
}
