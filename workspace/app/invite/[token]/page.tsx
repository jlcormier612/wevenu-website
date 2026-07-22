import Link from "next/link";
import { notFound } from "next/navigation";

import { AcceptInviteForm } from "@/components/team/accept-invite-form";
import { getInviteByTokenSync } from "@/lib/program4/auth-store";
import { ensureProgram4Data } from "@/lib/program4/store";

export const metadata = { title: "Accept invite" };

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await ensureProgram4Data();
  const { token } = await params;
  const invite = getInviteByTokenSync(token);

  if (!invite) {
    notFound();
  }

  if (invite.status !== "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--warm-gray)] px-6">
        <div className="ws-panel w-full max-w-md p-8 md:p-10">
          <p className="ws-eyebrow">Invite</p>
          <h1 className="mt-3 font-heading text-3xl tracking-tight">
            Invite already used
          </h1>
          <p className="mt-3 text-sm leading-relaxed ws-muted">
            This invite is no longer pending. Sign in if you already created a password.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
          >
            Go to sign in →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--warm-gray)] px-6">
      <div className="ws-panel w-full max-w-md p-8 md:p-10">
        <p className="ws-eyebrow">Hello to Cheers</p>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">Accept invite</h1>
        <p className="mt-3 text-[1.05rem] leading-relaxed ws-muted">
          Create a password to join the Relationship Workspace.
        </p>
        <AcceptInviteForm
          token={invite.token}
          name={invite.name}
          email={invite.email}
          role={invite.role}
        />
      </div>
    </div>
  );
}
