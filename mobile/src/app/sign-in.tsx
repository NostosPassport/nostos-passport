import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ApiError, errorText } from "@/api";
import { completeEmailSignIn, startEmailSignIn, type EmailChallenge } from "@/api/email-auth";
import { farewellNotice, useAuth } from "@/auth/auth-context";
import { InlineError } from "@/components/ui/inline-error";
import { haptics } from "@/lib/haptics";
import { isEmail } from "@/lib/validation";
import { colors, fonts } from "@/theme";

const SIGN_IN_ART = require("../../assets/images/nostos_art1.png");

export default function SignIn() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [farewell] = useState(() => farewellNotice.take());
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<EmailChallenge | null>(null);

  const requestCode = useMutation({
    mutationFn: () => startEmailSignIn(email.trim()),
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
  const collageHeight = challenge ? Math.max(92, Math.min(132, height * 0.15)) : Math.max(128, Math.min(190, height * 0.22));

  const createAccount = () => {
    const value = email.trim();
    if (value) {
      router.push({ pathname: "/sign-up", params: { email: value } });
      return;
    }
    router.push("/sign-up");
  };

  const submitEmail = () => {
    if (!isEmail(email) || requestCode.isPending) return;
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
      <View style={[styles.content, { paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, 10) }]}>
        <Pressable onPress={Keyboard.dismiss} accessible={false} style={styles.hero}>
          <Text style={styles.wordmark}>NOSTOS</Text>
          <Image
            source={SIGN_IN_ART}
            style={[styles.collage, { height: collageHeight }]}
            resizeMode="cover"
            accessibilityLabel="Original Greek engraved-eye newspaper collage"
            accessibilityIgnoresInvertColors
          />
          <Text style={styles.headline}>Your city,{`\n`}remembered.</Text>
        </Pressable>

        <View style={styles.form}>
          <View style={styles.formHeading}>
            <Text style={styles.formTitle}>Sign in</Text>
            <Text style={styles.formSubtitle}>Enter the email on your Nostos account. We’ll send you a sign-in code.</Text>
          </View>

          {farewell ? <Text style={styles.notice}>{farewell}</Text> : null}

          <View style={styles.field}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
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
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              returnKeyType={challenge ? "next" : "go"}
              onSubmitEditing={challenge ? undefined : submitEmail}
              accessibilityLabel="Email"
            />
          </View>

          {challenge ? (
            <>
              <Text style={styles.notice}>We sent a six-digit code to {email.trim()}.</Text>
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
                  returnKeyType="go"
                  onSubmitEditing={submitCode}
                  accessibilityLabel="Verification code"
                />
              </View>
            </>
          ) : null}

          {noAccount ? (
            <View style={styles.newAccount}>
              <Text style={styles.newAccountTitle}>Looks like you’re new to Nostos.</Text>
              <Text style={styles.notice}>Create a passport with {email.trim()}.</Text>
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
              onPress={challenge ? submitCode : submitEmail}
              disabled={challenge ? code.length !== 6 || verify.isPending : !isEmail(email) || requestCode.isPending}
              style={({ pressed }) => [
                styles.signIn,
                (challenge ? code.length !== 6 || verify.isPending : !isEmail(email) || requestCode.isPending) && styles.disabled,
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
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: "space-between" },
  hero: { flexShrink: 1 },
  wordmark: { color: colors.accent, fontFamily: fonts.serifRegular, fontSize: 54, lineHeight: 57, letterSpacing: -2.1, paddingHorizontal: 24, paddingBottom: 2 },
  collage: { width: "100%", backgroundColor: colors.elevated },
  headline: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 46, lineHeight: 43, letterSpacing: -1.2, paddingHorizontal: 24, paddingTop: 8 },
  form: { paddingHorizontal: 24, paddingTop: 12, gap: 10 },
  formHeading: { gap: 2 },
  formTitle: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 28, lineHeight: 31 },
  formSubtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 16 },
  notice: { color: colors.textSecondary, fontSize: 12, lineHeight: 16 },
  field: { gap: 3 },
  label: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.5 },
  input: { height: 40, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, color: colors.textPrimary, fontSize: 14, paddingHorizontal: 10, paddingVertical: 0 },
  codeInput: { fontFamily: fonts.monoBold, fontSize: 21, letterSpacing: 6 },
  signIn: { height: 46, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  signInText: { color: colors.onAccent, fontSize: 14, fontWeight: "500" },
  secondaryAction: { minHeight: 32, alignItems: "center", justifyContent: "center" },
  newAccount: { gap: 3 },
  newAccountTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.78 },
  createText: { color: colors.accent, fontSize: 13 },
});
