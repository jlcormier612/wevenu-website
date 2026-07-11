"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { acceptParticipantInvitationAction, CLIENT_AUTH_INITIAL_STATE } from "@/app/client/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating your account…</> : "Create Your Account"}
    </Button>
  );
}

export function AcceptParticipantForm({ token, email }: { token: string; email: string }) {
  const [state, formAction] = React.useActionState(acceptParticipantInvitationAction, CLIENT_AUTH_INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" value={email} readOnly disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/15 px-3 py-2 text-sm text-foreground">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
