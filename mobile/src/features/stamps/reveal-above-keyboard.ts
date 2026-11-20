import { useCallback, useEffect, useRef } from "react";
import { Keyboard, type ScrollViewInstance } from "react-native";

import { space } from "@/theme";

/** How long to wait for the keyboard before giving up on the scroll. */
const KEYBOARD_WAIT_MS = 1000;

/**
 * Scrolls a form so a focused section sits near the top of the screen once the keyboard is up. iOS only scrolls
 * a focused field just above the keyboard, so a place list or a growing caption ends up behind the keyboard and
 * its suggestion bar (P-079, P-080, P-119). `y` is the section's offset in the scroll content (from onLayout).
 */
export function useRevealAboveKeyboard(scroller: React.RefObject<ScrollViewInstance | null>) {
  const pending = useRef<{ remove: () => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancel = useCallback(() => {
    pending.current?.remove();
    pending.current = null;
    clearTimeout(timer.current);
  }, []);
  useEffect(() => cancel, [cancel]);

  return useCallback((y: number) => {
    cancel();
    const go = () => scroller.current?.scrollTo({ y: Math.max(0, y - space.sm), animated: true });
    if (Keyboard.isVisible()) { go(); return; }
    pending.current = Keyboard.addListener("keyboardDidShow", () => { cancel(); go(); });
    timer.current = setTimeout(cancel, KEYBOARD_WAIT_MS);
  }, [cancel, scroller]);
}
