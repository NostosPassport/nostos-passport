import Svg, { Circle } from "react-native-svg";

import { colors } from "@/theme";
import { ringGeometry } from "./index-data";

/** A ring that fills with brass as you visit a neighborhood's places. Complete: solid, with a glow ring. */
export function ProgressRing({ visited, total, size, stroke, complete }: { visited: number; total: number; size: number; stroke: number; complete?: boolean }) {
  const r = (size - stroke) / 2;
  const g = ringGeometry(visited, total, r);
  const c = size / 2;
  return (
    <Svg width={size} height={size} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={c} cy={c} r={r} fill="none" stroke={colors.hairline} strokeWidth={stroke} />
      <Circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={complete ? colors.brass : colors.dimBrass}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={[g.filled, g.circumference]}
        transform={`rotate(-90 ${c} ${c})`}
      />
    </Svg>
  );
}
