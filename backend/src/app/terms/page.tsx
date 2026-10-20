import type { Metadata } from "next";
import { LegalPage, POLICY_UPDATED, SUPPORT_EMAIL } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Use · Nostos" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated={POLICY_UPDATED}>
      <p>
        These Terms of Use govern your access to and use of Nostos. By creating an account or using Nostos, you agree to these Terms.
      </p>

      <h2>1. Eligibility and your account</h2>
      <p>
        You must be at least 13 years old to use Nostos. You are responsible for the accuracy of information you provide, maintaining
        control of your email account and devices, and activity performed through your account. You may not impersonate another person
        or create an account for deceptive or unlawful purposes.
      </p>

      <h2>2. What Nostos provides</h2>
      <p>
        Nostos is a personal passport for the places you go. It lets you save visits to places as stamps containing photos, a caption,
        rating, song metadata, or a combination of those items. Nostos may also provide maps, nearby-place results, collections,
        and other tools related to your passport. Place, map, and venue information may be incomplete, outdated, or inaccurate and
        should not be treated as advice about safety, access, hours, pricing, or whether a place is suitable for you.
      </p>

      <h2>3. Location and verified stamps</h2>
      <ul>
        <li>Location permission is optional. You can create an unverified stamp without sharing your current location.</li>
        <li>For a current visit, Nostos may use your location and a server-side geofence check to mark the visit verified when your device is sufficiently near the selected place.</li>
        <li>Past stamps are historical memories and are not location verified.</li>
        <li>You may not spoof, falsify, manipulate, or bypass location checks, rate limits, or other integrity controls to obtain a verification status or interfere with the service.</li>
      </ul>

      <h2>4. Your content</h2>
      <p>
        You retain ownership of content you create and upload to Nostos. You grant Nostos a worldwide, non-exclusive, royalty-free
        license to host, store, process, reproduce, modify as technically necessary, and display that content solely as needed to
        operate, secure, support, improve, or maintain the service and to provide your passport back to you.
      </p>
      <p>
        You are responsible for your content and must have the rights necessary to upload it. Do not upload content that infringes
        another person&apos;s intellectual-property, privacy, publicity, or other rights.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You may not use Nostos to:</p>
      <ul>
        <li>break the law or encourage unlawful activity;</li>
        <li>harass, threaten, stalk, exploit, or abuse another person;</li>
        <li>upload hateful, sexually exploitative, or otherwise unlawful content;</li>
        <li>expose another person&apos;s private information without authorization;</li>
        <li>send spam, scams, malware, or fraudulent content;</li>
        <li>scrape, overload, disrupt, reverse engineer, or interfere with the service except where applicable law expressly permits it;</li>
        <li>probe for vulnerabilities, bypass security controls, or access data you are not authorized to access;</li>
        <li>use Nostos or its data to build or populate a competing place, passport, or location-history dataset without permission.</li>
      </ul>

      <h2>6. Enforcement</h2>
      <p>
        We may investigate suspected abuse, security issues, or violations of these Terms. We may restrict features, remove or hide
        content, suspend access, or terminate an account when reasonably necessary to protect users or the service, enforce these Terms,
        or comply with law.
      </p>

      <h2>7. Third-party services and data</h2>
      <p>
        Nostos relies on third-party services and data. Restaurant, bar, and place information may come from Google Places. Legacy place
        information may include data © OpenStreetMap contributors under the Open Database License. Song titles, artist names, and album
        artwork may come from Apple&apos;s iTunes Search API and remain subject to the rights of their respective owners. The app may use
        Apple Maps. Nostos does not control the availability or accuracy of third-party services.
      </p>

      <h2>8. Changes to the service</h2>
      <p>
        Nostos is an evolving product. We may add, change, limit, suspend, or discontinue features, and we may perform maintenance or
        experience outages. We do not guarantee uninterrupted or error-free availability.
      </p>

      <h2>9. Deleting your account</h2>
      <p>
        You may stop using Nostos and delete your account at any time through the app or the web account-deletion page. We may retain
        limited anonymized, security, or legal records as described in our <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        To the fullest extent permitted by law, Nostos is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind,
        whether express, implied, or statutory. We do not warrant that the service will always be available, secure, accurate, or free
        of errors.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Nostos and its operators will not be liable for indirect, incidental, special,
        consequential, exemplary, or punitive damages, or for losses arising from reliance on maps, venue information, user content,
        service interruptions, or unauthorized access outside our reasonable control. Nothing in these Terms excludes liability that
        cannot legally be excluded or limited.
      </p>

      <h2>12. Changes to these Terms</h2>
      <p>
        We may update these Terms as Nostos changes. If a change is material, we may notify you in the app or require you to review
        and accept the updated Terms before continuing to use certain features.
      </p>

      <h2>13. Contact</h2>
      <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
    </LegalPage>
  );
}