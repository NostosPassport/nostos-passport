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

      <h2>Report a post or a person</h2>
      <p>
        In the app, open the post&apos;s menu and choose Report, or open a profile and choose Block or Report. Moderators review reports
        and act on valid ones within 24 hours. For anything urgent or dangerous, contact local emergency services first.
      </p>

      <h2>&quot;You&apos;re too far away to post&quot;</h2>
      <p>
        Reports and photos must come from within 100 meters of the venue. Make sure Location is set to &quot;While Using the App&quot; for
        Nostos in iPhone Settings, and step outside if GPS is weak.
      </p>

      <h2>&quot;You already posted this here&quot;</h2>
      <p>You can post one update of each kind (vibe, line, cover, photo) per venue every 15 minutes.</p>

      <h2>I run a venue</h2>
      <p>Sign in on the web, open My venues, and request to manage your venue. We verify every claim before approving it.</p>

      <h2>Delete your account</h2>
      <p>
        In the app, go to Profile, Settings, Delete account. On the web, go to <a href="/delete-account">/delete-account</a>.
      </p>
    </LegalPage>
  );
}
