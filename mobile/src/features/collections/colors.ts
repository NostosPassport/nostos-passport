import type { CollectionColorValue } from "@/api/collection-contracts";
import { palette } from "@/theme";

export const COLLECTION_COLORS: { id: CollectionColorValue; label: string; value: string }[] = [
  { id: "blue", label: "Blue", value: palette.passportBlue },
  { id: "navy", label: "Navy", value: palette.collectionNavy },
  { id: "green", label: "Green", value: palette.collectionGreen },
  { id: "burgundy", label: "Burgundy", value: palette.collectionBurgundy },
  { id: "sand", label: "Sand", value: palette.collectionSand },
  { id: "plum", label: "Plum", value: palette.collectionPlum },
];

export function collectionColorValue(color: CollectionColorValue): string {
  return COLLECTION_COLORS.find((option) => option.id === color)?.value ?? palette.passportBlue;
}
