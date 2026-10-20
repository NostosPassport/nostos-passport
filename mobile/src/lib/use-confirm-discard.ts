import { useNavigation } from "expo-router";
import { useEffect } from "react";
import { Alert } from "react-native";

/** Ask before leaving a form with unsaved changes (back button or swipe). */
export function useConfirmDiscard(dirty: boolean): void {
  const navigation = useNavigation();

  useEffect(() => {
    if (!dirty) return;
    return navigation.addListener("beforeRemove", (event) => {
      event.preventDefault();
      Alert.alert("Discard changes?", "Your edits haven't been saved.", [
        { text: "Keep editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(event.data.action) },
      ]);
    });
  }, [dirty, navigation]);
}
