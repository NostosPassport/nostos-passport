import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, hairlineWidth, size, space, type ColorToken } from "@/theme";
import { Icon, type SymbolName } from "./icon";
import { Text } from "./text";

type RowProps = {
  title: string;
  titleAccessory?: ReactNode;
  subtitle?: string;
  icon?: SymbolName;
  iconColor?: ColorToken;
  leading?: ReactNode;
  trailing?: ReactNode;
  titleColor?: ColorToken;
  chevron?: boolean;
  external?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  actions?: { label: string; onPress: () => void }[];
};

export function ListRow({ title, titleAccessory, subtitle, icon, iconColor = "textSecondary", leading, trailing, titleColor = "textPrimary", chevron, external, onPress, accessibilityLabel, accessibilityHint, actions }: RowProps) {
  const content = (
    <>
      {leading ?? (icon && <Icon name={icon} color={iconColor} size={size.icon} />)}
      <View style={styles.text}>
        {titleAccessory ? (
          <View style={styles.titleRow}>
            <Text variant="body" color={titleColor} style={styles.titleShrink} numberOfLines={1}>{title}</Text>
            {titleAccessory}
          </View>
        ) : (
          <Text variant="body" color={titleColor}>{title}</Text>
        )}
        {!!subtitle && <Text variant="footnote" color="textSecondary" numberOfLines={2}>{subtitle}</Text>}
      </View>
      {trailing}
      {chevron && <Icon name="chevron.right" color="textTertiary" size={size.iconTiny} />}
      {external && <Icon name="arrow.up.right" color="textTertiary" size={size.iconTiny} />}
    </>
  );
  const label = accessibilityLabel ?? [title, subtitle].filter(Boolean).join(", ");
  if (!onPress) return <View style={styles.row} accessible={!trailing} accessibilityLabel={trailing ? undefined : label}>{content}</View>;
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

export function ListGroup({ header, footer, children }: { header?: string; footer?: string; children: ReactNode }) {
  const rows = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  return (
    <View style={styles.wrap}>
      {!!header && <Text variant="typewriterSmall" color="textSecondary" style={styles.header} accessibilityRole="header">{header.toUpperCase()}</Text>}
      <View style={styles.group}>
        {rows.map((r, i) => <View key={i}>{i > 0 && <View style={styles.separator} />}{r}</View>)}
      </View>
      {!!footer && <Text variant="footnote" color="textTertiary" style={styles.footer}>{footer}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  header: { letterSpacing: 1.2 },
  footer: { paddingHorizontal: 0 },
  group: { backgroundColor: colors.transparent, borderTopWidth: hairlineWidth, borderBottomWidth: hairlineWidth, borderColor: colors.hairline },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 73, paddingVertical: space.sm },
  pressed: { opacity: 0.65 },
  text: { flex: 1, gap: space.xxs },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.xxs },
  titleShrink: { flexShrink: 1 },
  separator: { height: hairlineWidth, backgroundColor: colors.hairline },
});
