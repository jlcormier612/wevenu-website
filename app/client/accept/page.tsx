import type { Metadata } from "next";
import Link from "next/link";

import { peekClientInvitation } from "@/lib/client-auth/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthBrandFrame } from "@/components/auth/auth-brand-shell";
import { AcceptClientForm } from "@/app/client/accept/accept-form";

export const metadata: Metadata = { title: "Create Your Account — Hello to Cheers" };

type Props = { searchParams: Promise<{ token?: string }> };

export default async function ClientAcceptPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <AuthBrandFrame>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>This invitation link is missing a token.</CardDescription>
          </CardHeader>
        </Card>
      </AuthBrandFrame>
    );
  }

  const invitation = await peekClientInvitation(token);

  if (!invitation || invitation.status !== "pending" || invitation.expired) {
    return (
      <AuthBrandFrame>
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
      </AuthBrandFrame>
    );
  }

  return (
    <AuthBrandFrame>
      <Card>
        <CardHeader className="text-center space-y-3">
          <CardTitle>Welcome, {invitation.coupleName}</CardTitle>
          <CardDescription className="space-y-2 text-left sm:text-center">
            <span className="block">
              <strong className="font-medium text-foreground">{invitation.venueName}</strong> invited you to join your private planning space.
            </span>
            <span className="block text-muted-foreground">
              Hello to Cheers is where you&apos;ll keep the important details of your celebration together — from planning tasks and venue information to the things your team shares with you along the way.
            </span>
            <span className="block text-muted-foreground">
              Create your account to get started.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AcceptClientForm token={token} email={invitation.email} />
          <p className="text-center text-xs text-muted-foreground">
            Already have a Hello to Cheers account with this email? Enter the
            password you already use above — or{" "}
            <Link href="/client/login" className="text-primary hover:underline">
              sign in
            </Link>
            {" "}to an existing workspace.
          </p>
        </CardContent>
      </Card>
    </AuthBrandFrame>
  );
}
