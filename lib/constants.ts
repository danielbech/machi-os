import type { Member } from "./types";

export const TEAM_MEMBERS: Member[] = [
  { id: "1", name: "Daniel", initials: "DB", color: "bg-blue-500", avatar: "/avatars/daniel.jpg" },
  { id: "2", name: "Casper", initials: "C", color: "bg-green-500", avatar: "/avatars/casper.png" },
  { id: "3", name: "Jens", initials: "J", color: "bg-purple-500" },
  { id: "4", name: "Emil", initials: "E", color: "bg-orange-500" },
];

export const COLUMN_TITLES: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

export const EMPTY_COLUMNS: Record<string, []> = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
};
