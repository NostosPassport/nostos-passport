import type { ReactNode } from "react";
import { useEffect } from "react";
/* eslint-disable react-hooks/immutability -- Reanimated shared values are written through .value by design */
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { type SharedValue, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { haptics } from "@/lib/haptics";
import { bookMotion, colors, hairlineWidth, shadows } from "@/theme";
import { DRAG_ZONE, FLICK, TAP_ZONE, castShade, dragPos, flipShade, settleTarget, stepTarget, turnProgress } from "./flip-math";
import { type HitRect, singlePageTapTarget } from "./focus-interaction";

type Props = {
  pageTaps?: boolean;
  stampTargets?: readonly HitRect[];
  pageWidth: number;
  pageHeight: number;
  total: number;
  page: number;
  onPageChange: (index: number) => void;
  onCloseBook?: () => void;
  renderPage: (index: number) => ReactNode;
};

type Zone = "next" | "prev" | null;
type TurnDirection = "next" | "prev";

function zoneAt(x: number, width: number, share: number): Zone {
  "worklet";
  if (x >= width - width * share && x <= width) return "next";
  if (x >= 0 && x <= width * share) return "prev";
  return null;
}

function currentTurnProgress(position: number, current: number, direction: TurnDirection) {
  "worklet";
  return direction === "next" ? turnProgress(position, current) : 1 - turnProgress(position, current - 1);
}

export function SinglePageFlipBook({ pageWidth: pw, pageHeight: ph, total, page, onPageChange, onCloseBook, renderPage, pageTaps = false, stampTargets = [] }: Props) {
  const reduced = useReducedMotion();
  const pos = useSharedValue(page);
  const from = useSharedValue(page);
  const startPos = useSharedValue(page);
  const startX = useSharedValue(0);
  const busy = useSharedValue(false);
  const zone = useSharedValue(0);

  const commit = (target: number, previous: number) => {
    if (target === previous) return;
    haptics.select();
    onPageChange(target);
  };
  const closeBook = () => onCloseBook?.();

  useEffect(() => () => cancelAnimation(pos), [pos]);
  useEffect(() => {
    if (Math.abs(pos.value - page) < 0.001) return;
    pos.value = reduced ? withTiming(page, { duration: bookMotion.durations.crossfade }) : withSpring(page, bookMotion.pageFlip);
  }, [page, reduced, pos]);

  const settle = (target: number, origin: number, velocity: number) => {
    "worklet";
    if (busy.value) return;
    busy.value = true;
    const done = (finished?: boolean) => {
      "worklet";
      busy.value = false;
      if (finished) scheduleOnRN(commit, target, origin);
    };
    pos.value = reduced ? withTiming(target, { duration: bookMotion.durations.crossfade }, done) : withSpring(target, { ...bookMotion.pageFlip, velocity: -velocity / (pw * 1.7) }, done);
  };

  const pan = Gesture.Pan()
    .withTestId("single-flip-pan")
    .activeOffsetX([-8, 8])
    .onBegin((e) => {
      if (busy.value) { zone.value = 0; return; }
      const z = zoneAt(e.x, pw, DRAG_ZONE);
      zone.value = z === "next" ? 1 : z === "prev" ? -1 : 0;
      startX.value = e.x;
      from.value = Math.round(pos.value);
      startPos.value = pos.value;
    })
    .onUpdate((e) => {
      if (zone.value === 0) return;
      if (zone.value === -1 && from.value === 0) return;
      pos.value = dragPos(startPos.value, startX.value, e.x, pw, zone.value === 1 ? "next" : "prev", total);
    })
    .onEnd((e) => {
      if (zone.value === 0) return;
      if (zone.value === -1 && from.value === 0) {
        if (pageTaps) return;
        if (e.translationX > pw * 0.3 || e.velocityX > FLICK) scheduleOnRN(closeBook);
        return;
      }
      settle(settleTarget(pos.value, from.value, e.velocityX, pw, total), from.value, e.velocityX);
    });

  const tap = Gesture.Tap().maxDistance(8).cancelsTouchesInView(false).withTestId("single-flip-tap").onEnd((e, ok) => {
    if (!ok || busy.value) return;
    const origin = Math.round(pos.value);
    if (pageTaps) {
      const target = singlePageTapTarget(e.x, e.y, pw, ph, origin, total, busy.value, stampTargets);
      if (target !== origin) settle(target, origin, 0);
      return;
    }
    const z = zoneAt(e.x, pw, TAP_ZONE);
    if (z === null) return;
    if (z === "prev" && origin === 0) {
      scheduleOnRN(closeBook);
      return;
    }
    const target = stepTarget(origin, z === "next" ? 1 : -1, total);
    if (target !== origin) settle(target, origin, 0);
  });

  const current = Math.round(page);
  const currentStyle = useAnimatedStyle(() => ({ opacity: Math.abs(pos.value - current) < 0.001 ? 1 : 0 }));
  const previousStyle = useAnimatedStyle(() => ({ opacity: pos.value < current ? 1 : 0 }));
  const nextStyle = useAnimatedStyle(() => ({ opacity: pos.value > current ? 1 : 0 }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View collapsable={false} style={[styles.book, { width: pw, height: ph }]}>
        {pageTaps ? <View pointerEvents="none" accessible accessibilityRole="adjustable" accessibilityLabel="Passport pages" accessibilityValue={{ min: 1, max: total, now: page + 1 }} accessibilityActions={[{ name: "increment", label: "Next page" }, { name: "decrement", label: "Previous page" }]} onAccessibilityAction={(e) => { const target = stepTarget(page, e.nativeEvent.actionName === "increment" ? 1 : -1, total); if (target !== page && !busy.value) settle(target, page, 0); }} style={styles.a11y} /> : null}
        {current > 0 ? <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.page, { width: pw, height: ph }, previousStyle]}>{renderPage(current - 1)}</Animated.View> : null}
        {current < total - 1 ? <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.page, { width: pw, height: ph }, nextStyle]}>{renderPage(current + 1)}</Animated.View> : null}
        <Animated.View style={[styles.page, { width: pw, height: ph }, currentStyle]}>{renderPage(current)}</Animated.View>
        {current > 0 ? <TurningCurrentPage direction="prev" current={current} pos={pos} pw={pw} ph={ph} reduced={reduced}>{renderPage(current)}</TurningCurrentPage> : null}
        {current < total - 1 ? <TurningCurrentPage direction="next" current={current} pos={pos} pw={pw} ph={ph} reduced={reduced}>{renderPage(current)}</TurningCurrentPage> : null}
      </View>
    </GestureDetector>
  );
}

function TurningCurrentPage({ direction, current, pos, pw, ph, reduced, children }: { direction: TurnDirection; current: number; pos: SharedValue<number>; pw: number; ph: number; reduced: boolean; children: ReactNode }) {
  const activeStyle = useAnimatedStyle(() => {
    const p = currentTurnProgress(pos.value, current, direction);
    const active = p > 0.001 && p < 0.999;
    return { opacity: active ? 1 : 0, zIndex: active ? 2 : 0 };
  });
  const pageStyle = useAnimatedStyle(() => {
    const p = currentTurnProgress(pos.value, current, direction);
    if (reduced) return { opacity: 1 - p, transform: [] };
    return { opacity: p < 0.999 ? 1 : 0, transform: [{ scaleX: Math.max(0.001, 1 - p) }] };
  });
  const shade = useAnimatedStyle(() => ({ opacity: reduced ? 0 : flipShade(currentTurnProgress(pos.value, current, direction)) }));
  const cast = useAnimatedStyle(() => ({ opacity: reduced ? 0 : castShade(currentTurnProgress(pos.value, current, direction)) }));

  return (
    <Animated.View testID={`single-turn-current-${direction}`} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.page, { width: pw, height: ph }, activeStyle]}>
      <Animated.View style={[styles.cast, { width: pw, height: ph }, cast]} />
      <Animated.View style={[styles.page, { width: pw, height: ph, transformOrigin: direction === "next" ? "left center" : "right center" }, pageStyle]}>
        {children}
        <Animated.View pointerEvents="none" style={[styles.cast, { width: pw, height: ph }, shade]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  book: { ...shadows.page },
  page: { position: "absolute", top: 0, left: 0 },
  cast: { position: "absolute", top: 0, left: 0, backgroundColor: colors.black },
  a11y: { position: "absolute", width: hairlineWidth, height: hairlineWidth },
});
