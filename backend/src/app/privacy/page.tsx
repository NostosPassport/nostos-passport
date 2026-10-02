/* DRAFT: have a lawyer review before launch */
import type { Metadata } from "next";
import { LegalPage, POLICY_UPDATED, SUPPORT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · Nostos" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={POLICY_UPDATED}>
      <p>
        Nostos is a passport for New York. You go to a place, you get a stamp: a photo, a caption, a song, or any mix. This
        policy explains what we collect, why, and what you can do about it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account details:</b> your email address, handle, display name, bio, an optional profile photo, and a salted password hash (never the password itself). We record when you accepted our Terms.</li>
        <li><b>Your birthdate, once:</b> Nostos is for people 21 and older. When you sign up, the app and our server check your birthdate and then discard it. We do not store it, and if you are under 21 we store nothing about you at all. Browsing as a guest asks for a birthdate too; that check happens on your phone and is not sent to us.</li>
        <li><b>Location, only when you use it:</b> when you choose a place to stamp, the app sends your current coordinates so we can list places near you and check that you are within the place&apos;s geofence (100 meters by default). We keep the coordinates with the stamp to audit that check. We never show them to anyone and we never track your location in the background. The list of nearby places is computed for that request and the position you send is not stored by it.</li>
        <li><b>What you post:</b> stamps (a photo, a caption, a song), your likes, and reports you send to moderators. Photos are re-encoded when uploaded, and all embedded metadata, including any GPS location the camera saved, is removed. For a song we keep its title, artist and album art link from Apple&apos;s public iTunes Search API; we do not play music.</li>
        <li><b>Social activity:</b> who you follow, who follows you, follow requests, and who you block.</li>
        <li><b>Security data:</b> session tokens, which we store only in hashed form, and, when a sign-in fails, the email and IP address used. We keep failed sign-ins for up to 24 hours to stop password guessing.</li>
      </ul>
      <p>We don&apos;t collect contacts, advertising identifiers, or payment information, and we don&apos;t use third-party analytics or ad trackers.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To run the service: show your passport and your feed, check that stamps are made at the place, and show people the stamps they are allowed to see.</li>
        <li>To keep it safe: moderators review reports, and we use your data to enforce our <a href="/terms">Terms</a>. Each account has a private moderation score that only you and our moderators can see.</li>
      </ul>
      <p>We never sell your personal information or share it for advertising. Your feed is the people you follow, newest first; we don&apos;t rank it or personalize it.</p>

      <h2>Who can see what</h2>
      <ul>
        <li><b>Accounts are private by default.</b> The stamps and places of a private account are visible only to you, to people whose follow request you approved, and to our moderators. Everyone else sees your handle, a verified badge if you have one, and a Follow button.</li>
        <li><b>Public accounts:</b> if you switch your account to public, anyone, signed in or not, can see all of your stamps and every place you have been, including ones you stamped before. The app asks you to confirm this first.</li>
        <li><b>Nobody:</b> your exact coordinates and your email.</li>
        <li>People you block can&apos;t see your passport, and you can&apos;t see theirs.</li>
      </ul>

      <h2>Service providers</h2>
      <p>
        We use a small number of providers to host the service: Vercel (application hosting), Neon (database), and Cloudflare R2
        (photo storage). They process data only on our behalf. Song search is sent through our server to Apple&apos;s iTunes Search
        API with only your search words. The iPhone app uses Apple Maps.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account data: until you delete your account.</li>
        <li>Stamps: until you remove them from your profile (then they are hidden for good) or delete your account. Hidden stamps are kept by us so moderation history stays accurate.</li>
        <li>Failed sign-in records: up to 24 hours.</li>
      </ul>

      <h2>Deleting your account</h2>
      <p>
        You can delete your account at any time in the app (Passport, Settings, Delete account) or on the web at{" "}
        <a href="/delete-account">/delete-account</a>. When you do, we immediately remove your email, display name, bio, profile photo and
        password; replace your handle with a random one; sign you out everywhere; remove your follows, likes and blocks; and hide your
        stamps and delete their image files. Records of moderation actions and reports you sent are kept, attached to the same
        anonymized account.
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can deny location access (you can still browse; you just can&apos;t stamp), block people, make your passport private or
        public, and delete your account. Depending on where you live you may have rights to access, correct, or delete your data. Email
        us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will respond within 30 days.
      </p>

      <h2>Age</h2>
      <p>Nostos is for people 21 and older. We don&apos;t knowingly collect data from anyone younger, and we store nothing about anyone who fails the age check.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a meaningful way, we will ask you to review and accept it the next time you open the app.</p>

      <h2>Contact</h2>
      <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
    </LegalPage>
  );
}
