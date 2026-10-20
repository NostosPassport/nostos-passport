/* DRAFT: have a lawyer review before launch */
import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, POLICY_UPDATED, SUPPORT_EMAIL } from "@/components/legal/LegalPage";
import { DeleteAccountForm } from "@/components/legal/DeleteAccountForm";
import { getCurrentActor } from "@/server/current";

export const metadata: Metadata = { title: "Delete your account · Nostos" };
export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  const actor = await getCurrentActor();
  return (
    <LegalPage title="Delete your account" updated={POLICY_UPDATED}>
      <p>
        In the iPhone app, open <b>Passport</b>, tap <b>Settings</b>, then tap <b>Delete account</b>. We&apos;ll send a six-digit confirmation code to the email on your account before anything is deleted. You can also delete your account here.
      </p>

      <h2>What happens</h2>
      <ul>
        <li>Your email and handle are replaced, your display name is reset, and your bio and profile photo are removed.</li>
        <li>Your stamps are permanently removed and their stored image files are deleted.</li>
        <li>Your saved passport data, including pins and collection access, is removed.</li>
        <li>You are signed out on every device.</li>
        <li>This can&apos;t be undone.</li>
      </ul>

      <h2>Delete now</h2>
      {actor ? (
        <DeleteAccountForm handle={actor.handle} />
      ) : (
        <p>
          <Link href="/login?next=/delete-account">Sign in</Link> to delete your account here. If you can&apos;t access your account, email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the address on your account for help.
        </p>
      )}
    </LegalPage>
  );
}
