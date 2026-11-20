import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { useAccountState } from "@/auth/account-state";
import { InlineError } from "@/components/ui/inline-error";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { colors, screenPadding, size, space } from "@/theme";

/** Holds a screen until the signed-in account has loaded. `title` names what is waiting; `message` says why. */
export function AccountGate({ title, message, children }: { title: string; message: string; children: ReactNode }) {
  const { state, retry, retrying } = useAccountState();
  if (state === "ready") return <>{children}</>;
  return (
    <View style={styles.root}>
      {state === "checking" && (
        <View style={styles.block} accessible accessibilityRole="progressbar" accessibilityLabel={`${title}. ${message}`}>
          <Skeleton width={size.avatarLarge} height={size.avatarLarge} round />
          <Text variant="headline" align="center">{title}</Text>
          <Text variant="callout" color="textSecondary" align="center">{message}</Text>
        </View>
      )}
      {state === "error" && (
        <View style={styles.block}>
          <Text variant="headline" align="center" accessibilityRole="header">{title}</Text>
          <InlineError message="Couldn't check your account. Your connection may be down." onRetry={retry} retrying={retrying} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, justifyContent: "center", paddingHorizontal: screenPadding },
  block: { alignItems: "center", gap: space.sm },
});
