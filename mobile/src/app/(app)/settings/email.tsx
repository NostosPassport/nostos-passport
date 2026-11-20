import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useRef, useState } from "react";
import type { TextInputInstance } from "react-native";

import { errorText } from "@/api";
import { completeAccountEmailChange, startAccountEmailChange, type EmailChallenge } from "@/api/email-auth";
import { qk } from "@/api/keys";
import { useMe } from "@/api/queries";
import { FormScreen } from "@/components/ui/form-screen";
import { HeaderButton, headerTextButtons } from "@/components/ui/header-button";
import { InlineError } from "@/components/ui/inline-error";
import { Text } from "@/components/ui/text";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast";
import { CODE_LENGTH, CodeStep } from "@/features/account/code-step";
import { haptics } from "@/lib/haptics";
import { isEmail } from "@/lib/validation";
import { nav } from "@/lib/nav";

export default function ChangeEmail() {
  const me = useMe();
  const queryClient = useQueryClient();
  const currentEmail = me.data?.user.email ?? "";
  // "New email" starts empty; the current address is shown underneath instead (P-155).
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<EmailChallenge | null>(null);
  const [code, setCode] = useState("");
  const emailRef = useRef<TextInputInstance>(null);
  const newEmail = email.trim();

  const requestCode = useMutation({
    mutationFn: () => startAccountEmailChange(newEmail),
    onSuccess: (next) => {
      setChallenge(next);
      setCode("");
      haptics.success();
    },
    onError: () => haptics.warning(),
  });

  const save = useMutation({
    mutationFn: () => completeAccountEmailChange(challenge!.challengeId, code),
    onSuccess: async () => {
      haptics.success();
      await queryClient.invalidateQueries({ queryKey: qk.me, exact: true });
      toast.show("Email updated", "neutral");
      nav.back();
    },
    onError: () => haptics.warning(),
  });

  const submit = () => {
    if (!isEmail(newEmail)) {
      setProblem("Enter a valid email address.");
      haptics.warning();
      return;
    }
    setProblem(null);
    if (!challenge) {
      requestCode.mutate();
      return;
    }
    if (code.length !== CODE_LENGTH) {
      setProblem("Enter the six-digit code from your email.");
      haptics.warning();
      return;
    }
    save.mutate();
  };

  const resend = () => {
    if (requestCode.isPending) return;
    save.reset();
    setProblem(null);
    requestCode.mutate();
  };

  const changeAddress = () => {
    setChallenge(null);
    setCode("");
    setProblem(null);
    save.reset();
    requestCode.reset();
    requestAnimationFrame(() => emailRef.current?.focus());
  };

  const unchanged = !newEmail || newEmail.toLowerCase() === currentEmail.toLowerCase();
  const busy = requestCode.isPending || save.isPending;

  return (
    <FormScreen>
      <Stack.Screen
        options={{
          title: "Email",
          ...headerTextButtons({ right: <HeaderButton label={challenge ? "Save" : "Verify"} bold onPress={submit} disabled={unchanged || (challenge ? code.length !== CODE_LENGTH : false)} loading={busy} /> }),
        }}
      />
      <Text variant="callout" color="textSecondary">Change the email you use to sign in. We’ll send a verification code to the new address before changing it.</Text>
      <FieldGroup errors={[problem]} footer={currentEmail ? `Currently ${currentEmail}` : undefined}>
        <Field
          ref={emailRef}
          label="New email"
          placeholder="name@example.com"
          value={email}
          editable={!challenge}
          onChangeText={(value) => {
            setEmail(value);
            setProblem(null);
            if (requestCode.error) requestCode.reset();
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          autoCorrect={false}
          spellCheck={false}
          textContentType="emailAddress"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
      </FieldGroup>
      {challenge ? (
        <CodeStep
          challengeId={challenge.challengeId}
          resendAfterSeconds={challenge.resendAfterSeconds}
          code={code}
          onChangeCode={(value) => {
            setCode(value);
            setProblem(null);
            if (save.error) save.reset();
          }}
          sentTo={newEmail}
          onResend={resend}
          resending={requestCode.isPending}
          onChangeAddress={changeAddress}
          invalid={!!save.error}
          onSubmitEditing={submit}
        />
      ) : null}
      {requestCode.error ? <InlineError message={errorText(requestCode.error, "Couldn't send a verification code. Try again.")} /> : null}
      {save.error ? <InlineError message={errorText(save.error, "Couldn't change your email. Try again.")} /> : null}
    </FormScreen>
  );
}
