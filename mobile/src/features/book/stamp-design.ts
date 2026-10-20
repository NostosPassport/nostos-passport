export const SHAPES = ["circle", "oval", "rounded", "octagon", "hexagon"] as const;
export const MOTIFS = ["star", "diamond", "crescent", "door", "compass", "sun"] as const;
export const BORDERS = ["plain", "double", "dotted", "ticks", "dashed", "heavy"] as const;

export {
  STAMP_BOX,
  borderFor,
  completionDesign,
  fitName,
  motifPath,
  rayPath,
  ringsFor,
  shapePath,
  stampDesign,
} from "../../../../shared/passport-artwork";

export type {
  Border,
  CompletionDesign,
  Motif,
  Shape,
  Speckle,
  StampDesign,
  StampInput,
} from "../../../../shared/passport-artwork";
