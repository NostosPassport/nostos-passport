import type { ReactNode } from "react";
import { Keyboard, Pressable, type StyleProp, type ViewStyle } from "react-native";

/**
 * A non-interactive area that closes the keyboard when tapped (titles, headings, empty space around a form).
 * It never dims and is invisible to VoiceOver. Inside a ScrollView with keyboardShouldPersistTaps="handled",
 * buttons and rows keep working on the first tap.
 */
export function DismissKeyboard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={Keyboard.dismiss} accessible={false} style={style}>
      {children}
    </Pressable>
  );
}
