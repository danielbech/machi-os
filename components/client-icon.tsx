"use client";

import dynamic from "next/dynamic";
import { type ComponentType, memo } from "react";
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

// Cache for dynamically loaded icons
const dynamicIconCache = new Map<string, ComponentType<LucideProps>>();

function getDynamicIcon(name: string): ComponentType<LucideProps> | null {
  // Check legacy map first
  if (LEGACY_ICONS[name]) return LEGACY_ICONS[name];

  // Check cache
  if (dynamicIconCache.has(name)) return dynamicIconCache.get(name)!;

  // Dynamically import from lucide-react
  const DynIcon = dynamic(
    () => import("lucide-react").then((mod) => {
      // Convert kebab-case to PascalCase: "arrow-right" -> "ArrowRight"
      const pascalName = name
        .split("-")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join("");
      const icon = (mod as Record<string, unknown>)[pascalName];
      if (icon) return { default: icon as ComponentType<LucideProps> };
      // Fallback: try with "2" suffix variations
      return { default: (() => null) as unknown as ComponentType<LucideProps> };
    }),
    { ssr: false, loading: () => null }
  );

  dynamicIconCache.set(name, DynIcon);
  return DynIcon;
}

export const ClientIcon = memo(function ClientIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = getDynamicIcon(icon);
  if (!Icon) return null;
  return <Icon className={className} />;
});

// Re-export for backward compat
export const PROJECT_ICONS = LEGACY_ICONS;
export const PROJECT_ICON_NAMES = Object.keys(LEGACY_ICONS);
