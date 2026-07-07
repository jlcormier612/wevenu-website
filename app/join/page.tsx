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
      redirect(`/login?redirect=/join?token=${token}`);
    }

    // Accept the invitation
    const result = await acceptTeamInvitation(token);

    if (result.ok) {
      redirect("/");
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
