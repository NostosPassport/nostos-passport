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
        In the iPhone app, go to <b>Passport, Settings, Delete account</b> and confirm with your password. You can also do it here.
      </p>

      <h2>What happens</h2>
      <ul>
        <li>Your email, display name, bio, profile photo and password are erased right away, and your handle is replaced.</li>
        <li>You are signed out on every device.</li>
        <li>Your follows, likes and blocks are removed.</li>
        <li>Your stamps are hidden for good and their image files are deleted.</li>
        <li>This can&apos;t be undone.</li>
      </ul>

      <h2>Delete now</h2>
      {actor ? (
        <DeleteAccountForm handle={actor.handle} />
      ) : (
        <p>
          <Link href="/login?next=/delete-account">Sign in</Link> to delete your account here, or email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the address on your account.
        </p>
      )}
    </LegalPage>
  );
}
