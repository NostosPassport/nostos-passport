/* eslint-disable react-hooks/immutability -- Reanimated shared values are written through .value by design */
import { DeviceMotion } from "expo-sensors";
import { useEffect } from "react";
import { Gesture } from "react-native-gesture-handler";
import { Easing, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";

import { bookMotion } from "@/theme";
import { SWEEP_REST, sweepFromDrag, sweepFromTilt } from "./foil";

/** The foil highlight position (a shared value) and the drag gesture that moves it. Idle shimmer and tilt are off with reduced motion. */
export function useFoilSweep(width: number) {
  const reduced = useReducedMotion();
  const sweep = useSharedValue(SWEEP_REST);
  const base = useSharedValue(SWEEP_REST);
  const dragging = useSharedValue(false);

  useEffect(() => {
    if (reduced) return;
    sweep.value = withRepeat(withTiming(SWEEP_REST + 0.9, { duration: 5200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduced, sweep]);

  useEffect(() => {
    if (reduced) return;
    let sub: { remove: () => void } | null = null;
    let alive = true;
    void DeviceMotion.isAvailableAsync().then((ok) => {
      if (!ok || !alive) return;
      DeviceMotion.setUpdateInterval(33);
      sub = DeviceMotion.addListener((m) => {
        if (!dragging.value && m.rotation) sweep.value = withSpring(sweepFromTilt(m.rotation.gamma), bookMotion.snap);
      });
    });
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [reduced, sweep, dragging]);

  const gesture = Gesture.Pan()
    .onBegin(() => {
      dragging.value = true;
      base.value = sweep.value;
    })
    .onUpdate((e) => {
      sweep.value = sweepFromDrag(base.value, e.translationX, width);
    })
    .onFinalize(() => {
      dragging.value = false;
      sweep.value = withSpring(SWEEP_REST, bookMotion.snap);
    });

  return { sweep, gesture };
}
