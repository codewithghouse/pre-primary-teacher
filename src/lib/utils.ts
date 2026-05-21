import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Pre-primary class detection — used to gate access in AuthContext.
// Mirrors values that principal-dashboard sets when assigning teachers to
// Playgroup / Nursery / LKG / UKG sections.
const PRE_PRIMARY_TOKENS = ["playgroup", "nursery", "lkg", "ukg", "pre"];

export function isPrePrimaryClass(assignedClass?: string | null): boolean {
  if (!assignedClass) return false;
  const lower = assignedClass.toLowerCase();
  return PRE_PRIMARY_TOKENS.some((t) => lower.includes(t));
}

export function moodEmoji(mood?: string): string {
  switch (mood) {
    case "happy":
      return "😊";
    case "ok":
      return "😐";
    case "crying":
      return "😢";
    case "sleepy":
      return "😴";
    case "unwell":
      return "🤒";
    default:
      return "❔";
  }
}
