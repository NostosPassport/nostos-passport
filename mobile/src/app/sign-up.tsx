import { useMutation } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, errorText } from "@/api";
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
import { MIN_PASSWORD, validateSignup, type SignupErrors, type SignupFields } from "@/lib/validation";
import { colors, fonts, screenPadding, space } from "@/theme";

export default function SignUp() {
  const { signIn } = useAuth();
  const insets = useSafeAreaInsets();
  const [fields, setFields] = useState<SignupFields>({ email: "", password: "", handle: "", displayName: "", birthdate: "" });
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<SignupErrors>({});
  const [consentError, setConsentError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const handleRef = useRef<TextInput>(null);
  const displayNameRef = useRef<TextInput>(null);
  const birthdateRef = useRef<TextInput>(null);
  useAnnounce(consentError);

  const set = (key: keyof SignupFields) => (value: string) => {
    setFields((current) => ({ ...current, [key]: key === "handle" ? value.toLowerCase() : key === "birthdate" ? formatBirthdateInput(value) : value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const signup = useMutation({
    mutationFn: () =>
      api.auth.signup({
        email: fields.email.trim(),
        password: fields.password,
        handle: fields.handle.trim().toLowerCase(),
        displayName: fields.displayName.trim(),
        acceptTerms: true,
        birthdate: checkBirthdate(fields.birthdate).ok ? (checkBirthdate(fields.birthdate) as { apiDate: string }).apiDate : "",
      }),
    onSuccess: (res) => signIn(res),
    onError: () => haptics.warning(),
  });

  const submit = () => {
    if (signup.isPending) return;
    const nextErrors = validateSignup(fields);
    setErrors(nextErrors);
    const nextConsentError = !terms ? "Agree to the Terms and Privacy policy to continue." : null;
    setConsentError(nextConsentError);
    if (nextErrors.email) emailRef.current?.focus();
    else if (nextErrors.password) passwordRef.current?.focus();
    else if (nextErrors.handle) handleRef.current?.focus();
    else if (nextErrors.displayName) displayNameRef.current?.focus();
    else if (nextErrors.birthdate) birthdateRef.current?.focus();
    if (Object.keys(nextErrors).length || nextConsentError) {
      haptics.warning();
      return;
    }
    signup.mutate();
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.topbar, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} style={styles.hitTarget} accessibilityRole="button" accessibilityLabel="Back">
          <Icon name="chevron.left" color="textPrimary" size={22} />
        </Pressable>
        <Pressable onPress={() => router.replace("/sign-in")} style={styles.signInLink} accessibilityRole="button">
          <NativeText style={styles.navLabel}>SIGN IN</NativeText>
        </Pressable>
      </View>

      <View style={styles.heading}>
        <NativeText style={styles.title}>Your passport</NativeText>
        <Text variant="callout" color="textSecondary">For adults 21 and over. Only you can see it.</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <FieldGroup errors={[errors.email, errors.password, errors.handle, errors.displayName, errors.birthdate]}>
          <Field ref={emailRef} label="Email" placeholder="name@example.com" value={fields.email} onChangeText={set("email")} invalid={!!errors.email} autoCapitalize="none" autoComplete="email" textContentType="username" keyboardType="email-address" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} />
          <Field ref={passwordRef} label="Password" placeholder={`At least ${MIN_PASSWORD} characters`} value={fields.password} onChangeText={set("password")} invalid={!!errors.password} secureTextEntry autoComplete="new-password" textContentType="newPassword" returnKeyType="next" onSubmitEditing={() => handleRef.current?.focus()} />
          <Field ref={handleRef} label="Handle" placeholder="lowercase_name" value={fields.handle} onChangeText={set("handle")} invalid={!!errors.handle} autoCapitalize="none" autoCorrect={false} textContentType="none" autoComplete="off" returnKeyType="next" onSubmitEditing={() => displayNameRef.current?.focus()} />
          <Field ref={displayNameRef} label="Name" placeholder="Your name" value={fields.displayName} onChangeText={set("displayName")} invalid={!!errors.displayName} autoComplete="name" textContentType="name" returnKeyType="next" onSubmitEditing={() => birthdateRef.current?.focus()} />
          <Field ref={birthdateRef} label="Birthdate" placeholder="MM/DD/YYYY" value={fields.birthdate} onChangeText={set("birthdate")} invalid={!!errors.birthdate} keyboardType="number-pad" autoComplete="birthdate-full" textContentType="none" maxLength={10} returnKeyType="done" testID="signup-birthdate" />
        </FieldGroup>

        <Checkbox checked={terms} onChange={setTerms} invalid={!!consentError && !terms} accessibilityLabel="I agree to the Terms and Privacy policy">
          <Text variant="callout">I agree to the Terms and Privacy policy.</Text>
        </Checkbox>

        <View style={styles.legalLinks}>
          <Button title="Terms" variant="plain" onPress={() => openWebPage(LEGAL.terms)} accessibilityRole="link" />
          <Button title="Privacy policy" variant="plain" onPress={() => openWebPage(LEGAL.privacy)} accessibilityRole="link" />
        </View>

        <View style={styles.notes}>
          <Text variant="footnote" color="textSecondary">21+ · Birthdate checked once, not kept.</Text>
          <Text variant="footnote" color="textSecondary">No tolerance for abusive content or users.</Text>
        </View>
        {consentError ? <InlineError message={consentError} /> : null}
        {signup.error ? <InlineError message={errorText(signup.error, "Couldn't create your account. Check the details and try again.")} /> : null}
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button title="Create account" onPress={submit} loading={signup.isPending} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topbar: { minHeight: 92, paddingHorizontal: screenPadding, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingBottom: 4 },
  hitTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -11 },
  signInLink: { width: 64, height: 44, alignItems: "center", justifyContent: "center" },
  navLabel: { color: colors.textPrimary, fontFamily: fonts.monoBold, fontSize: 11, letterSpacing: 1.35 },
  heading: { paddingHorizontal: screenPadding, gap: 4, paddingTop: 10, paddingBottom: 18 },
  title: { color: colors.textPrimary, fontFamily: fonts.serifRegular, fontSize: 50, lineHeight: 52, letterSpacing: -0.7 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenPadding, paddingBottom: 24, gap: 10 },
  legalLinks: { flexDirection: "row" },
  notes: { gap: 1 },
  actions: { paddingHorizontal: screenPadding, paddingTop: 8, backgroundColor: colors.background },
});
