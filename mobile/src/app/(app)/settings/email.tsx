import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";

import { errorText } from "@/api";
import { completeAccountEmailChange, startAccountEmailChange, type EmailChallenge } from "@/api/email-auth";
import { qk } from "@/api/keys";
import { useMe } from "@/api/queries";
import { FormScreen } from "@/components/ui/form-screen";
import { HeaderButton } from "@/components/ui/header-button";
import { InlineError } from "@/components/ui/inline-error";
import { Text } from "@/components/ui/text";
import { Field, FieldGroup } from "@/components/ui/text-field";
import { toast } from "@/components/ui/toast";
import { haptics } from "@/lib/haptics";
import { isEmail } from "@/lib/validation";

export default function ChangeEmail() {
  const me = useMe();
  const queryClient = useQueryClient();
  const [emailDraft, setEmailDraft] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<EmailChallenge | null>(null);
  const [code, setCode] = useState("");
  const email = emailDraft ?? me.data?.user.email ?? "";

  const requestCode = useMutation({
    mutationFn: () => startAccountEmailChange(email),
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
      router.back();
    },
    onError: () => haptics.warning(),
  });

  const submit = () => {
    if (!isEmail(email)) {
      setProblem("Enter a valid email address.");
      haptics.warning();
      return;
    }
    setProblem(null);
    if (!challenge) {
      requestCode.mutate();
      return;
    }
    if (code.length !== 6) {
      setProblem("Enter the six-digit code from your email.");
      haptics.warning();
      return;
    }
    save.mutate();
  };

  const unchanged = email.trim().toLowerCase() === (me.data?.user.email ?? "").toLowerCase();
  const busy = requestCode.isPending || save.isPending;

  return (
    <FormScreen>
      <Stack.Screen
        options={{
          title: "Email",
          headerLeft: () => <HeaderButton label="Cancel" onPress={() => router.back()} />,
          headerRight: () => <HeaderButton label={challenge ? "Save" : "Verify"} bold onPress={submit} disabled={unchanged || busy || (challenge ? code.length !== 6 : false)} />,
        }}
      />
      <Text variant="callout" color="textSecondary">Change the email you use to sign in. We’ll send a verification code to the new address before changing it.</Text>
      <FieldGroup errors={[problem]}>
        <Field
          label="New email"
          value={email}
          editable={!challenge}
          onChangeText={(value) => {
            setEmailDraft(value);
            setProblem(null);
            setChallenge(null);
            setCode("");
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType={challenge ? "next" : "done"}
          onSubmitEditing={challenge ? undefined : submit}
        />
        {challenge ? (
          <Field
            label="Verification code"
            placeholder="000000"
            value={code}
            onChangeText={(value) => {
              setCode(value.replace(/\D/g, "").slice(0, 6));
              setProblem(null);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        ) : null}
      </FieldGroup>
      {challenge ? <Text variant="footnote" color="textSecondary">We sent a six-digit code to {email.trim()}.</Text> : null}
      {requestCode.error ? <InlineError message={errorText(requestCode.error, "Couldn't send a verification code. Try again.")} /> : null}
      {save.error ? <InlineError message={errorText(save.error, "Couldn't change your email. Try again.")} /> : null}
    </FormScreen>
  );
}
