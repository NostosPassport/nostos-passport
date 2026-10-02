import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, hairlineWidth, radius, size, space, type ColorToken } from "@/theme";
import { Icon, type SymbolName } from "./icon";
import { Text } from "./text";

type RowProps = {
  title: string;
  /** Shown right after the title (the verified badge). The row's spoken label must mention it. */
  titleAccessory?: ReactNode;
  subtitle?: string;
  icon?: SymbolName;
  iconColor?: ColorToken;
  leading?: ReactNode;
  trailing?: ReactNode;
  titleColor?: ColorToken;
  chevron?: boolean;
  /** "external" shows arrow.up.right (opens a browser sheet) instead of a push chevron. */
  external?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /**
   * VoiceOver actions for a pressable row whose trailing control (Follow, Unblock) can't be focused
   * separately inside it.
   */
  actions?: { label: string; onPress: () => void }[];
};

/** A row in an inset grouped list (Settings style). */
export function ListRow({
  title,
  titleAccessory,
  subtitle,
  icon,
  iconColor = "textSecondary",
  leading,
  trailing,
  titleColor = "textPrimary",
  chevron,
  external,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  actions,
}: RowProps) {
  const content = (
    <>
      {leading ?? (icon && <Icon name={icon} color={iconColor} size={size.icon} />)}
      <View style={styles.text}>
        {titleAccessory ? (
          <View style={styles.titleRow}>
            <Text variant="body" color={titleColor} style={styles.titleShrink} numberOfLines={1}>
              {title}
            </Text>
            {titleAccessory}
          </View>
        ) : (
          <Text variant="body" color={titleColor}>
            {title}
          </Text>
        )}
        {!!subtitle && (
          <Text variant="footnote" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
      {chevron && <Icon name="chevron.right" color="textTertiary" size={size.iconTiny} />}
      {external && <Icon name="arrow.up.right" color="textTertiary" size={size.iconTiny} />}
    </>
  );
  const label = accessibilityLabel ?? [title, subtitle].filter(Boolean).join(", ");
  if (!onPress) {
    // With a trailing control, let VoiceOver reach the text and the control separately.
    return (
      <View style={styles.row} accessible={!trailing} accessibilityLabel={trailing ? undefined : label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={external ? "link" : "button"}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityActions={actions?.map((a) => ({ name: a.label, label: a.label }))}
      onAccessibilityAction={(e) => actions?.find((a) => a.label === e.nativeEvent.actionName)?.onPress()}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

/** Inset grouped card with hairlines between rows, plus an optional header and footer. */
export function ListGroup({ header, footer, children }: { header?: string; footer?: string; children: ReactNode }) {
  const rows = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  return (
    <View style={styles.wrap}>
      {!!header && (
        <Text variant="footnote" color="textSecondary" weight="semibold" style={styles.header} accessibilityRole="header">
          {header}
        </Text>
      )}
      <View style={styles.group}>
        {rows.map((r, i) => (
          <View key={i}>
            {i > 0 && <View style={styles.separator} />}
            {r}
          </View>
        ))}
      </View>
      {!!footer && (
        <Text variant="footnote" color="textTertiary" style={styles.footer}>
          {footer}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  header: { paddingHorizontal: space.md },
  footer: { paddingHorizontal: space.md },
  group: { backgroundColor: colors.surface, borderRadius: radius.card, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: size.hitTarget + space.xs, paddingHorizontal: space.md, paddingVertical: space.sm },
  pressed: { backgroundColor: colors.pressedOverlay },
  text: { flex: 1, gap: space.xxs },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.xxs },
  titleShrink: { flexShrink: 1 },
  separator: { height: hairlineWidth, backgroundColor: colors.hairline, marginLeft: space.md },
});
