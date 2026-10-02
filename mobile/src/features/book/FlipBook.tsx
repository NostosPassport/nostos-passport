/* eslint-disable react-hooks/immutability -- Reanimated shared values are written through .value by design */
import type { ReactNode } from "react";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { haptics } from "@/lib/haptics";
import { bookMotion, colors } from "@/theme";
import { DRAG_ZONE, FLICK, TAP_ZONE, castShade, dragPos, flipAngle, flipShade, settleTarget, showsBack, stepTarget, turnProgress, zoneAt } from "./flip-math";
import { PERSPECTIVE } from "./open-math";
import { type PageFace, spreadAt } from "./spreads";
import { Spread } from "./Spread";

type Props = {
  pageWidth: number;
  pageHeight: number;
  /** How many spreads the book has. */
  total: number;
  /** The spread showing, 0-based. The book follows this when it changes (a jump from the index, say). */
  spread: number;
  onSpreadChange: (index: number) => void;
  /** Turning back from the first spread closes the book. */
  onCloseBook?: () => void;
  renderFace: (face: PageFace, side: "left" | "right") => ReactNode;
};

const faceOf = (spread: number, total: number, side: "left" | "right"): PageFace | null =>
  spread < 0 || spread >= total ? null : spreadAt(spread)[side];

/**
 * The open book. It keeps one number, the position between spreads (see flip-math.ts), and draws every page from it:
 * two turning pages (one lying on the left, one on the right, each ready to turn) over the pages they reveal. A finger on
 * an outer edge drags the page, a tap on the edge turns it, and a release springs to the nearest spread. With Reduce
 * Motion on, pages crossfade instead of turning.
 */
export function FlipBook({ pageWidth: pw, pageHeight: ph, total, spread, onSpreadChange, onCloseBook, renderFace }: Props) {
  const reduced = useReducedMotion();
  const pos = useSharedValue(spread);
  const from = useSharedValue(spread);
  const startPos = useSharedValue(spread);
  const startX = useSharedValue(0);
  const zone = useSharedValue(0); // 1 = forward edge, -1 = back edge, 0 = not from an edge

  const commit = (target: number, previous: number) => {
    if (target === previous) return;
    haptics.select();
    onSpreadChange(target);
  };
  const closeBook = () => onCloseBook?.();

  // A change from outside (a jump) moves the book there.
  useEffect(() => {
    if (Math.abs(pos.value - spread) < 0.001) return;
    pos.value = reduced ? withTiming(spread, { duration: bookMotion.durations.crossfade }) : withSpring(spread, bookMotion.pageFlip);
  }, [spread, reduced, pos]);

  const settle = (target: number, origin: number, velocity: number) => {
    "worklet";
    const done = (finished?: boolean) => {
      "worklet";
      if (finished) scheduleOnRN(commit, target, origin);
    };
    pos.value = reduced ? withTiming(target, { duration: bookMotion.durations.crossfade }, done) : withSpring(target, { ...bookMotion.pageFlip, velocity: -velocity / (pw * 1.7) }, done);
  };

  const pan = Gesture.Pan()
    .withTestId("flip-pan")
    .activeOffsetX([-8, 8])
    .onBegin((e) => {
      const z = zoneAt(e.x, pw, DRAG_ZONE);
      zone.value = z === "next" ? 1 : z === "prev" ? -1 : 0;
      startX.value = e.x;
      from.value = Math.round(pos.value);
      startPos.value = pos.value;
    })
    .onUpdate((e) => {
      if (zone.value === 0) return;
      if (zone.value === -1 && from.value === 0) return; // the cover is closed by letting go, not by dragging it
      pos.value = dragPos(startPos.value, startX.value, e.x, pw, zone.value === 1 ? "next" : "prev", total);
    })
    .onEnd((e) => {
      if (zone.value === 0) return;
      if (zone.value === -1 && from.value === 0) {
        if (e.translationX > pw * 0.3 || e.velocityX > FLICK) scheduleOnRN(closeBook);
        return;
      }
      settle(settleTarget(pos.value, from.value, e.velocityX, pw, total), from.value, e.velocityX);
    });

  const tap = Gesture.Tap().withTestId("flip-tap").onEnd((e, ok) => {
    if (!ok) return;
    const z = zoneAt(e.x, pw, TAP_ZONE);
    if (z === null) return;
    const origin = Math.round(pos.value);
    if (z === "prev" && origin === 0) {
      scheduleOnRN(closeBook);
      return;
    }
    const target = stepTarget(origin, z === "next" ? 1 : -1, total);
    if (target !== origin) settle(target, origin, 0);
  });

  const s = Math.round(spread);
  const under = (index: number, side: "left" | "right") => {
    const face = faceOf(index, total, side);
    return face ? renderFace(face, side) : null;
  };
  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View collapsable={false}>
        <Spread pageWidth={pw} pageHeight={ph} spreadIndex={s} spreadTotal={total}>
          {/* The pages that lie underneath, revealed as the turning pages go over. */}
          <View style={[styles.half, { width: pw, height: ph }]}>{under(s - 1, "left")}</View>
          <View style={[styles.half, { left: pw, width: pw, height: ph }]}>{under(s + 1, "right")}</View>
          {/* Turn s-1 (lying on the left) then turn s (lying on the right): the later one is on top. */}
          {[s - 1, s].map((k) => (k >= 0 && k < total - 1 ? <TurningPage key={k} k={k} pos={pos} pw={pw} ph={ph} reduced={reduced} front={renderFace(spreadAt(k).right, "right")} back={renderFace(spreadAt(k + 1).left, "left")} /> : null))}
        </Spread>
      </View>
    </GestureDetector>
  );
}

/** One page in flight between spread k and k+1: its front is the right page of k, its back the left page of k+1. */
function TurningPage({ k, pos, pw, ph, reduced, front, back }: { k: number; pos: SharedValue<number>; pw: number; ph: number; reduced: boolean; front: ReactNode; back: ReactNode }) {
  const frontStyle = useAnimatedStyle(() => {
    const p = turnProgress(pos.value, k);
    if (reduced) return { opacity: 1 - p, transform: [] };
    return { opacity: showsBack(p) ? 0 : 1, transform: [{ perspective: PERSPECTIVE }, { rotateY: `${flipAngle(p)}deg` }] };
  });
  const backStyle = useAnimatedStyle(() => {
    const p = turnProgress(pos.value, k);
    if (reduced) return { opacity: p, transform: [{ translateX: -pw }] };
    // Mirror the back inside its own box first, then turn it with the page: it ends flat on the left, reading the right way round.
    return { opacity: showsBack(p) ? 1 : 0, transform: [{ perspective: PERSPECTIVE }, { rotateY: `${flipAngle(p)}deg` }, { translateX: pw }, { scaleX: -1 }] };
  });
  const shade = useAnimatedStyle(() => ({ opacity: reduced ? 0 : flipShade(turnProgress(pos.value, k)) }));
  // The turning page shadows the page it lies over: the one on the right while it is lifting, the one on the left as it lands.
  const castRight = useAnimatedStyle(() => ({ opacity: reduced ? 0 : turnProgress(pos.value, k) < 0.5 ? castShade(turnProgress(pos.value, k)) : 0 }));
  const castLeft = useAnimatedStyle(() => ({ opacity: reduced ? 0 : turnProgress(pos.value, k) >= 0.5 ? castShade(turnProgress(pos.value, k)) : 0 }));
  const atRest = useAnimatedStyle(() => ({ zIndex: turnProgress(pos.value, k) > 0 && turnProgress(pos.value, k) < 1 ? 2 : 1 }));
  const box = { left: pw, width: pw, height: ph };
  return (
    <Animated.View pointerEvents="box-none" style={[styles.half, box, atRest]}>
      <Animated.View pointerEvents="none" style={[styles.cast, { width: pw, height: ph }, castRight]} />
      <Animated.View pointerEvents="none" style={[styles.cast, { left: -pw, width: pw, height: ph }, castLeft]} />
      <Animated.View style={[styles.half, { width: pw, height: ph, transformOrigin: "left center" }, frontStyle]}>
        {front}
        <Animated.View pointerEvents="none" style={[styles.cast, { width: pw, height: ph }, shade]} />
      </Animated.View>
      <Animated.View style={[styles.half, { width: pw, height: ph, transformOrigin: "left center" }, backStyle]}>
        {back}
        <Animated.View pointerEvents="none" style={[styles.cast, { width: pw, height: ph }, shade]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  half: { position: "absolute", top: 0, left: 0 },
  cast: { position: "absolute", top: 0, left: 0, backgroundColor: colors.black },
});
