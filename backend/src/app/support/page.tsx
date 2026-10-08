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

      <h2>Visit verification</h2>
      <p>
        Location is optional. A Now stamp can show as verified when Nostos can confirm that your device is close enough to the selected
        place at the time you stamp it. If location access is off, unavailable, or you are outside the venue&apos;s verification radius,
        you can still create the stamp and it will simply be unverified. Past stamps are always unverified.
      </p>
      <p>
        If a visit you expected to be verified is not, confirm that Location access for Nostos is set to &quot;While Using the App&quot; and
        that Precise Location is available. GPS can be less accurate indoors, underground, or around tall buildings.
      </p>

      <h2>Past stamps and visit dates</h2>
      <p>
        You can add a Past stamp for a visit from the previous year, but not for a future date. You can also edit a stamp&apos;s visit date.
        Changing the calendar day on a verified visit removes its verification because Nostos only verified the original visit day.
      </p>

      <h2>&quot;You already stamped this place&quot;</h2>
      <p>You can create a new stamp at the same place once every 15 minutes, with a maximum of 20 new stamps per hour across places.</p>

      <h2>Photo problems</h2>
      <p>
        You can take photos through Nostos or choose them from your Photo Library, and you can add or remove photos after a stamp is
        created up to the six-photo limit. Nostos verifies visits, not individual photos. Photos taken through Nostos receive a small
        Nostos watermark. Uploaded photos are processed before storage and embedded metadata is removed.
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
