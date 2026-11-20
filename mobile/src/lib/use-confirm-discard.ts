import { usePreventRemove } from "expo-router";
import { useRef, useState } from "react";
import { Alert, Keyboard } from "react-native";

import { nav } from "@/lib/nav";

type Options = {
  /**
   * While true (e.g. the keyboard is up), an attempt to swipe the sheet closed only closes the keyboard instead of
   * asking to discard, because that drag was meant for the keyboard (P-074). Leaving on purpose through the
   * returned `leave()` (a Cancel button) still asks.
   */
  quietGestures?: boolean;
  /** Alert title. Defaults to "Discard changes?"; a brand-new stamp says "Discard this stamp?" (P-088). */
  title?: string;
  /** Alert message. Defaults to "Your edits haven't been saved." */
  message?: string;
};

/**
 * Ask before leaving a form with unsaved changes (back button or swipe).
 *
 * After a successful save, call `allowLeave()` right before navigating away. It drops the block synchronously, so
 * the discard alert can't flash over work that was just saved while React is still re-rendering (P-087).
 */
export function useConfirmDiscard(dirty: boolean, { quietGestures = false, title = "Discard changes?", message = "Your edits haven't been saved." }: Options = {}): { leave: () => void; allowLeave: () => void } {
  const [discarded, setDiscarded] = useState(false);
  const explicit = useRef(false);

  const disablePrevention = usePreventRemove(dirty && !discarded, ({ repeat }) => {
    const onPurpose = explicit.current;
    explicit.current = false;
    if (quietGestures && !onPurpose) {
      Keyboard.dismiss();
      return;
    }
    Alert.alert(title, message, [
      { text: "Keep editing", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          setDiscarded(true);
          repeat();
        },
      },
    ]);
  });

  return {
    leave: () => {
      explicit.current = true;
      nav.back();
    },
    allowLeave: () => {
      setDiscarded(true);
      disablePrevention?.();
    },
  };
}
