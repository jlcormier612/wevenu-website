import Link from "next/link";

import { LoginForm } from "@/components/team/login-form";
import { DEMO_LOGIN } from "@/lib/program4/demo-login";
import { ensureProgram4Data } from "@/lib/program4/store";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; accepted?: string }>;
}) {
  await ensureProgram4Data();
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--warm-gray)] px-6">
      <div className="ws-panel w-full max-w-md p-8 md:p-10">
        <p className="ws-eyebrow">Hello to Cheers</p>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Relationship Workspace
        </h1>
        <p className="mt-3 text-[1.05rem] leading-relaxed ws-muted">
          Sign in with your team email and password. Invites are sent by an Owner or
          Administrator.
        </p>

        <LoginForm
          next={params.next ?? "/business"}
          accepted={params.accepted === "1"}
        />

        <p className="mt-6 text-center text-xs leading-relaxed ws-muted">
          Demo:{" "}
          <code className="rounded-sm bg-[var(--warm-gray)] px-1.5 py-0.5 text-[var(--forest-sage)]">
            {DEMO_LOGIN.email}
          </code>{" "}
          /{" "}
          <code className="rounded-sm bg-[var(--warm-gray)] px-1.5 py-0.5 text-[var(--forest-sage)]">
            {DEMO_LOGIN.password}
          </code>
        </p>

        <p className="mt-4 text-center text-sm ws-muted">
          <Link href="/" className="text-[var(--heritage-sage)] underline-offset-4 hover:underline">
            Back
          </Link>
        </p>
      </div>
    </div>
  );
}
