"use client";

import { memo } from "react";
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
} from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";

// Legacy icon map — keeps old short names working
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

export const ClientIcon = memo(function ClientIcon({ icon, className }: { icon: string; className?: string }) {
  // Fast path: legacy short names (statically imported)
  const Legacy = LEGACY_ICONS[icon];
  if (Legacy) return <Legacy className={className} />;

  // Dynamic path: load any lucide icon by kebab-case name
  return <DynamicIcon name={icon as IconName} className={className} />;
});

// Re-export for backward compat
export const PROJECT_ICONS = LEGACY_ICONS;
export const PROJECT_ICON_NAMES = Object.keys(LEGACY_ICONS);
