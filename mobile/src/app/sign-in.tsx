import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, errorText } from "@/api";
import { completeEmailSignIn, startEmailSignIn, type EmailChallenge } from "@/api/email-auth";
import { farewellNotice, useAuth } from "@/auth/auth-context";
import { InlineError } from "@/components/ui/inline-error";
import { haptics } from "@/lib/haptics";
import { HANDLE_MAX, HANDLE_MIN, HANDLE_RE, isEmail } from "@/lib/validation";
import { colors, fonts } from "@/theme";

const SIGN_IN_ART = require("../../assets/images/nostos_art1.png");

function isHandle(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.length >= HANDLE_MIN && normalized.length <= HANDLE_MAX && HANDLE_RE.test(normalized);
}

function isLoginIdentifier(value: string) {
  return isEmail(value) || isHandle(value);
}

export default function SignIn() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [farewell] = useState(() => farewellNotice.take());
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<EmailChallenge | null>(null);

  const requestCode = useMutation({
    mutationFn: () => startEmailSignIn(identifier.trim()),
    onSuccess: (next) => {
      setChallenge(next);
      setCode("");
      haptics.success();
    },
    onError: () => haptics.warning(),
  });

  const verify = useMutation({
    mutationFn: () => completeEmailSignIn(challenge!.challengeId, code),
    onSuccess: (res) => signIn(res),
    onError: () => haptics.warning(),
  });

  const noAccount = requestCode.error instanceof ApiError && requestCode.error.code === "not_found";
  const enteredEmail = isEmail(identifier);
  const validIdentifier = isLoginIdentifier(identifier);

  const createAccount = () => {
    const value = identifier.trim();
    if (enteredEmail) {
      router.push({ pathname: "/sign-up", params: { email: value } });
      return;
    }
    router.push("/sign-up");
  };

  const submitIdentifier = () => {
    if (!validIdentifier || requestCode.isPending) return;
    Keyboard.dismiss();
    requestCode.mutate();
  };

  const submitCode = () => {
    if (!challenge || code.length !== 6 || verify.isPending) return;
    Keyboard.dismiss();
    verify.mutate();
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, 12) }]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={Keyboard.dismiss} accessible={false}>
          <Text style={styles.wordmark}>NOSTOS</Text>
          <Image
            source={SIGN_IN_ART}
            style={styles.collage}
            resizeMode="cover"
            accessibilityLabel="Original Greek engraved-eye newspaper collage"
            accessibilityIgnoresInvertColors
          />
          <Text style={styles.headline}>Your city,{`\n`}remembered.</Text>
        </Pressable>

        <View style={styles.form}>
          <View style={styles.formHeading}>
            <Text style={styles.formTitle}>Sign in</Text>
            <Text style={styles.formSubtitle}>Enter your email or handle. We’ll send a sign-in code to the email on your account.</Text>
          </View>

          {farewell ? <Text style={styles.notice}>{farewell}</Text> : null}

          <View style={styles.field}>
            <Text style={styles.label}>EMAIL OR HANDLE</Text>
            <TextInput
              style={styles.input}
              placeholder="name@example.com or handle"
              placeholderTextColor={colors.textSecondary}
              value={identifier}
              onChangeText={(value) => {
                setIdentifier(value);
                requestCode.reset();
                if (challenge) {
                  setChallenge(null);
                  setCode("");
                }
              }}
              editable={!requestCode.isPending && !verify.isPending}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="username"
              textContentType="username"
              keyboardType="email-address"
              returnKeyType={challenge ? "next" : "go"}
              onSubmitEditing={challenge ? undefined : submitIdentifier}
              accessibilityLabel="Email or handle"
            />
          </View>

          {challenge ? (
            <>
              <Text style={styles.notice}>{enteredEmail ? `We sent a six-digit code to ${identifier.trim()}.` : "We sent a six-digit code to the email on your account."}</Text>
              <View style={styles.field}>
                <Text style={styles.label}>VERIFICATION CODE</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="000000"
                  placeholderTextColor={colors.textSecondary}
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  returnKeyType="go"
                  onSubmitEditing={submitCode}
                  accessibilityLabel="Verification code"
                />
              </View>
            </>
          ) : null}

          {noAccount ? (
            <View style={styles.newAccount}>
              <Text style={styles.newAccountTitle}>{enteredEmail ? "Looks like you’re new to Nostos." : "We couldn’t find that Nostos account."}</Text>
              <Text style={styles.notice}>{enteredEmail ? `Create a passport with ${identifier.trim()}.` : "Check the handle or create a new passport."}</Text>
              <Pressable onPress={createAccount} style={styles.secondaryAction} accessibilityRole="button" accessibilityLabel="Create a passport">
                <Text style={styles.createText}>Create a passport</Text>
              </Pressable>
            </View>
          ) : requestCode.error ? (
            <InlineError message={errorText(requestCode.error, "Couldn't send a sign-in code. Try again.")} />
          ) : null}

          {verify.error ? <InlineError message={errorText(verify.error, "Couldn't verify that code. Try again.")} /> : null}

          {!noAccount ? (
            <Pressable
              onPress={challenge ? submitCode : submitIdentifier}
              disabled={challenge ? code.length !== 6 || verify.isPending : !validIdentifier || requestCode.isPending}
              style={({ pressed }) => [
                styles.signIn,
                (challenge ? code.length !== 6 || verify.isPending : !validIdentifier || requestCode.isPending) && styles.disabled,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={challenge ? "Sign in" : "Send sign-in code"}
            >
              <Text style={styles.signInText}>
                {challenge ? (verify.isPending ? "Signing in…" : "Sign in") : requestCode.isPending ? "Sending…" : "Send sign-in code"}
              </Text>
            </Pressable>
          ) : null}

          {challenge ? (
            <Pressable
              onPress={() => requestCode.mutate()}
              disabled={requestCode.isPending}
              style={styles.secondaryAction}
              accessibilityRole="button"
            >
              <Text style={styles.createText}>{requestCode.isPending ? "Sending…" : "Send another code"}</Text>
            </Pressable>
          ) : !noAccount ? (
            <Pressable onPress={createAccount} style={styles.secondaryAction} accessibilityRole="button">
              <Text style={styles.createText}>New to Nostos? Create a passport</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  wordmark: { color: colors.accent, fontFamily: fonts.serifRegular, fontSize: 72, lineHeight: 76, letterSpacing: -2.8, paddingHorizontal: 24, paddingBottom: 4 },
  collage: { width: "100%", height: 299, backgroundColor: colors.elevated },
  headline: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 67, lineHeight: 64, letterSpacing: -1.7, paddingHorizontal: 24, paddingTop: 12 },
  form: { paddingHorizontal: 24, paddingTop: 18, gap: 16 },
  formHeading: { gap: 3 },
  formTitle: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 28, lineHeight: 31 },
  formSubtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 16 },
  notice: { color: colors.textSecondary, fontSize: 12, lineHeight: 16 },
  field: { gap: 4 },
  label: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.5 },
  input: { height: 44, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, color: colors.textPrimary, fontSize: 14, paddingHorizontal: 10, paddingVertical: 0 },
  codeInput: { fontFamily: fonts.monoBold, fontSize: 22, letterSpacing: 6 },
  signIn: { height: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  signInText: { color: colors.onAccent, fontSize: 14, fontWeight: "500" },
  secondaryAction: { minHeight: 36, alignItems: "center", justifyContent: "center" },
  newAccount: { gap: 4 },
  newAccountTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.78 },
  createText: { color: colors.accent, fontSize: 13 },
});
