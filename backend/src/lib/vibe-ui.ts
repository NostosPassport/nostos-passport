import type { LineWait, Vibe } from "@prisma/client";

export const VIBE_META: Record<Vibe | "NO_DATA", { label: string; color: string; text: string; emoji: string }> = {
  PACKED: { label: "Packed", color: "#ff3d6e", text: "#ff6f93", emoji: "🔥" },
  BUSY: { label: "Busy", color: "#ff9f1c", text: "#ffb44f", emoji: "🎶" },
  CHILL: { label: "Chill", color: "#2ec4b6", text: "#5fd9cd", emoji: "🍸" },
  DEAD: { label: "Dead", color: "#5c6b8a", text: "#aab6d0", emoji: "💤" },
  NO_DATA: { label: "No data", color: "#cfcfe0", text: "#cfcfe0", emoji: "?" },
};

export const LINE_META: Record<LineWait, { label: string; short: string }> = {
  NONE: { label: "No line", short: "None" },
  UNDER_10: { label: "Under 10 min", short: "<10m" },
  TEN_TO_30: { label: "10 to 30 min", short: "10-30m" },
  OVER_30: { label: "30+ min", short: "30m+" },
};

export const VIBES: Vibe[] = ["PACKED", "BUSY", "CHILL", "DEAD"];
export const LINES: LineWait[] = ["NONE", "UNDER_10", "TEN_TO_30", "OVER_30"];
