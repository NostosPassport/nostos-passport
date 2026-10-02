import { Children, forwardRef, Fragment, isValidElement, type ReactNode } from "react";
import { StyleSheet, TextInput, useWindowDimensions, View, type TextInputProps } from "react-native";

import { useAnnounce } from "@/lib/a11y";
import { colors, hairlineWidth, maxFontSizeMultiplier, radius, size, space, type as typeScale } from "@/theme";
import { Text } from "./text";

type FieldProps = TextInputProps & {
  label: string;
  /** Marks the row invalid; the message itself is shown in the group footer. */
  invalid?: boolean;
};

/** One row of an inset grouped form: label on the left, input on the right (stacked at large text sizes). */
export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, invalid, style, accessibilityHint, ...rest }, ref) {
  const { fontScale } = useWindowDimensions();
  const stacked = fontScale > 1.3;
  return (
    <View style={[styles.row, stacked && styles.rowStacked]}>
      <Text
        variant="body"
        color={invalid ? "danger" : "textPrimary"}
        style={stacked ? undefined : styles.label}
        numberOfLines={stacked ? undefined : 1}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={invalid ? `${label}, needs attention` : label}
        accessibilityHint={accessibilityHint}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.accent}
        keyboardAppearance="dark"
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        {...rest}
        style={[styles.input, style]}
      />
    </View>
  );
});

type GroupProps = {
  children: ReactNode;
  /** Help text under the group. */
  footer?: string;
  /** Validation messages; replaces the footer while present and is announced to VoiceOver. */
  errors?: (string | null | undefined)[];
};

/** Inset grouped card of fields separated by hairlines, like iOS Settings. */
export function FieldGroup({ children, footer, errors }: GroupProps) {
  const messages = (errors ?? []).filter((e): e is string => !!e);
  useAnnounce(messages.join(" "));
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={styles.groupWrap}>
      <View style={styles.group}>
        {rows.map((child, i) => (
          <Fragment key={child.key ?? i}>
            {i > 0 && <View style={styles.separator} />}
            {child}
          </Fragment>
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
  group: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", minHeight: size.fieldHeight, paddingHorizontal: space.md, gap: space.sm },
  rowStacked: { flexDirection: "column", alignItems: "stretch", paddingVertical: space.sm, gap: space.xxs },
  label: { width: size.fieldLabel },
  input: { flex: 1, ...typeScale.body, color: colors.textPrimary, paddingVertical: space.sm },
  separator: { height: hairlineWidth, backgroundColor: colors.hairline, marginLeft: space.md },
  footer: { paddingHorizontal: space.md },
});
