import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";

import { ApiError, errorText } from "@/api";
import { deleteAccountWithCode, startDeleteAccountVerification, type EmailChallenge } from "@/api/email-auth";
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
  "Your email and handle are replaced, your name is reset, and your bio and profile photo are removed.",
  "Your stamps and their image files are permanently removed.",
  "Your saved passport progress is removed, and you’re signed out on every device.",
  "This can’t be undone.",
];

const FAREWELL = "Your account is deleted.";

export default function DeleteAccount() {
  const { forget } = useAuth();
  const [challenge, setChallenge] = useState<EmailChallenge | null>(null);
  const [code, setCode] = useState("");

  const requestCode = useMutation({
    mutationFn: startDeleteAccountVerification,
    onSuccess: (next) => {
      setChallenge(next);
      setCode("");
      haptics.success();
    },
    onError: () => haptics.warning(),
  });

  const del = useMutation({
    mutationFn: async () => {
      try {
        return await deleteAccountWithCode(challenge!.challengeId, code);
      } catch (e) {
        if (e instanceof ApiError && e.code === "invalid_token") {
          farewellNotice.set(FAREWELL);
          return { deleted: true as const };
        }
        throw e;
      }
    },
    onMutate: () => farewellNotice.set(FAREWELL),
    onSuccess: async () => {
      await forget();
    },
    onError: () => {
      farewellNotice.take();
      haptics.warning();
    },
  });

  const confirm = () => {
    if (!challenge) {
      requestCode.mutate();
      return;
    }
    if (code.length !== 6 || del.isPending) return;
    Alert.alert("Delete your account?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => del.mutate() },
    ]);
  };

  return (
    <FormScreen>
      <View style={styles.warning}>
        <Icon name="exclamationmark.triangle.fill" color="danger" size={size.iconLarge} />
        <Text variant="title2" accessibilityRole="header">
          Delete your account
        </Text>
        {WHAT_HAPPENS.map((line) => (
          <View key={line} style={styles.bullet}>
            <View style={styles.dot} />
            <Text variant="callout" color="textSecondary" style={styles.flex}>
              {line}
            </Text>
          </View>
        ))}
      </View>

      {challenge ? (
        <FieldGroup footer="Enter the six-digit code we sent to your current account email.">
          <Field
            label="Verification code"
            placeholder="000000"
            value={code}
            onChangeText={(value) => {
              setCode(value.replace(/\D/g, "").slice(0, 6));
              if (del.error) del.reset();
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={confirm}
            testID="delete-code"
          />
        </FieldGroup>
      ) : (
        <Text variant="callout" color="textSecondary">We’ll email your current account address with a confirmation code before anything is deleted.</Text>
      )}

      {requestCode.error ? <InlineError message={errorText(requestCode.error, "Couldn't send a confirmation code. Try again.")} /> : null}
      {del.error ? <InlineError message={errorText(del.error, "Couldn't delete your account. Try again.")} /> : null}
      <Button
        title={challenge ? "Delete account" : "Email confirmation code"}
        variant="destructive"
        onPress={confirm}
        disabled={challenge ? code.length !== 6 : false}
        loading={requestCode.isPending || del.isPending}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  warning: { gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface },
  bullet: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  dot: { width: space.xs, height: space.xs, borderRadius: radius.pill, backgroundColor: colors.textTertiary, marginTop: space.xs },
  flex: { flex: 1 },
});
