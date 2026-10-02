/* DRAFT: have a lawyer review before launch */
import type { Metadata } from "next";
import { LegalPage, POLICY_UPDATED, SUPPORT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Support · Nostos" };

export default function SupportPage() {
  return (
    <LegalPage title="Support" updated={POLICY_UPDATED}>
      <p>
        Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and include your handle. We reply within two business days.
      </p>

      <h2>Report a stamp or a person</h2>
      <p>
        In the app, open the stamp&apos;s menu and choose Report, or open a passport and choose Block or Report. Moderators review
        reports and act on valid ones within 24 hours. For anything urgent or dangerous, contact local emergency services first.
      </p>

      <h2>&quot;You need to be within 100 m of this place&quot;</h2>
      <p>
        Stamps must be made from inside the place&apos;s geofence. Make sure Location is set to &quot;While Using the App&quot; for
        Nostos in iPhone Settings, and step outside if GPS is weak.
      </p>

      <h2>&quot;You already stamped this place&quot;</h2>
      <p>You can stamp a place once every 15 minutes, and up to 20 stamps an hour.</p>

      <h2>Delete your account</h2>
      <p>
        In the app, go to Passport, Settings, Delete account. On the web, go to <a href="/delete-account">/delete-account</a>.
      </p>
    </LegalPage>
  );
}
