import { Children, forwardRef, Fragment, isValidElement, type ReactNode } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";

import { useAnnounce } from "@/lib/a11y";
import { colors, fonts, hairlineWidth, maxFontSizeMultiplier, space, type as typeScale } from "@/theme";
import { Text } from "./text";

type FieldProps = TextInputProps & {
  label: string;
  invalid?: boolean;
};

export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, invalid, style, accessibilityHint, ...rest }, ref) {
  return (
    <View style={styles.row}>
      <Text
        variant="footnote"
        color={invalid ? "danger" : "textPrimary"}
        style={styles.label}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {label.toUpperCase()}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={invalid ? `${label}, needs attention` : label}
        accessibilityHint={accessibilityHint}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        keyboardAppearance="light"
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        {...rest}
        style={[styles.input, invalid && styles.inputInvalid, style]}
      />
    </View>
  );
});

type GroupProps = {
  children: ReactNode;
  footer?: string;
  errors?: (string | null | undefined)[];
};

export function FieldGroup({ children, footer, errors }: GroupProps) {
  const messages = (errors ?? []).filter((e): e is string => !!e);
  useAnnounce(messages.join(" "));
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.groupWrap}>
      <View style={styles.group}>
        {rows.map((child, i) => (
          <Fragment key={child.key ?? i}>{child}</Fragment>
        ))}
      </View>
      {messages.length > 0
        ? messages.map((m) => (
            <Text key={m} variant="footnote" color="danger" style={styles.footer}>
              {m}
            </Text>
          ))
        : !!footer && (
            <Text variant="footnote" color="textTertiary" style={styles.footer}>
              {footer}
            </Text>
          )}
    </View>
  );
}

const styles = StyleSheet.create({
  groupWrap: { gap: space.xs },
  group: { gap: space.sm },
  row: { minHeight: 66, gap: 7 },
  label: { fontFamily: fonts.monoBold, letterSpacing: 1.35 },
  input: {
    minHeight: 44,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.hairline,
    color: colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: space.xs,
    ...typeScale.body,
  },
  inputInvalid: { borderBottomColor: colors.accent },
  footer: { paddingHorizontal: 0 },
});
