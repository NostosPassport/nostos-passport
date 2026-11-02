import { usePreventRemove } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

/** Ask before leaving a form with unsaved changes (back button or swipe). */
export function useConfirmDiscard(dirty: boolean): void {
  const [discarded, setDiscarded] = useState(false);

  usePreventRemove(dirty && !discarded, ({ repeat }) => {
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
}
