import { Children, forwardRef, Fragment, isValidElement, useState, type ReactNode } from "react";
import { StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from "react-native";

import { useAnnounce } from "@/lib/a11y";
import { colors, fonts, hairlineWidth, maxFontSizeMultiplier, space, type as typeScale } from "@/theme";
import { Text } from "./text";

type FieldProps = TextInputProps & {
  label: string;
  invalid?: boolean;
  error?: string | null;
};

export const Field = forwardRef<TextInputInstance, FieldProps>(function Field({ label, invalid, error, style, accessibilityHint, onFocus, onBlur, ...rest }, ref) {
  const hasError = !!invalid || !!error;
  const [focused, setFocused] = useState(false);
  useAnnounce(error ?? null);
  return (
    <View style={styles.row}>
      <Text
        variant="footnote"
        color={hasError ? "danger" : "textPrimary"}
        style={styles.label}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {label.toUpperCase()}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={hasError ? `${label}, needs attention` : label}
        accessibilityHint={accessibilityHint}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        autoCorrect={rest.keyboardType === "email-address" ? false : undefined}
        spellCheck={rest.keyboardType === "email-address" ? false : undefined}
        {...rest}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[styles.input, !rest.multiline && styles.singleLine, rest.editable === false && styles.locked, focused && styles.inputFocused, hasError && styles.inputInvalid, style]}
      />
      {error ? (
        <Text variant="footnote" color="danger" style={styles.fieldError}>
          {error}
        </Text>
      ) : null}
    </View>
  );
});

type GroupProps = {
  children: ReactNode;
  footer?: string;
  errors?: (string | null | undefined)[];
  /** A character counter (e.g. "12 / 280"), shown right-aligned in tabular figures. */
  counter?: string;
};

export function FieldGroup({ children, footer, errors, counter }: GroupProps) {
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
      {counter ? (
        <Text variant="footnote" color="textTertiary" tabular align="right">
          {counter}
        </Text>
      ) : null}
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
  row: { minHeight: 66, gap: space.xxs },
  label: { fontFamily: fonts.monoBold, letterSpacing: 1.35 },
  input: {
    minHeight: 44,
    borderBottomWidth: hairlineWidth,
    borderBottomColor: colors.hairline,
    color: colors.textPrimary,
    paddingHorizontal: 0,
    paddingVertical: space.xs,
    ...typeScale.body,
  },
  // A single-line TextInput with lineHeight can misplace the cursor on iOS (P-030k).
  singleLine: { lineHeight: undefined },
  inputFocused: { borderBottomColor: colors.accent, borderBottomWidth: 1.5 },
  locked: { color: colors.textSecondary, borderBottomColor: colors.transparent },
  inputInvalid: { borderBottomColor: colors.danger },
  fieldError: {},
  footer: { paddingHorizontal: 0 },
});
