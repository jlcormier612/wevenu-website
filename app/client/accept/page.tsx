import type { Metadata } from "next";
import Link from "next/link";

import { peekClientInvitation } from "@/lib/client-auth/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wordmark } from "@/components/brand/wordmark";
import { AcceptClientForm } from "@/app/client/accept/accept-form";

export const metadata: Metadata = { title: "Create Your Account — Wevenu" };

type Props = { searchParams: Promise<{ token?: string }> };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex justify-center"><Wordmark /></div>
        {children}
      </div>
    </main>
  );
}

export default async function ClientAcceptPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>This invitation link is missing a token.</CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  const invitation = await peekClientInvitation(token);

  if (!invitation || invitation.status !== "pending" || invitation.expired) {
    return (
      <Shell>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Invitation Not Found</CardTitle>
            <CardDescription>
              This invitation link is invalid, has already been used, or has expired.
              Ask your venue to resend the invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/client/login" className="text-sm text-primary hover:underline">
              Already have an account? Sign in
            </Link>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Welcome, {invitation.coupleName}</CardTitle>
          <CardDescription>
            {invitation.venueName} invited you to create your own account for your planning workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptClientForm token={token} email={invitation.email} />
        </CardContent>
      </Card>
    </Shell>
  );
}
