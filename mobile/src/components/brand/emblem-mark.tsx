import Svg, { Path } from "react-native-svg";

import { emblem } from "@/features/book/emblem";
import { bookStyle, colors, type ColorToken } from "@/theme";

/** The Nostos emblem (two rings, ticks, a compass star and a doorway) as a small flat mark, for headers and quiet screens. */
export function EmblemMark({ size, color = "brass" }: { size: number; color?: ColorToken }) {
  const e = emblem();
  const ink = colors[color];
  return (
    <Svg width={size} height={size} viewBox="-1.05 -1.05 2.1 2.1" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {e.rings.map((d, i) => (
        <Path key={i} d={d} fill="none" stroke={ink} strokeWidth={i === 0 ? bookStyle.emblemRing * 2 : bookStyle.emblemInner * 2} />
      ))}
      <Path d={e.ticks} stroke={ink} strokeWidth={bookStyle.emblemTick * 2} />
      <Path d={e.star} fill={ink} />
      <Path d={e.door} fill={colors.black} />
    </Svg>
  );
}
