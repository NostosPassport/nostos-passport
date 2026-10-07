import type { Metadata } from "next";
import { LegalPage, POLICY_UPDATED, SUPPORT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Support · Nostos" };

export default function SupportPage() {
  return (
    <LegalPage title="Support" updated={POLICY_UPDATED}>
      <p>
        Need help with Nostos? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. If your question is about your account,
        include your handle and the email address associated with the account so we can help you faster. Do not send passwords or
        one-time sign-in codes.
      </p>

      <h2>Sign-in or verification problems</h2>
      <p>
        Make sure you entered the correct email address and check your spam or junk folder for the Nostos verification email. If a code
        expires, request a new one. If you still cannot sign in, contact us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>Location or stamping problems</h2>
      <p>
        Stamps are location verified. Make sure Location access for Nostos is set to &quot;While Using the App&quot; in iPhone Settings and
        that Precise Location is available when you are trying to stamp. GPS can be less accurate indoors, underground, or around tall buildings.
      </p>

      <h2>&quot;You need to be within 100 m of this place&quot;</h2>
      <p>
        Nostos could not verify that you were inside the place&apos;s geofence. Confirm that the selected place is correct, move closer to
        the venue, and try again once your phone has a reliable location fix.
      </p>

      <h2>&quot;You already stamped this place&quot;</h2>
      <p>You can stamp the same place once every 15 minutes, with a maximum of 20 stamps per hour across places.</p>

      <h2>Photo problems</h2>
      <p>
        Photos are attached when a stamp is created. If camera access is disabled, enable Camera access for Nostos in iPhone Settings
        and try again. Uploaded photos are processed before storage and embedded metadata is removed.
      </p>

      <h2>Privacy, account, or data requests</h2>
      <p>
        For questions about your personal information, account access, privacy, or data deletion, email
        {" "}<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. You can also review our <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Delete your account</h2>
      <p>
        In the app, go to Passport, Settings, Delete account. You can also use the web account-deletion page at
        {" "}<a href="/delete-account">/delete-account</a>.
      </p>

      <h2>Safety</h2>
      <p>
        Nostos support is not an emergency service. If you or someone else is in immediate danger, contact local emergency services.
      </p>
    </LegalPage>
  );
}
