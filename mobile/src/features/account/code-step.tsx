import { forwardRef, useEffect, useState } from "react";
import { StyleSheet, View, type TextInputInstance } from "react-native";

import { Tappable } from "@/components/ui/tappable";
import { Text } from "@/components/ui/text";
import { Field } from "@/components/ui/text-field";
import { useAnnounce } from "@/lib/a11y";
import { fonts, size, space, tabular } from "@/theme";

/** Never let "Send another code" be tapped again sooner than this, whatever the server suggests. */
export const MIN_RESEND_SECONDS = 10;

export const CODE_LENGTH = 6;

/** Keeps only digits, capped at the code length (paste and one-time-code autofill can bring extra characters). */
export function cleanCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

/** Seconds left before another code may be requested. Restarts whenever a new challenge arrives. */
export function useResendCooldown(challengeId: string, resendAfterSeconds: number): number {
  const seconds = Math.max(Math.ceil(resendAfterSeconds), MIN_RESEND_SECONDS);
  const [cycle, setCycle] = useState({ id: challengeId, remaining: seconds });
  // A new challenge restarts the countdown (state adjusted during render, not in an effect).
  if (cycle.id !== challengeId) setCycle({ id: challengeId, remaining: seconds });
  const done = cycle.remaining === 0;
  useEffect(() => {
    if (done) return;
    const timer = setInterval(() => setCycle((c) => (c.remaining > 0 ? { ...c, remaining: c.remaining - 1 } : c)), 1000);
    return () => clearInterval(timer);
  }, [cycle.id, done]);
  return cycle.id === challengeId ? cycle.remaining : seconds;
}

type Props = {
  /** The current challenge. A new id means a new code was sent: the cooldown restarts and "New code sent" shows. */
  challengeId: string;
  resendAfterSeconds: number;
  code: string;
  onChangeCode: (code: string) => void;
  /** Where the code went, e.g. "sam@example.com" or "the email on your account". */
  sentTo: string;
  onResend: () => void;
  resending?: boolean;
  /** Lets the user go back and fix the address. Omitted when the address can't change (delete account). */
  onChangeAddress?: () => void;
  changeAddressLabel?: string;
  /** Marks the field (a wrong or expired code). */
  invalid?: boolean;
  error?: string | null;
  onSubmitEditing?: () => void;
  testID?: string;
};

/**
 * The verification-code step shared by sign-in, email change and account deletion (RC-10): the field takes focus as
 * soon as it appears (so iOS offers the code from Mail), "Send another code" has a short cooldown and confirms with
 * "New code sent", and the address can be changed without starting over.
 */
export const CodeStep = forwardRef<TextInputInstance, Props>(function CodeStep(
  { challengeId, resendAfterSeconds, code, onChangeCode, sentTo, onResend, resending, onChangeAddress, changeAddressLabel = "Use a different email", invalid, error, onSubmitEditing, testID },
  ref,
) {
  const remaining = useResendCooldown(challengeId, resendAfterSeconds);
  const [firstChallenge] = useState(challengeId);
  const resent = challengeId !== firstChallenge;
  const note = resent ? `New code sent to ${sentTo}.` : `We sent a six-digit code to ${sentTo}.`;
  useAnnounce(resent ? note : null);
  const canResend = remaining === 0 && !resending;
  const resendLabel = resending ? "Sending…" : remaining > 0 ? `Send another code in ${remaining}s` : "Send another code";

  return (
    <View style={styles.wrap}>
      <Field
        ref={ref}
        label="Verification code"
        placeholder="000000"
        value={code}
        onChangeText={(value) => onChangeCode(cleanCode(value))}
        invalid={invalid}
        error={error}
        autoFocus
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        returnKeyType="done"
        onSubmitEditing={onSubmitEditing}
        testID={testID}
        style={styles.codeInput}
      />
      <Text variant="footnote" color="textSecondary">{note}</Text>
      <View style={styles.actions}>
        <Tappable
          onPress={onResend}
          disabled={!canResend}
          accessibilityRole="button"
          accessibilityLabel="Send another code"
          accessibilityHint={remaining > 0 ? `Available in ${remaining} seconds` : undefined}
          accessibilityState={{ disabled: !canResend, busy: !!resending }}
          style={styles.action}
        >
          <Text variant="footnote" color={canResend ? "accent" : "textTertiary"} tabular>{resendLabel}</Text>
        </Tappable>
        {onChangeAddress ? (
          <Tappable onPress={onChangeAddress} accessibilityRole="button" accessibilityLabel={changeAddressLabel} style={styles.action}>
            <Text variant="footnote" color="accent">{changeAddressLabel}</Text>
          </Tappable>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  // The code reads as a code: typewriter digits, evenly spaced (placeholder included). No lineHeight, so the caret sits right.
  codeInput: { fontFamily: fonts.mono, letterSpacing: space.xxs, ...tabular },
  actions: { flexDirection: "row", flexWrap: "wrap", columnGap: space.lg },
  action: { minHeight: size.hitTarget, justifyContent: "center" },
});
