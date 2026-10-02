import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useAccountState } from "@/auth/account-state";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { colors, screenPadding, size, space } from "@/theme";

/**
 * Shows `children` once the account is ready. While the account is still loading it says so ("Checking your account"),
 * when /api/me failed it offers Try again, and only a real guest gets "Sign in". Screens that need an account use this
 * so a slow or failed load never reads as "you're signed out".
 */
export function AccountGate({ title, message, children }: { title: string; message: string; children: ReactNode }) {
  const { state, retry, retrying } = useAccountState();
  if (state === "ready") return <>{children}</>;
  return (
    <View style={styles.root}>
      {state === "checking" && (
        <View style={styles.block} accessibilityRole="progressbar" accessibilityLabel="Checking your account">
          <Skeleton width={size.avatarLarge} height={size.avatarLarge} round />
          <Text variant="headline">Checking your account</Text>
          <Text variant="callout" color="textSecondary">
            One moment.
          </Text>
        </View>
      )}
      {state === "error" && (
        <View style={styles.block}>
          <InlineError message="Couldn't check your account. Your connection may be down." onRetry={retry} retrying={retrying} />
        </View>
      )}
      {state === "guest" && (
        <View style={styles.block}>
          <Icon name="person.crop.circle" color="textSecondary" size={size.iconLarge} />
          <Text variant="title2" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="callout" color="textSecondary" style={styles.center}>
            {message}
          </Text>
          <Button title="Sign in" block={false} onPress={() => router.push("/sign-in")} />
          <Button title="Create account" variant="plain" block={false} onPress={() => router.push("/sign-up")} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, justifyContent: "center", paddingHorizontal: screenPadding },
  block: { alignItems: "center", gap: space.sm },
  center: { textAlign: "center" },
});
