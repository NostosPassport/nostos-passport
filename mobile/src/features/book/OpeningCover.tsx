import { type ReactNode, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { bookMotion, colors, shadows } from "@/theme";
import { coverAngle, pageShadow, PERSPECTIVE, showsInside, swingShade } from "./open-math";

type Props = {
  width: number;
  height: number;
  open: boolean;
  /** The cover, seen from outside. */
  outside: ReactNode;
  /** The first page, lying under the cover. */
  page: ReactNode;
  /** Start already open (to close a book that is open). Only read when the component mounts. */
  initialOpen?: boolean;
  /** Called when a swing has finished. */
  onSettled?: () => void;
};

/** Swings a cover open on its left edge. With reduced motion it crossfades instead. */
export function OpeningCover({ width, height, open, outside, page, initialOpen, onSettled }: Props) {
  const reduced = useReducedMotion();
  const progress = useSharedValue((initialOpen ?? open) ? 1 : 0);

  useEffect(() => {
    const done = (finished?: boolean) => {
      "worklet";
      if (finished && onSettled) scheduleOnRN(onSettled);
    };
    const target = open ? 1 : 0;
    progress.value = reduced ? withTiming(target, { duration: bookMotion.durations.crossfade }, done) : withSpring(target, bookMotion.coverOpen, done);
    // The callback is read once per swing; a new one is not a reason to start another.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reduced, progress]);

  const swing = useAnimatedStyle(() => ({
    opacity: reduced ? 1 - progress.value : showsInside(progress.value) ? 0 : 1,
    transform: reduced ? [] : [{ perspective: PERSPECTIVE }, { rotateY: `${coverAngle(progress.value)}deg` }],
  }));
  const inside = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : showsInside(progress.value) ? 1 : 0,
    transform: [{ perspective: PERSPECTIVE }, { rotateY: `${coverAngle(progress.value) + 180}deg` }, { scaleX: -1 }],
  }));
  const shade = useAnimatedStyle(() => ({ opacity: swingShade(progress.value) }));
  const cast = useAnimatedStyle(() => ({ opacity: pageShadow(progress.value) }));

  return (
    <View style={{ width, height }} pointerEvents={open ? "none" : "auto"}>
      <View style={[StyleSheet.absoluteFill, shadows.book]}>{page}</View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cast, cast]} />
      <Animated.View style={[StyleSheet.absoluteFill, styles.face, { transformOrigin: "left center" }, swing]}>
        {outside}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shade, shade]} />
        <View pointerEvents="none" style={styles.hingeShade} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.inside, { transformOrigin: "left center" }, inside]} />
    </View>
  );
}

const styles = StyleSheet.create({
  face: { backfaceVisibility: "hidden" },
  shade: { backgroundColor: colors.black },
  hingeShade: { position: "absolute", left: 0, top: 0, bottom: 0, width: "6%", backgroundColor: colors.shadow },
  cast: { backgroundColor: colors.black },
  inside: { backgroundColor: colors.leather, backfaceVisibility: "hidden" },
});
