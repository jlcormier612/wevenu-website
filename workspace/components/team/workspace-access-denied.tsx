import { logoutAction } from "@/app/(app)/team/auth-actions";

/**
 * Shown when a valid Supabase Auth session exists but the user is not on
 * htc_internal_staff (or is inactive). Never elevates privileges.
 */
export function WorkspaceAccessDenied({
  message,
  email,
}: {
  message: string;
  email?: string | null;
}) {
  return (
    <div className="mt-8 space-y-4">
      <p
        role="alert"
        className="rounded-sm border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-900"
      >
        {message}
      </p>
      {email ? (
        <p className="text-sm ws-muted">
          Signed in as <span className="text-foreground">{email}</span>
        </p>
      ) : null}
      <p className="text-sm leading-relaxed ws-muted">
        Relationship Workspace is limited to Hello to Cheers internal staff.
        Venue and customer accounts use the product app instead. If you need
        staff access, ask an Owner to send a Workspace invite.
      </p>
      <form action={logoutAction}>
        <button
          type="submit"
          className="w-full rounded-sm bg-[var(--forest-sage)] px-4 py-3 text-sm font-medium text-[var(--true-white)] hover:bg-[var(--heritage-sage)]"
        >
          Sign out and use a different account
        </button>
      </form>
    </div>
  );
}
