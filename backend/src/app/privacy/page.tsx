import type { Metadata } from "next";
import { LegalPage, POLICY_UPDATED, SUPPORT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · Nostos" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={POLICY_UPDATED}>
      <p>
        Nostos is a personal passport for New York that lets you save visits as stamps. This Privacy Policy explains what
        information Nostos collects, how we use it, when it is shared, and the choices available to you.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><b>Account information:</b> your verified email address, handle, display name, bio, optional profile photo, account settings, and records showing when you accepted our Terms.</li>
        <li><b>Age eligibility:</b> when you sign up, you provide your birthdate so Nostos can confirm that you meet the minimum age requirement. The birthdate is checked and is not stored after the eligibility check.</li>
        <li><b>Location when you use location features:</b> when you request nearby places or create a stamp, the app sends your current coordinates so we can find places near you and verify that you are within the place&apos;s geofence. Nostos does not track your location in the background.</li>
        <li><b>Stamp content:</b> places you stamp, photos, captions, ratings, song metadata, photo layout information, and related timestamps. Uploaded photos are re-encoded and embedded metadata such as EXIF and camera GPS metadata is removed.</li>
        <li><b>Authentication and security information:</b> session information, hashed or keyed representations of authentication credentials and email codes, limited IP-address data used for abuse prevention and rate limiting, and technical records needed to keep the service secure and reliable.</li>
        <li><b>Support communications:</b> if you contact us, we receive the information you choose to include in your message.</li>
      </ul>
      <p>We do not collect payment information, advertising identifiers, or your contacts, and we do not use third-party advertising trackers.</p>

      <h2>How we use information</h2>
      <ul>
        <li>To create and operate your account, authenticate you, and deliver sign-in or verification emails.</li>
        <li>To show your passport, nearby places, neighborhood progress, and the stamps you have created.</li>
        <li>To verify that a stamp is created while you are physically near the place.</li>
        <li>To process account changes, support requests, account deletion, and other actions you request.</li>
        <li>To prevent abuse, enforce our Terms, troubleshoot problems, protect the service, and comply with legal obligations.</li>
      </ul>

      <h2>Who can see your information</h2>
      <p>
        In the current personal mode, your passport, stamps, and visited places are available only to you while signed in.
        Your email address and exact location information are not displayed publicly. Authorized personnel and service providers
        may process information when reasonably necessary to operate, secure, support, or maintain Nostos, or when required by law.
      </p>

      <h2>Service providers</h2>
      <p>
        Nostos uses service providers including Vercel for application hosting, Neon for database hosting, Cloudflare R2 for
        private photo storage, and Resend for transactional email delivery. The iPhone app uses Apple Maps. Song searches are
        sent through our backend to Apple&apos;s iTunes Search API using the search terms you enter.
      </p>

      <h2>Location information</h2>
      <p>
        Nearby-place requests use the location you send for that request and do not require background tracking. When you create
        a stamp, Nostos verifies your coordinates against the place&apos;s geofence. Location-related records may be retained when
        needed to verify the integrity of a created stamp, investigate abuse, or protect the service.
      </p>

      <h2>Retention</h2>
      <ul>
        <li>Account information is generally kept while your account is active.</li>
        <li>Stamps and their content remain associated with your account until you remove them or delete your account, subject to limited retention for security, integrity, or legal purposes.</li>
        <li>Short-lived email authentication challenge records are retained only for a limited period and are periodically removed.</li>
        <li>Some security, audit, and anonymized integrity records may be retained after deletion when reasonably necessary to protect the service or comply with law.</li>
      </ul>

      <h2>Account deletion</h2>
      <p>
        You can delete your account in the app or at <a href="/delete-account">/delete-account</a>. Deletion revokes active sessions,
        removes or anonymizes account information, hides your stamps from normal use, and removes stored image files associated with
        your account. Limited anonymized or security records may remain where necessary for service integrity, abuse prevention, or legal obligations.
      </p>

      <h2>Your choices</h2>
      <p>
        You can deny location permission, although location-verified stamping will not work without it. You can edit supported
        account information, remove stamps, and delete your account. Depending on where you live, applicable law may also give you
        rights to request access to, correction of, or deletion of personal information. Contact us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>Children</h2>
      <p>Nostos is intended for people age 13 and older, and we do not knowingly create accounts for children under 13.</p>

      <h2>Security</h2>
      <p>
        We use technical and organizational safeguards designed to protect account and service data. No online service can guarantee
        absolute security, so you should protect access to your email account and devices and contact us if you believe your account has been compromised.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this Privacy Policy as Nostos changes. If an update is material, we may provide notice in the app or require
        you to review the updated policy before continuing to use certain features.
      </p>

      <h2>Contact</h2>
      <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
    </LegalPage>
  );
}
