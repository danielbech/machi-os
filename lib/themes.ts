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
  {
    id: "ember",
    name: "Ember",
    variables: {
      "--background": "hsl(0 0% 3.9216%)",
      "--foreground": "hsl(0 0% 94.1176%)",
      "--card": "hsl(0 0% 7.0588%)",
      "--card-foreground": "hsl(0 0% 94.1176%)",
      "--popover": "hsl(240 1.9608% 10%)",
      "--popover-foreground": "hsl(0 0% 94.1176%)",
      "--primary": "hsl(15.3913 90.5512% 49.8039%)",
      "--primary-foreground": "hsl(0 0% 100%)",
      "--secondary": "hsl(14.7692 90.6977% 42.1569%)",
      "--secondary-foreground": "hsl(0 0% 94.1176%)",
      "--muted": "hsl(240 2.7778% 14.1176%)",
      "--muted-foreground": "hsl(0 0% 58.8235%)",
      "--accent": "hsl(14.7368 96.6102% 23.1373%)",
      "--accent-foreground": "hsl(0 0% 99.6078%)",
      "--destructive": "hsl(0 94.7712% 70%)",
      "--destructive-foreground": "hsl(0 0% 100%)",
      "--border": "hsl(0 0% 12.1569%)",
      "--input": "hsl(0 0% 23.1373%)",
      "--ring": "hsl(15.3913 90.5512% 49.8039%)",
      "--sidebar": "hsl(0 0% 7.0588%)",
      "--sidebar-foreground": "hsl(0 0% 94.1176%)",
      "--sidebar-primary": "hsl(15.3913 90.5512% 49.8039%)",
      "--sidebar-primary-foreground": "hsl(0 0% 100%)",
      "--sidebar-accent": "hsl(15.4839 93.9394% 12.9412%)",
      "--sidebar-accent-foreground": "hsl(14.9296 94.6667% 44.1176%)",
      "--sidebar-border": "hsl(222.8571 6.4220% 21.3725%)",
      "--sidebar-ring": "hsl(15.3913 90.5512% 49.8039%)",
    },
    preview: ["#0a0a0a", "#f06820", "#f0f0f0"],
  },
];

export function getThemeById(id: string): Theme | undefined {
  return THEMES.find((t) => t.id === id);
}
