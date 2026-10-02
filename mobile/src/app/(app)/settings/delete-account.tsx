import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { api, ApiError, errorText } from "@/api";
import { useMe } from "@/api/queries";
import { farewellNotice, useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { FormScreen } from "@/components/ui/form-screen";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { Text } from "@/components/ui/text";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { haptics } from "@/lib/haptics";
import { colors, radius, size, space } from "@/theme";

const WHAT_HAPPENS = [
  "Your name, handle, email and password are erased.",
  "Your photos are removed, and so are your follows and plans.",
  "Your reports and comments stay, shown as \u201CDeleted user\u201D, so tonight\u2019s counts stay honest.",
  "You\u2019re signed out on every device. This can\u2019t be undone.",
];

const FAREWELL = "Your account is deleted.";

/** Guideline 5.1.1(v): delete the account from inside the app. Two taps from Profile to the button. */
export default function DeleteAccount() {
  const { forget } = useAuth();
  const me = useMe();
  const [password, setPassword] = useState("");
  const owned = me.data?.ownedVenues ?? [];

  const del = useMutation({
    mutationFn: async () => {
      try {
        return await api.me.deleteAccount(password);
      } catch (e) {
        // A retry after a timeout that actually succeeded: the token is already dead, so it's done.
        if (e instanceof ApiError && e.code === "invalid_token") {
          farewellNotice.set(FAREWELL);
          return { deleted: true as const };
        }
        throw e;
      }
    },
    onMutate: () => farewellNotice.set(FAREWELL),
    onSuccess: async () => {
      // The account is gone; the token already stopped working. Sign out locally only.
      await forget();
    },
    onError: () => {
      farewellNotice.take();
      haptics.warning();
    },
  });

  const confirm = () => {
    if (!password || del.isPending) return;
    Alert.alert("Delete your account?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => del.mutate() },
    ]);
  };

  const wrongPassword = del.error instanceof ApiError && del.error.code === "wrong_password";

  return (
    <FormScreen>
      <View style={styles.warning}>
        <Icon name="exclamationmark.triangle.fill" color="danger" size={size.iconLarge} />
        <Text variant="title2" accessibilityRole="header">
          Delete your account
        </Text>
        {[...WHAT_HAPPENS, ...(owned.length ? [`You\u2019ll lose access to ${owned.map((v) => v.name).join(", ")}.`] : [])].map((line) => (
          <View key={line} style={styles.bullet}>
            <View style={styles.dot} />
            <Text variant="callout" color="textSecondary" style={styles.flex}>
              {line}
            </Text>
          </View>
        ))}
      </View>

      <FieldGroup footer="Enter your password to confirm." errors={[wrongPassword ? "That password isn't right." : null]}>
        <Field
          label="Password"
          placeholder="Required"
          value={password}
          invalid={wrongPassword}
          onChangeText={(v) => {
            setPassword(v);
            if (del.error) del.reset();
          }}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={confirm}
          testID="delete-password"
        />
      </FieldGroup>

      {del.error && !wrongPassword && <InlineError message={errorText(del.error, "Couldn't delete your account. Try again.")} />}
      <Button title="Delete account" variant="destructive" onPress={confirm} disabled={!password} loading={del.isPending} />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  warning: { gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface },
  bullet: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  dot: { width: space.xs, height: space.xs, borderRadius: radius.pill, backgroundColor: colors.textTertiary, marginTop: space.xs },
  flex: { flex: 1 },
});
