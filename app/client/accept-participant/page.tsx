import type { Metadata } from "next";
import Link from "next/link";

import { peekParticipantInvitation } from "@/lib/client-auth/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthBrandFrame } from "@/components/auth/auth-brand-shell";
import { AcceptParticipantForm } from "@/app/client/accept-participant/accept-participant-form";

export const metadata: Metadata = { title: "Create Your Account — Hello to Cheers" };

type Props = { searchParams: Promise<{ token?: string }> };

export default async function AcceptParticipantPage({ searchParams }: Props) {
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

  const invitation = await peekParticipantInvitation(token);

  if (!invitation || invitation.inviteStatus !== "pending") {
    return (
      <AuthBrandFrame>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Invitation Not Found</CardTitle>
            <CardDescription>
              This invitation link is invalid or has already been used.
              Ask {invitation?.coupleName ?? "the couple"} to send a new invitation.
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
        <CardHeader className="text-center">
          <CardTitle>Hi {invitation.firstName}</CardTitle>
          <CardDescription className="space-y-2 text-left sm:text-center">
            <span className="block">
              {invitation.coupleName} invited you to help plan their celebration with{" "}
              <strong className="font-medium text-foreground">{invitation.venueName}</strong>.
            </span>
            <span className="block text-muted-foreground">
              Create your account to join their private planning space on Hello to Cheers.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptParticipantForm token={token} email={invitation.email} />
        </CardContent>
      </Card>
    </AuthBrandFrame>
  );
}
