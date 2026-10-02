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

      <h2>2. What Nostos is</h2>
      <p>
        Nostos is a passport for New York. You stamp a place you are at with a photo, a caption, a song, or any mix. Stamps are
        shown to the people your account&apos;s privacy setting allows. We don&apos;t guarantee that any stamp is accurate, and nothing
        here is advice about safety, entry, or prices.
      </p>

      <h2>3. Your stamps</h2>
      <ul>
        <li>Stamp only places you are really at. A stamp must be made from within the place&apos;s geofence, and we check this on our server.</li>
        <li>You keep ownership of your photos and captions. You give Nostos a worldwide, royalty-free license to host, display, and distribute them within the service to the people you allow to see them, including after you remove them from your profile or delete your account (hidden, not shown to anyone but moderators).</li>
        <li>Don&apos;t post photos that identify other people in a way they would reasonably object to.</li>
      </ul>

      <h2>4. Zero tolerance for objectionable content and abusive users</h2>
      <p>We have zero tolerance for objectionable content or abusive behavior. You may not post or send anything that:</p>
      <ul>
        <li>is hateful or harassing, or attacks people for their race, ethnicity, religion, gender, sexual orientation, disability, or any other protected characteristic;</li>
        <li>is sexually explicit, or sexualizes anyone;</li>
        <li>threatens, bullies, stalks, doxxes, or impersonates anyone;</li>
        <li>is spam, a scam, or deliberately false (for example a stamp for a place you are not at);</li>
        <li>is illegal or promotes illegal activity.</li>
      </ul>
      <p>
        We filter objectionable language automatically. Anyone can report a stamp or an account, or block another user. Moderators
        review reports and act on valid ones within 24 hours by removing the content and, where warranted, removing the user who
        posted it. We may suspend or remove any account that breaks these rules, without notice.
      </p>

      <h2>5. Fair use</h2>
      <p>Don&apos;t scrape, overload, or reverse engineer the service, get around rate limits or location checks, or use it to build a competing dataset.</p>

      <h2>6. Map data and music info</h2>
      <p>Place names and locations include data © OpenStreetMap contributors, available under the Open Database License. Song titles, artists and album art come from Apple&apos;s iTunes Search API and belong to their owners.</p>

      <h2>7. Ending your use</h2>
      <p>You can stop using Nostos and delete your account at any time. We may suspend or end access for anyone who breaks these terms.</p>

      <h2>8. Disclaimers and liability</h2>
      <p>
        The service is provided &quot;as is&quot;. To the fullest extent allowed by law, Nostos is not liable for indirect or
        consequential damages, or for decisions you make based on content in the app.
      </p>

      <h2>9. Changes</h2>
      <p>We may update these terms. If a change is material, we will ask you to accept the new version before you keep using the app.</p>

      <h2>10. Contact</h2>
      <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
    </LegalPage>
  );
}
