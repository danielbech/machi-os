"use client";

import { memo, useState, useEffect, type ComponentType } from "react";
import {
  Globe,
  Code,
  Palette,
  ShoppingBag,
  Building2,
  Camera,
  Music,
  BookOpen,
  Briefcase,
  Heart,
  Star,
  Zap,
  Coffee,
  Rocket,
  Target,
  Lightbulb,
  Megaphone,
  Film,
  Headphones,
  Gamepad2,
  Shirt,
  UtensilsCrossed,
  Plane,
  Gem,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

// Legacy icon map — keeps old icon names working
const LEGACY_ICONS: Record<string, LucideIcon> = {
  globe: Globe,
  code: Code,
  palette: Palette,
  shopping: ShoppingBag,
  building: Building2,
  camera: Camera,
  music: Music,
  book: BookOpen,
  briefcase: Briefcase,
  heart: Heart,
  star: Star,
  zap: Zap,
  coffee: Coffee,
  rocket: Rocket,
  target: Target,
  lightbulb: Lightbulb,
  megaphone: Megaphone,
  film: Film,
  headphones: Headphones,
  gamepad: Gamepad2,
  shirt: Shirt,
  food: UtensilsCrossed,
  travel: Plane,
  gem: Gem,
};

// Module-level cache for dynamically resolved icons
const resolvedIconCache = new Map<string, ComponentType<LucideProps> | null>();

function kebabToPascal(name: string): string {
  return name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

// Lazy-load a lucide icon by kebab-case name
function useDynamicIcon(name: string): ComponentType<LucideProps> | null {
  // Fast path: legacy icons (statically imported)
  if (LEGACY_ICONS[name]) return LEGACY_ICONS[name];

  // Fast path: already resolved
  if (resolvedIconCache.has(name)) return resolvedIconCache.get(name)!;

  const [Icon, setIcon] = useState<ComponentType<LucideProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("lucide-react").then((mod) => {
      if (cancelled) return;
      const pascalName = kebabToPascal(name);
      const icon = (mod as Record<string, unknown>)[pascalName] as ComponentType<LucideProps> | undefined;
      const resolved = icon || null;
      resolvedIconCache.set(name, resolved);
      setIcon(() => resolved);
    });
    return () => { cancelled = true; };
  }, [name]);

  return Icon;
}

export const ClientIcon = memo(function ClientIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = useDynamicIcon(icon);
  if (!Icon) return null;
  return <Icon className={className} />;
});

// Re-export for backward compat
export const PROJECT_ICONS = LEGACY_ICONS;
export const PROJECT_ICON_NAMES = Object.keys(LEGACY_ICONS);
