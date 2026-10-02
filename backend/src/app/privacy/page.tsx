/* DRAFT: have a lawyer review before launch */
import type { Metadata } from "next";
import { LegalPage, POLICY_UPDATED, SUPPORT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · Nostos" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={POLICY_UPDATED}>
      <p>
        Nostos is a live map of bars and clubs in New York&apos;s East Village and Lower East Side. People post what a
        venue is like right now; venues post their official details. This policy explains exactly what we collect, why,
        and what you can do about it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><b>Account details:</b> your email address, handle, display name, and a salted password hash (never the password itself). We record when you accepted our Terms and that you confirmed you are 21 or older. We do not ask for your date of birth.</li>
        <li><b>Location, only when you use it:</b> when you post a report, post a photo, or open a venue page to be counted as &quot;here now&quot;, the app sends your current coordinates so we can check you are within 100 meters of the venue. We store the coordinates with reports and photos to audit that check. For &quot;here now&quot; we store only which venue you are at and when you were last seen there. It stops counting after 45 minutes and is deleted by a scheduled cleanup shortly after. We never track your location in the background.</li>
        <li><b>What you post:</b> vibe, line, and cover reports; photos and captions; comments; and flags you send to moderators. Photos are re-encoded when uploaded, and all embedded metadata (including any GPS location the camera saved) is removed.</li>
        <li><b>Social activity:</b> venues you mark &quot;going tonight&quot; (these reset every morning at 5am), people you follow, and people you block.</li>
        <li><b>Security data:</b> session tokens, which we store only in hashed form, and, when a sign-in fails, the email and IP address used. We keep failed sign-ins for up to 24 hours to stop password guessing.</li>
      </ul>
      <p>We don&apos;t collect contacts, advertising identifiers, or payment information, and we don&apos;t use third-party analytics or ad trackers.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To run the service: show live conditions, check that reports come from the venue, count who is here and who is going, and show your mutual friends where you are going tonight.</li>
        <li>To keep it honest: each account has a private reputation weight based on how often its reports match what others at the same venue report. It affects how much your reports count. Only you and our moderators can see it.</li>
        <li>To keep it safe: moderators review flagged content, and we use your data to enforce our <a href="/terms">Terms</a>.</li>
      </ul>
      <p>We never sell your personal information or share it for advertising.</p>

      <h2>Who can see what</h2>
      <ul>
        <li><b>Public:</b> your handle and display name, and the photos and comments you post on venue pages. Your reports are combined into each venue&apos;s live status. Individual reports aren&apos;t shown publicly, and venue owners see them without names.</li>
        <li><b>Mutual follows only:</b> which venues you are going to tonight.</li>
        <li><b>Nobody:</b> your exact coordinates, your email, and your individual &quot;here now&quot; check-ins (only counts are shown).</li>
        <li>People you block can&apos;t see your profile, photos, or comments, and you can&apos;t see theirs.</li>
      </ul>

      <h2>Service providers</h2>
      <p>
        We use a small number of providers to host the service: Vercel (application hosting), Neon (database), and
        Cloudflare R2 (photo storage). They process data only on our behalf. On the web, map tiles are loaded from
        OpenStreetMap&apos;s servers, which see your IP address. The iPhone app uses Apple Maps.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Account data: until you delete your account.</li>
        <li>Reports, comments, and photos: kept to preserve each venue&apos;s history (see &quot;Deleting your account&quot;).</li>
        <li>&quot;Here now&quot;: stops counting 45 minutes after your last check-in and is deleted by a scheduled cleanup soon after. &quot;Going tonight&quot;: stops counting at 5am; the record is removed if you delete your account.</li>
        <li>Failed sign-in records: up to 24 hours.</li>
      </ul>

      <h2>Deleting your account</h2>
      <p>
        You can delete your account at any time in the app (Profile, Settings, Delete account) or on the web at{" "}
        <a href="/delete-account">/delete-account</a>. When you do, we immediately remove your email, display name, and password;
        replace your handle with a random one; sign you out everywhere; remove your follows, blocks, RSVPs, and check-ins; hide
        your photos and delete the image files. Your past reports and comments stay so that venue history remains accurate. They
        are shown as &quot;Deleted user&quot; and are attached to an anonymized account with no email, name, or password. Reports keep
        the venue, time, and the coordinates they were sent from, because that history is what venue accuracy is built on. Records
        of moderation actions and flags you sent are kept, attached to the same anonymized account.
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can deny location access (you can still browse; you just can&apos;t post from a venue), block people, and delete your
        account. Depending on where you live you may have rights to access, correct, or delete your data. Email us at{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will respond within 30 days.
      </p>

      <h2>Age</h2>
      <p>Nostos is for people 21 and older. We don&apos;t knowingly collect data from anyone younger.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a meaningful way, we will ask you to review and accept it the next time you open the app.</p>

      <h2>Contact</h2>
      <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
    </LegalPage>
  );
}
