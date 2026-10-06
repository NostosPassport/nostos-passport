import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from "react-native";

import { colors, dimmedOpacity, hairlineWidth, size, space, type ColorToken } from "@/theme";
import { Icon, type SymbolName } from "./icon";
import { Text } from "./text";

type Variant = "primary" | "secondary" | "plain" | "destructive";

type Props = Omit<PressableProps, "children" | "style"> & {
  title: string;
  variant?: Variant;
  icon?: SymbolName;
  loading?: boolean;
  block?: boolean;
  compact?: boolean;
};

const fg: Record<Variant, ColorToken> = {
  primary: "onAccent",
  secondary: "textPrimary",
  plain: "accent",
  destructive: "textPrimary",
};

export function Button({ title, variant = "primary", icon, loading, block = true, compact, disabled, accessibilityLabel, ...rest }: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      hitSlop={compact ? space.xs : undefined}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        block ? styles.block : styles.inline,
        variant === "primary" && styles.primary,
        (variant === "secondary" || variant === "destructive") && styles.outline,
        variant === "plain" && styles.plain,
        pressed && !inactive && styles.pressed,
        inactive && styles.disabled,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={colors[fg[variant]]} />
        ) : (
          <>
            {icon && <Icon name={icon} color={fg[variant]} size={size.iconSmall} />}
            <Text variant="body" color={fg[variant]} numberOfLines={2} align="center" style={styles.title}>
              {title}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 1,
    paddingHorizontal: space.lg,
    justifyContent: "center",
  },
  primary: { backgroundColor: colors.accent },
  outline: { backgroundColor: colors.transparent, borderWidth: hairlineWidth, borderColor: colors.hairline },
  plain: { backgroundColor: colors.transparent, paddingHorizontal: space.md },
  compact: { minHeight: size.hitTarget, paddingHorizontal: space.md },
  block: { alignSelf: "stretch" },
  inline: { alignSelf: "flex-start" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs, paddingVertical: space.xs },
  title: { flexShrink: 1 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: dimmedOpacity },
});
