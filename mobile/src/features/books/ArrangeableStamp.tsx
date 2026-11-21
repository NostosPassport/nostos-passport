/**
 * A stamp the owner can arrange on its page: hold to pick it up and drag it anywhere (stamps may overlap), pinch to
 * resize, twist to tilt, and drop it on the trash to take it out of this book. A tap still opens the stamp.
 */
import { createContext, type ReactNode, useContext } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { type SharedValue, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import type { Placement } from "@/features/book/slots";
import { haptics } from "@/lib/haptics";
import { bookMotion } from "@/theme";
import { MAX_SCALE, MIN_SCALE, normRotation, type StampLayout, toLayout } from "./arrange";

/** Shared between every stamp in the reader and the trash it shows while one is dragged. */
export type DragState = { active: SharedValue<number>; overTrash: SharedValue<number>; trashTop: SharedValue<number> };
export const DragContext = createContext<DragState | null>(null);

type Props = {
  /** The stamp's automatic placement, the size its scale is measured against. */
  auto: Placement;
  /** Where it sits now, hand placement applied. */
  placed: Placement;
  pageWidth: number;
  pageHeight: number;
  label: string;
  onPress?: () => void;
  onPlace: (layout: StampLayout) => void;
  onTakeOut: () => void;
  children: ReactNode;
};

const LIFT = 0.06;

export function ArrangeableStamp({ auto, placed, pageWidth, pageHeight, label, onPress, onPlace, onTakeOut, children }: Props) {
  const drag = useContext(DragContext);
  const reduced = useReducedMotion();
  const h = placed.height ?? placed.size;
  const cx = useSharedValue(placed.cx);
  const cy = useSharedValue(placed.cy);
  const size = useSharedValue(placed.size);
  const rot = useSharedValue(placed.rotation);
  const start = useSharedValue({ cx: 0, cy: 0, size: 0, rot: 0 });
  const touching = useSharedValue(0);
  const dragging = useSharedValue(0);
  const lifted = useSharedValue(0);
  const fallbackOver = useSharedValue(0);
  const fallbackTop = useSharedValue(Number.POSITIVE_INFINITY);
  const overTrash = drag?.overTrash ?? fallbackOver;
  const trashTop = drag?.trashTop ?? fallbackTop;

  const minSize = auto.size * MIN_SCALE;
  const maxSize = auto.size * MAX_SCALE;

  const commit = (x: number, y: number, s: number, r: number) => onPlace(toLayout({ cx: x, cy: y, size: s, rotation: r }, auto.size, pageWidth, pageHeight));

  const begin = () => {
    "worklet";
    if (touching.get() === 0) {
      start.set({ cx: cx.get(), cy: cy.get(), size: size.get(), rot: rot.get() });
      lifted.set(reduced ? 1 : withSpring(1, bookMotion.snap));
      scheduleOnRN(haptics.select);
    }
    touching.set(touching.get() + 1);
  };
  const end = () => {
    "worklet";
    touching.set(Math.max(0, touching.get() - 1));
    if (touching.get() > 0) return;
    lifted.set(reduced ? 0 : withSpring(0, bookMotion.snap));
    const dropped = overTrash.get() === 1;
    if (drag) { drag.active.set(0); drag.overTrash.set(0); }
    if (dropped) { scheduleOnRN(onTakeOut); return; }
    const s0 = start.get();
    if (s0.cx === cx.get() && s0.cy === cy.get() && s0.size === size.get() && s0.rot === rot.get()) return;
    scheduleOnRN(commit, cx.get(), cy.get(), size.get(), rot.get());
  };

  const pan = Gesture.Pan()
    .withTestId("stamp-arrange-pan")
    .activateAfterLongPress(300)
    .onStart(() => {
      begin();
      dragging.set(1);
      if (drag) drag.active.set(1);
    })
    .onUpdate((e) => {
      cx.set(Math.min(pageWidth, Math.max(0, start.get().cx + e.translationX)));
      cy.set(Math.min(pageHeight, Math.max(0, start.get().cy + e.translationY)));
      const over = e.absoluteY >= trashTop.get() ? 1 : 0;
      if (over !== overTrash.get()) { overTrash.set(over); if (over) scheduleOnRN(haptics.select); }
    })
    .onFinalize(() => {
      if (dragging.get() === 1) { dragging.set(0); end(); }
    });
  const pinchStarted = useSharedValue(0);
  const pinch = Gesture.Pinch()
    .withTestId("stamp-arrange-pinch")
    .onStart(() => { pinchStarted.set(1); begin(); })
    .onUpdate((e) => { size.set(Math.min(maxSize, Math.max(minSize, start.get().size * e.scale))); })
    .onFinalize(() => { if (pinchStarted.get() === 1) { pinchStarted.set(0); end(); } });
  const twistStarted = useSharedValue(0);
  const twist = Gesture.Rotation()
    .withTestId("stamp-arrange-rotate")
    .onStart(() => { twistStarted.set(1); begin(); })
    .onUpdate((e) => { rot.set(normRotation(start.get().rot + (e.rotation * 180) / Math.PI)); })
    .onFinalize(() => { if (twistStarted.get() === 1) { twistStarted.set(0); end(); } });

  const motion = useAnimatedStyle(() => {
    const over = dragging.get() === 1 ? overTrash.get() : 0;
    return {
      left: cx.get() - placed.size / 2,
      top: cy.get() - h / 2,
      zIndex: lifted.get() > 0 ? 10 : 0,
      opacity: reduced ? 1 - over * 0.4 : withTiming(1 - over * 0.4, { duration: 120 }),
      transform: [{ rotate: `${rot.get()}deg` }, { scale: (size.get() / placed.size) * (1 + lifted.get() * LIFT) * (1 - over * 0.35) }],
    };
  });

  return (
    <GestureDetector gesture={Gesture.Simultaneous(pan, pinch, twist)}>
      <Animated.View style={[styles.stamp, { width: placed.size, height: h }, motion]}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Hold and drag to move it. Pinch to resize."
          accessibilityActions={[{ name: "activate" }, { name: "takeOut", label: "Take out of this book" }]}
          onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === "takeOut") onTakeOut(); else onPress?.(); }}
          style={StyleSheet.absoluteFill}
        >
          {children}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ stamp: { position: "absolute" } });
