import { redirect } from "next/navigation";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { acceptTeamInvitation } from "@/lib/team/service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Wordmark } from "@/components/brand/wordmark";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function JoinPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-12">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex justify-center"><Wordmark /></div>
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Invalid Invitation</CardTitle>
              <CardDescription>This invitation link is missing a token.</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/login" className="text-sm text-primary hover:underline">Go to sign in</Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // Check if authenticated
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // `/login` only ever reads `?next=` (see components/auth/login-form.tsx
      // + app/auth/actions.ts's safeInternalNextPath) — the same mechanism
      // /vendor/accept relies on to return an invitation claimer to the
      // right place after signing in. This previously used `?redirect=`,
      // a param /login never reads, silently stranding every invitee here.
      redirect(`/login?next=${encodeURIComponent(`/join?token=${token}`)}`);
    }

    // Accept the invitation
    const result = await acceptTeamInvitation(token);

    if (result.ok) {
      redirect("/");
    }

    if (result.error === "email_mismatch") {
      return (
        <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-12">
          <div className="flex w-full max-w-sm flex-col gap-6">
            <div className="flex justify-center"><Wordmark /></div>
            <Card>
              <CardHeader className="text-center">
                <CardTitle>Wrong Email Address</CardTitle>
                <CardDescription>
                  This invitation was sent to a different email address.
                  Sign in with that email, or ask your venue owner to resend
                  the invitation to the correct address.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Link href="/login" className="text-sm text-primary hover:underline">Sign in with a different account</Link>
              </CardContent>
            </Card>
          </div>
        </main>
      );
    }

    if (result.error === "already_a_member") {
      return (
        <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-12">
          <div className="flex w-full max-w-sm flex-col gap-6">
            <div className="flex justify-center"><Wordmark /></div>
            <Card>
              <CardHeader className="text-center">
                <CardTitle>Already a Member</CardTitle>
                <CardDescription>
                  You&apos;re already an active team member at this venue.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Link href="/" className="text-sm text-primary hover:underline">Go to workspace</Link>
              </CardContent>
            </Card>
          </div>
        </main>
      );
    }

    return (
      <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-12">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex justify-center"><Wordmark /></div>
          <Card>
            <CardHeader className="text-center">
              <CardTitle>Invitation Not Found</CardTitle>
              <CardDescription>
                This invitation link is invalid or has already been used.
                Please contact the venue owner to request a new invitation.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Link href="/" className="text-sm text-primary hover:underline">Go to workspace</Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return null;
}
