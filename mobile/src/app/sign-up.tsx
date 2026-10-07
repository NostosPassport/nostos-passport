import { useMutation } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { errorText } from "@/api";
import { completeSignup, startSignupEmail, type EmailChallenge } from "@/api/email-auth";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { InlineError } from "@/components/ui/inline-error";
import { Text } from "@/components/ui/text";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { checkBirthdate, formatBirthdateInput } from "@/lib/age";
import { useAnnounce } from "@/lib/a11y";
import { haptics } from "@/lib/haptics";
import { LEGAL, openWebPage } from "@/lib/links";
import { HANDLE_MAX, validateSignup, type SignupErrors, type SignupFields } from "@/lib/validation";
import { colors, fonts, screenPadding } from "@/theme";

export default function SignUp() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const initialEmail = Array.isArray(params.email) ? params.email[0] ?? "" : params.email ?? "";
  const [fields, setFields] = useState<SignupFields>({ email: initialEmail, handle: "", displayName: "", birthdate: "" });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [consentError, setConsentError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<EmailChallenge | null>(null);
  const [code, setCode] = useState("");
  const emailRef = useRef<TextInput>(null);
  const handleRef = useRef<TextInput>(null);
  const displayNameRef = useRef<TextInput>(null);
  const birthdateRef = useRef<TextInput>(null);
  const codeRef = useRef<TextInput>(null);
  useAnnounce(consentError);

  const set = (key: keyof SignupFields) => (value: string) => {
    setFields((current) => ({ ...current, [key]: key === "handle" ? value.toLowerCase() : key === "birthdate" ? formatBirthdateInput(value) : value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
    if ((key === "email" || key === "birthdate") && challenge) {
      setChallenge(null);
      setCode("");
    }
  };

  const requestCode = useMutation({
    mutationFn: (birthdate: string) => startSignupEmail(fields.email.trim(), fields.displayName.trim(), fields.handle.trim(), birthdate),
    onSuccess: (next) => {
      setChallenge(next);
      setCode("");
      haptics.success();
      requestAnimationFrame(() => codeRef.current?.focus());
    },
    onError: () => haptics.warning(),
  });

  const signup = useMutation({
    mutationFn: () =>
      completeSignup({
        challengeId: challenge!.challengeId,
        code,
        handle: fields.handle.trim().toLowerCase(),
        displayName: fields.displayName.trim(),
        acceptTerms: true,
      }),
    onSuccess: (res) => signIn(res),
    onError: () => haptics.warning(),
  });

  const validate = (): string | null => {
    const nextErrors = validateSignup(fields);
    const nextConsentError = !terms ? "Agree to the Terms and Privacy policy to continue." : null;
    setErrors(nextErrors);
    setConsentError(nextConsentError);
    if (nextErrors.email) emailRef.current?.focus();
    else if (nextErrors.handle) handleRef.current?.focus();
    else if (nextErrors.displayName) displayNameRef.current?.focus();
    else if (nextErrors.birthdate) birthdateRef.current?.focus();
    if (Object.keys(nextErrors).length || nextConsentError) {
      haptics.warning();
      return null;
    }
    const age = checkBirthdate(fields.birthdate);
    return age.ok ? age.apiDate : null;
  };

  const submit = () => {
    if (requestCode.isPending || signup.isPending) return;
    const birthdate = validate();
    if (!birthdate) return;
    if (!challenge) {
      requestCode.mutate(birthdate);
      return;
    }
    if (code.length !== 6) {
      codeRef.current?.focus();
      haptics.warning();
      return;
    }
    signup.mutate();
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.topbar, { paddingTop: insets.top, height: insets.top + 44 }]}>
        <Pressable onPress={() => router.back()} style={styles.hitTarget} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevron.left" color="textPrimary" size={22} />
        </Pressable>
        <Pressable onPress={() => router.replace("/sign-in")} style={styles.signInLink} accessibilityRole="button">
          <NativeText style={styles.navLabel}>SIGN IN</NativeText>
        </Pressable>
      </View>

      <View style={styles.heading}>
        <NativeText style={styles.title}>Your passport</NativeText>
        <Text variant="callout" color="textSecondary">For people 13 and over. Only you can see it.</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <FieldGroup>
          <Field ref={emailRef} label="Email" placeholder="name@example.com" value={fields.email} onChangeText={set("email")} error={errors.email} editable={!challenge} autoCapitalize="none" autoComplete="email" textContentType="emailAddress" keyboardType="email-address" returnKeyType="next" onSubmitEditing={() => handleRef.current?.focus()} />
          <Field ref={handleRef} label="Handle" placeholder="lowercase_name" value={fields.handle} onChangeText={set("handle")} error={errors.handle} maxLength={HANDLE_MAX} autoCapitalize="none" autoCorrect={false} textContentType="none" autoComplete="off" returnKeyType="next" onSubmitEditing={() => displayNameRef.current?.focus()} />
          <Field ref={displayNameRef} label="Name" placeholder="Your name" value={fields.displayName} onChangeText={set("displayName")} error={errors.displayName} autoComplete="name" textContentType="name" returnKeyType="next" onSubmitEditing={() => birthdateRef.current?.focus()} />
          <Field ref={birthdateRef} label="Birthdate" placeholder="MM/DD/YYYY" value={fields.birthdate} onChangeText={set("birthdate")} error={errors.birthdate} editable={!challenge} keyboardType="number-pad" autoComplete="birthdate-full" textContentType="none" maxLength={10} returnKeyType={challenge ? "next" : "done"} testID="signup-birthdate" />
          {challenge ? (
            <Field
              ref={codeRef}
              label="Verification code"
              placeholder="000000"
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          ) : null}
        </FieldGroup>

        {challenge ? <Text variant="footnote" color="textSecondary">We sent a six-digit code to {fields.email.trim()}.</Text> : null}

        <Checkbox checked={terms} onChange={(checked) => { setTerms(checked); if (checked) setConsentError(null); }} invalid={!!consentError && !terms} accessibilityLabel="I agree to the Terms and Privacy policy">
          <Text variant="callout">I agree to the Terms and Privacy policy.</Text>
        </Checkbox>
        {consentError ? <InlineError message={consentError} /> : null}

        <View style={styles.legalLinks}>
          <Button title="Terms" variant="plain" onPress={() => openWebPage(LEGAL.terms)} accessibilityRole="link" />
          <Button title="Privacy policy" variant="plain" onPress={() => openWebPage(LEGAL.privacy)} accessibilityRole="link" />
        </View>

        <View style={styles.notes}>
          <Text variant="footnote" color="textSecondary">13+ · Birthdate checked once, not kept.</Text>
          <Text variant="footnote" color="textSecondary">No tolerance for abusive content or users.</Text>
        </View>
        {requestCode.error ? <InlineError message={errorText(requestCode.error, "Couldn't send your verification code. Try again.")} /> : null}
        {signup.error ? <InlineError message={errorText(signup.error, "Couldn't create your account. Check the details and try again.")} /> : null}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          title={challenge ? "Create account" : "Verify email"}
          onPress={submit}
          loading={requestCode.isPending || signup.isPending}
          disabled={challenge ? code.length !== 6 : false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topbar: { paddingHorizontal: screenPadding, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  hitTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -11 },
  signInLink: { width: 64, height: 44, alignItems: "center", justifyContent: "center" },
  navLabel: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.35 },
  heading: { paddingHorizontal: screenPadding, gap: 4, paddingTop: 16, paddingBottom: 18 },
  title: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 50, lineHeight: 52, letterSpacing: -0.7 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenPadding, paddingBottom: 24, gap: 10 },
  legalLinks: { flexDirection: "row" },
  notes: { gap: 1 },
  actions: { paddingHorizontal: screenPadding, paddingTop: 8, backgroundColor: colors.background },
});
