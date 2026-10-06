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
      <p>You must be 21 or older. You are responsible for your account, for keeping your password private, and for activity performed through your account.</p>

      <h2>2. What Nostos is</h2>
      <p>
        Nostos is a private passport for New York. You can stamp a place you are at with a photo, caption, song, or any mix, and
        build a personal record of where you have been. The current version does not include public passports, a social feed, or
        sharing your stamps with other users. We do not guarantee that place information, map information, or a stamp is error-free,
        and Nostos is not advice about safety, entry, hours, prices, or whether you should visit a place.
      </p>

      <h2>3. Your stamps</h2>
      <ul>
        <li>Only stamp a place when you are actually there. Nostos uses a geofence and checks your location on our server when a stamp is created.</li>
        <li>You keep ownership of the photos and captions you create. You give Nostos a worldwide, royalty-free license to host, process, reproduce, and display that content as needed to operate, secure, support, and moderate the service, including showing your passport back to you.</li>
        <li>Do not upload content you do not have the right to use, or photos that invade another person&apos;s privacy or identify them in a way they would reasonably object to.</li>
      </ul>

      <h2>4. Content and acceptable use</h2>
      <p>Even though your passport is private to your account, content stored in Nostos must not:</p>
      <ul>
        <li>be hateful, harassing, threatening, bullying, stalking, or discriminatory;</li>
        <li>be sexually explicit or sexualize anyone;</li>
        <li>expose another person&apos;s private information without permission;</li>
        <li>be spam, a scam, deliberately fraudulent, or intentionally falsify your location;</li>
        <li>violate law or another person&apos;s intellectual-property or privacy rights.</li>
      </ul>
      <p>
        We may use automated filters and authorized staff review to enforce these rules, investigate abuse or security problems, and
        protect the service. We may hide or remove content, suspend access, or terminate an account that violates these Terms.
      </p>

      <h2>5. Fair use</h2>
      <p>Do not scrape, overload, disrupt, or reverse engineer the service, bypass rate limits or location checks, probe for vulnerabilities without permission, or use Nostos to build a competing dataset.</p>

      <h2>6. Map data and music information</h2>
      <p>Place names and locations include data © OpenStreetMap contributors, available under the Open Database License. Song titles, artists, and album art come from Apple&apos;s iTunes Search API and belong to their respective owners. Nostos does not provide music playback.</p>

      <h2>7. Your account and ending your use</h2>
      <p>
        You can stop using Nostos and delete your account at any time. You may also update your profile and account email in the app.
        We may suspend or end access when necessary to protect the service, comply with law, or enforce these Terms.
      </p>

      <h2>8. Service availability</h2>
      <p>
        Nostos may change, add, remove, or temporarily disable features as the product develops. We may also perform maintenance or
        experience outages. We do not promise that every feature or third-party service will always be available.
      </p>

      <h2>9. Disclaimers and liability</h2>
      <p>
        The service is provided &quot;as is&quot; and &quot;as available&quot;. To the fullest extent allowed by law, Nostos is not liable for indirect
        or consequential damages, or for decisions you make based on content, maps, place information, or other information in the app.
      </p>

      <h2>10. Changes</h2>
      <p>We may update these Terms as Nostos changes. If a change is material, we may ask you to review and accept the updated Terms before continuing to use the app.</p>

      <h2>11. Contact</h2>
      <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
    </LegalPage>
  );
}
