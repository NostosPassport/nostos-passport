import { usePreventRemove } from "expo-router";
import { useRef, useState } from "react";
import { Alert, Keyboard } from "react-native";

import { nav } from "@/lib/nav";

/**
 * Ask before leaving a form with unsaved changes (back button or swipe).
 *
 * `quietGestures`: while true (e.g. the keyboard is up), an attempt to swipe the sheet closed only closes the
 * keyboard instead of asking to discard, because that drag was meant for the keyboard (P-074). Leaving on purpose
 * through the returned `leave()` (a Cancel button) still asks.
 */
export function useConfirmDiscard(dirty: boolean, { quietGestures = false }: { quietGestures?: boolean } = {}): { leave: () => void } {
  const [discarded, setDiscarded] = useState(false);
  const explicit = useRef(false);

  usePreventRemove(dirty && !discarded, ({ repeat }) => {
    const onPurpose = explicit.current;
    explicit.current = false;
    if (quietGestures && !onPurpose) {
      Keyboard.dismiss();
      return;
    }
    Alert.alert("Discard changes?", "Your edits haven't been saved.", [
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
  };
}
