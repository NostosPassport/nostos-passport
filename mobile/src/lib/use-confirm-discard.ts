import { useNavigation, usePreventRemove } from "expo-router";
import { Alert } from "react-native";

/** Ask before leaving a form with unsaved changes (back button or swipe). */
export function useConfirmDiscard(dirty: boolean): void {
  const navigation = useNavigation();
  usePreventRemove(dirty, ({ data }) => {
    Alert.alert("Discard changes?", "Your edits haven't been saved.", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(data.action) },
    ]);
  });
}
