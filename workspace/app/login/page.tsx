import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/team/login-form";
import { WorkspaceAccessDenied } from "@/components/team/workspace-access-denied";
import { resolveStaffAfterAuth } from "@/lib/program4/staff-auth-service";
import { ensureProgram4Data } from "@/lib/program4/store";
import { isSupabaseStaffAuthEnabled } from "@/lib/supabase/workspace-auth-config";

export const metadata = { title: "Sign in" };

function safeNext(raw: string | undefined): string {
  const next = (raw || "/business").trim();
  return next.startsWith("/") ? next : "/business";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; accepted?: string; reason?: string }>;
}) {
  await ensureProgram4Data();
  const params = await searchParams;
  const next = safeNext(params.next);

  let denied: { message: string; email?: string | null } | null = null;

  if (isSupabaseStaffAuthEnabled()) {
    const { createWorkspaceAuthClient } = await import("@/lib/supabase/server");
    const supabase = await createWorkspaceAuthClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const resolved = await resolveStaffAfterAuth(
        data.user.id,
        data.user.email ?? null,
      );
      if (resolved.ok) {
        redirect(next);
      }
      denied = {
        message: resolved.error,
        email: data.user.email ?? null,
      };
    }
  }

  return (
    <div className="ws-login-shell flex min-h-screen items-center justify-center px-6 py-10">
      <div className="ws-panel w-full max-w-md p-8 shadow-[0_10px_28px_rgba(41,45,41,0.08)] md:p-10">
        <p className="ws-eyebrow">Hello to Cheers</p>
        <h1 className="mt-3 font-heading text-[2.125rem] tracking-tight text-[var(--htc-forest)] md:text-4xl">
          Relationship Workspace
        </h1>
        {denied ? (
          <>
            <p className="mt-3 text-[1.05rem] leading-relaxed ws-muted">
              Access denied
            </p>
            <WorkspaceAccessDenied
              message={denied.message}
              email={denied.email}
            />
          </>
        ) : (
          <>
            <p className="mt-3 text-[1.05rem] leading-relaxed ws-muted">
              Sign in with your team email and password. Invites are sent by an
              Owner or Administrator.
            </p>
            {params.reason === "no_access" ? (
              <p
                role="alert"
                className="mt-4 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
              >
                This account does not have Workspace access.
              </p>
            ) : null}
            <LoginForm
              next={next}
              accepted={params.accepted === "1"}
            />
          </>
        )}

        <p className="mt-4 text-center text-sm ws-muted">
          <Link
            href="/"
            className="text-[var(--htc-primary)] underline-offset-4 hover:underline"
          >
            Back
          </Link>
        </p>
      </div>
    </div>
  );
}
