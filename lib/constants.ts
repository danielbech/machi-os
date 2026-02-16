import type { Member, Client } from "./types";

export const TEAM_MEMBERS: Member[] = [
  { id: "1", name: "Daniel", initials: "DB", color: "bg-blue-500", avatar: "/avatars/daniel.jpg" },
  { id: "2", name: "Casper", initials: "C", color: "bg-green-500", avatar: "/avatars/casper.png" },
  { id: "3", name: "Jens", initials: "J", color: "bg-purple-500" },
  { id: "4", name: "Emil", initials: "E", color: "bg-orange-500" },
];

export const CLIENTS: Client[] = [
  { id: "bookspot", name: "BookSpot", key: "b", className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  { id: "evooq", name: "Evooq", key: "e", className: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" },
  { id: "tandem", name: "Tandem", key: "t", className: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
  { id: "anthill", name: "Anthill", key: "a", className: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  { id: "mazed", name: "Mazed", key: "m", className: "bg-pink-50 text-pink-700 dark:bg-pink-950 dark:text-pink-300" },
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
