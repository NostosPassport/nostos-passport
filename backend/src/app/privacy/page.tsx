/* DRAFT: have a lawyer review before launch */
import type { Metadata } from "next";
import { LegalPage, POLICY_UPDATED, SUPPORT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · Nostos" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={POLICY_UPDATED}>
      <p>
        Nostos is a private passport for New York. You can save visits as stamps with a photo, caption, song, or any mix. Your
        passport is for you: the current version of Nostos does not have public passports, social profiles, or a feed. This policy
        explains what we collect, why we collect it, and the choices you have.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account details:</b> your email address, handle, display name, bio, an optional profile photo, and a salted password hash (never the password itself). We also record when you accepted our Terms.</li>
        <li><b>Your birthdate, once:</b> Nostos is for people 21 and older. When you sign up, the app and our server check your birthdate and then discard it. We do not keep your birthdate, and if you do not pass the age check we do not create an account.</li>
        <li><b>Location, only when you use it:</b> when you look for nearby places or create a stamp, the app sends your current coordinates so we can find places around you and verify that you are within the place&apos;s geofence. We keep the coordinates associated with a created stamp so we can audit the location check. We do not track your location in the background.</li>
        <li><b>Your passport content:</b> stamps you create, including photos, captions, and song metadata. Uploaded photos are re-encoded and embedded metadata, including camera GPS metadata, is removed. For a song we keep its title, artist, and album-art link from Apple&apos;s public iTunes Search API; Nostos does not play music.</li>
        <li><b>Security data:</b> session tokens, stored only in hashed form, and, when a sign-in fails, the email address and IP address used. Failed sign-in records are kept for up to 24 hours to help prevent password guessing.</li>
      </ul>
      <p>We do not collect your contacts, advertising identifiers, or payment information, and we do not use third-party advertising trackers.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To run Nostos: create and display your passport, show the map and nearby places, save your stamps, and verify that a stamp is made at the place.</li>
        <li>To manage your account: authenticate you, keep your account secure, process profile or email changes, and record acceptance of our <a href="/terms">Terms</a>.</li>
        <li>To protect the service: detect abuse, enforce our Terms, investigate technical or security issues, and perform moderation when necessary.</li>
      </ul>
      <p>We do not sell your personal information and we do not share it for advertising. Nostos currently has no social feed and does not share your passport with other users.</p>

      <h2>Who can see what</h2>
      <ul>
        <li><b>You:</b> your passport, stamps, places, and account information are available to you while you are signed in.</li>
        <li><b>Other users:</b> the current version of Nostos does not let other users browse your passport or stamps.</li>
        <li><b>Authorized staff and service providers:</b> they may access or process information only when needed to operate, secure, support, or moderate the service, or to comply with law.</li>
        <li><b>Your email and exact stamp coordinates:</b> these are not displayed to other users.</li>
      </ul>

      <h2>Service providers</h2>
      <p>
        We use a small number of providers to host and operate the service: Vercel (application hosting), Neon (database), and
        Cloudflare R2 (photo storage). They process data on our behalf. Song searches are sent through our server to Apple&apos;s iTunes
        Search API using the words you search for. The iPhone app uses Apple Maps.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account data is kept while your account is active, unless a longer period is required for security, legal, or operational reasons.</li>
        <li>Stamps remain in your passport until you remove them or delete your account. When a stamp is removed, it is hidden from your passport; limited records may be retained for service integrity and moderation history.</li>
        <li>Failed sign-in records are kept for up to 24 hours.</li>
      </ul>

      <h2>Deleting your account</h2>
      <p>
        You can delete your account at any time in the app (Passport, Settings, Delete account) or on the web at{" "}
        <a href="/delete-account">/delete-account</a>. When you delete your account, we remove your email, display name, bio, profile
        photo, and password; replace your handle with a randomized deleted-account identifier; revoke your sessions; hide your stamps;
        and delete their stored image files. Limited anonymized records may remain where needed for moderation, security, or service integrity.
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can deny location access (you can still use parts of the app, but you cannot create a location-verified stamp), edit your
        profile and account email, remove stamps, and delete your account. Depending on where you live, you may also have rights to
        access, correct, or delete personal information. Email us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will respond within 30 days.
      </p>

      <h2>Age</h2>
      <p>Nostos is for people 21 and older. We do not knowingly create accounts for anyone younger than 21.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a meaningful way, we may ask you to review the updated policy the next time you use Nostos.</p>

      <h2>Contact</h2>
      <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
    </LegalPage>
  );
}
