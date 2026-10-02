/* DRAFT: have a lawyer review before launch */
import type { Metadata } from "next";
import { LegalPage, POLICY_UPDATED, SUPPORT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Use · Nostos" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated={POLICY_UPDATED}>
      <p>
        These terms are an agreement between you and Nostos. By creating an account or using the app or website, you agree to them.
      </p>

      <h2>1. Who can use Nostos</h2>
      <p>You must be 21 or older. You are responsible for your account, for keeping your password private, and for everything posted from it.</p>

      <h2>2. What Nostos is, and isn&apos;t</h2>
      <p>
        Nostos shows what people report about venues and what venues say about themselves. Live conditions come from other users
        and can be wrong or out of date. Official details come from venues. We don&apos;t guarantee either, and nothing here is advice
        about safety, entry, or prices. Drink responsibly and never drink and drive.
      </p>

      <h2>3. Your posts</h2>
      <ul>
        <li>Post only what you see yourself, at the venue, right now. Reports and photos must be sent from within 100 meters of the venue.</li>
        <li>You keep ownership of your photos and comments. You give Nostos a worldwide, royalty-free license to host, display, and distribute them within the service, including after you delete your account (shown as &quot;Deleted user&quot;, with photos hidden).</li>
        <li>Don&apos;t post photos that identify other people in a way they would reasonably object to.</li>
      </ul>

      <h2>4. Zero tolerance for objectionable content and abusive users</h2>
      <p>We have zero tolerance for objectionable content or abusive behavior. You may not post or send anything that:</p>
      <ul>
        <li>is hateful or harassing, or attacks people for their race, ethnicity, religion, gender, sexual orientation, disability, or any other protected characteristic;</li>
        <li>is sexually explicit, or sexualizes anyone;</li>
        <li>threatens, bullies, doxxes, or impersonates anyone;</li>
        <li>is spam, a scam, or deliberately false (for example fake reports or reviews, or reports posted for a venue you work for);</li>
        <li>is illegal or promotes illegal activity.</li>
      </ul>
      <p>
        We filter objectionable language automatically. Anyone can flag content or block another user. Moderators review flagged content
        and act on valid reports within 24 hours by removing the content and, where warranted, removing the user who posted it. We may
        suspend or remove any account that breaks these rules, without notice.
      </p>

      <h2>5. Venues</h2>
      <ul>
        <li>Venue accounts are approved by us. They manage official information and can reply to comments.</li>
        <li>Venues can&apos;t edit, hide, or remove what users post, and can&apos;t post live reports about their own venue. They can flag content for our moderators.</li>
        <li>Paid promotions are always labelled &quot;Promoted&quot; and never change how user content is ranked or shown.</li>
        <li>A venue&apos;s accuracy score is calculated from user reports and can&apos;t be edited or hidden by the venue.</li>
      </ul>

      <h2>6. Fair use</h2>
      <p>Don&apos;t scrape, overload, or reverse engineer the service, get around rate limits or location checks, or use it to build a competing dataset.</p>

      <h2>7. Map data</h2>
      <p>Venue names and locations include data © OpenStreetMap contributors, available under the Open Database License.</p>

      <h2>8. Ending your use</h2>
      <p>You can stop using Nostos and delete your account at any time. We may suspend or end access for anyone who breaks these terms.</p>

      <h2>9. Disclaimers and liability</h2>
      <p>
        The service is provided &quot;as is&quot;. To the fullest extent allowed by law, Nostos is not liable for indirect or
        consequential damages, or for decisions you make based on content in the app.
      </p>

      <h2>10. Changes</h2>
      <p>We may update these terms. If a change is material, we will ask you to accept the new version before you keep using the app.</p>

      <h2>11. Contact</h2>
      <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
    </LegalPage>
  );
}
