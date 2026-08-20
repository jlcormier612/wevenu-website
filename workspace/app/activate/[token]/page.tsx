import Link from "next/link";

import { productAppBaseUrl } from "@shared/email";
import { getEnrollmentByActivationToken } from "@shared/product-account";

import { ActivateAccountForm } from "@/components/activate/activate-account-form";

export const metadata = { title: "Let's get you started" };

function ActivationErrorPanel({
  title,
  message,
  showLogin,
}: {
  title: string;
  message: string;
  showLogin?: boolean;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--warm-gray)] px-6">
      <div className="ws-panel ws-enter w-full max-w-md p-8 md:p-10">
        <p className="ws-eyebrow">Hello to Cheers</p>
        <h1 className="mt-3 font-heading text-3xl tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed ws-muted" role="alert">
          {message}
        </p>
        {showLogin ? (
          <Link
            href={`${productAppBaseUrl()}/login`}
            className="mt-6 inline-block text-sm text-[var(--heritage-sage)] underline-offset-4 hover:underline"
          >
            Go to sign in →
          </Link>
        ) : (
          <p className="mt-6 text-sm ws-muted">
            Need help? Reply to your welcome email and Jennifer will send a fresh
            link.
          </p>
        )}
      </div>
    </div>
  );
}

const NOT_FOUND_MESSAGE = "This activation link is invalid or has already been used.";
const ALREADY_ACTIVATED_MESSAGE = "This account is already activated. Sign in with your password.";
const EXPIRED_MESSAGE = "This activation link has expired. Reply to your welcome email and we'll send a fresh one.";
const LOOKUP_FAILED_MESSAGE = "We couldn't check this activation link just now. Please try again in a moment.";

export default async function ActivateAccountPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken || "").trim();
  const lookup = token
    ? await getEnrollmentByActivationToken(token)
    : ({ ok: true, found: false } as const);

  if (!lookup.ok) {
    return <ActivationErrorPanel title="Invalid link" message={LOOKUP_FAILED_MESSAGE} />;
  }

  if (!lookup.found) {
    return <ActivationErrorPanel title="Invalid link" message={NOT_FOUND_MESSAGE} />;
  }

  if (lookup.reason !== "valid") {
    if (lookup.reason === "already_activated") {
      return (
        <ActivationErrorPanel
          title="Already activated"
          message={ALREADY_ACTIVATED_MESSAGE}
          showLogin
        />
      );
    }
    return <ActivationErrorPanel title="Link expired" message={EXPIRED_MESSAGE} />;
  }

  const email = lookup.ownerEmail.trim();
  const venueName = lookup.venueName;

  if (!email) {
    return (
      <ActivationErrorPanel
        title="Missing email"
        message="This enrollment has no owner email on file. Contact Hello to Cheers support."
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--warm-gray)] px-6">
      <div className="ws-panel ws-enter w-full max-w-md p-8 md:p-10">
        <p className="ws-eyebrow">Hello to Cheers</p>
        <h1 className="mt-3 font-heading text-4xl tracking-tight">
          Let&apos;s get you started
        </h1>
        <p className="mt-3 text-[1.05rem] leading-relaxed ws-muted">
          Your Hello to Cheers experience is waiting for you.
        </p>
        <p className="mt-5 text-sm leading-relaxed ws-muted">
          Create your password below, and we&apos;ll get everything ready for
          your first visit.
        </p>
        <ActivateAccountForm token={token} email={email} venueName={venueName} />
      </div>
    </div>
  );
}
