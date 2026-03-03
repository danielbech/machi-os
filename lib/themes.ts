export interface Theme {
  id: string;
  name: string;
  /** CSS variables to override (applied on .dark) */
  variables: Record<string, string>;
  /** Preview colors for the theme card [bg, accent, fg] */
  preview: [string, string, string];
}

export const THEMES: Theme[] = [
  {
    id: "default",
    name: "Default",
    variables: {
      "--background": "hsl(0 0% 3.9%)",
      "--foreground": "hsl(0 0% 98%)",
      "--card": "hsl(0 0% 3.9%)",
      "--card-foreground": "hsl(0 0% 98%)",
      "--popover": "hsl(0 0% 3.9%)",
      "--popover-foreground": "hsl(0 0% 98%)",
      "--primary": "hsl(0 0% 98%)",
      "--primary-foreground": "hsl(0 0% 9%)",
      "--secondary": "hsl(0 0% 14.9%)",
      "--secondary-foreground": "hsl(0 0% 98%)",
      "--muted": "hsl(0 0% 14.9%)",
      "--muted-foreground": "hsl(0 0% 63.9%)",
      "--accent": "hsl(0 0% 14.9%)",
      "--accent-foreground": "hsl(0 0% 98%)",
      "--destructive": "hsl(0 62.8% 30.6%)",
      "--destructive-foreground": "hsl(0 0% 98%)",
      "--border": "hsl(0 0% 14.9%)",
      "--input": "hsl(0 0% 14.9%)",
      "--ring": "hsl(0 0% 83.1%)",
      "--sidebar": "hsl(0 0% 2%)",
      "--sidebar-foreground": "hsl(0 0% 90%)",
      "--sidebar-primary": "hsl(0 0% 98%)",
      "--sidebar-primary-foreground": "hsl(0 0% 9%)",
      "--sidebar-accent": "hsl(0 0% 12%)",
      "--sidebar-accent-foreground": "hsl(0 0% 90%)",
      "--sidebar-border": "hsl(0 0% 12%)",
      "--sidebar-ring": "hsl(0 0% 30%)",
    },
    preview: ["#0a0a0a", "#262626", "#fafafa"],
  },
];

export function getThemeById(id: string): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}
