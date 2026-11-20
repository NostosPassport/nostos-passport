import { useEffect, useState } from "react";
import { Keyboard } from "react-native";

/**
 * True while the software keyboard is up (or about to be).
 *
 * `holdMs` keeps it true for a moment after the keyboard has fully hidden. A sheet that disables its swipe-to-close
 * gesture while typing needs this: the same downward drag that closes the keyboard would otherwise carry straight
 * on into closing the sheet.
 */
export function useKeyboardVisible(holdMs = 0): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = Keyboard.addListener("keyboardWillShow", () => { clearTimeout(timer); setVisible(true); });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      clearTimeout(timer);
      if (holdMs > 0) timer = setTimeout(() => setVisible(false), holdMs);
      else setVisible(false);
    });
    return () => { clearTimeout(timer); show.remove(); hide.remove(); };
  }, [holdMs]);
  return visible;
}
