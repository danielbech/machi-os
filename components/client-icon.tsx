"use client";

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

export const PROJECT_ICONS: Record<string, LucideIcon> = {
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

export const PROJECT_ICON_NAMES = Object.keys(PROJECT_ICONS);

export function ClientIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = PROJECT_ICONS[icon];
  if (!Icon) return null;
  return <Icon className={className} />;
}
