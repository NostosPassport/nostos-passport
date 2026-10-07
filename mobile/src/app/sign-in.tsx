import { useMutation } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorText } from "@/api";
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 4, paddingBottom: Math.max(insets.bottom, 12) }]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={Keyboard.dismiss} accessible={false} style={styles.dismissArea}>
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
          {requestCode.error ? <InlineError message={errorText(requestCode.error, "Couldn't send a sign-in code. Try again.")} /> : null}
          {verify.error ? <InlineError message={errorText(verify.error, "Couldn't verify that code. Try again.")} /> : null}
          <Pressable
            onPress={challenge ? submitCode : submitEmail}
            disabled={challenge ? code.length !== 6 || verify.isPending : !isEmail(email) || requestCode.isPending}
            style={({ pressed }) => [
              styles.signIn,
              (challenge ? code.length !== 6 || verify.isPending : !isEmail(email) || requestCode.isPending) && styles.disabled,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.signInText}>
              {challenge ? (verify.isPending ? "Signing in…" : "Sign in") : requestCode.isPending ? "Sending…" : "Email me a code"}
            </Text>
          </Pressable>
          {challenge ? (
            <Pressable
              onPress={() => requestCode.mutate()}
              disabled={requestCode.isPending}
              style={styles.secondaryAction}
              accessibilityRole="button"
            >
              <Text style={styles.createText}>{requestCode.isPending ? "Sending…" : "Send another code"}</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={() => router.push("/sign-up")} style={styles.create} accessibilityRole="button">
          <Text style={styles.createText}>New here? Create a passport</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { flexGrow: 1 },
  dismissArea: { flexShrink: 0 },
  wordmark: { color: colors.accent, fontFamily: fonts.serifRegular, fontSize: 72, lineHeight: 76, letterSpacing: -2.8, paddingHorizontal: 24, paddingBottom: 4 },
  collage: { width: "100%", height: 299, backgroundColor: colors.elevated },
  headline: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 67, lineHeight: 64, letterSpacing: -1.7, paddingHorizontal: 24, paddingTop: 12 },
  form: { paddingHorizontal: 24, paddingTop: 18, gap: 16 },
  notice: { color: colors.textSecondary, fontSize: 12, lineHeight: 16 },
  field: { gap: 4 },
  label: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.5 },
  input: { height: 44, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline, color: colors.textPrimary, fontSize: 14, paddingHorizontal: 10, paddingVertical: 0 },
  codeInput: { fontFamily: fonts.monoBold, fontSize: 22, letterSpacing: 6 },
  signIn: { height: 48, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent },
  signInText: { color: colors.onAccent, fontSize: 14, fontWeight: "500" },
  secondaryAction: { minHeight: 36, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.78 },
  create: { marginTop: "auto", minHeight: 52, alignItems: "center", justifyContent: "center" },
  createText: { color: colors.accent, fontSize: 13 },
});
