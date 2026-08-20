"use client";

import * as React from "react";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { acceptParticipantInvitationAction, type ClientAuthFormState } from "@/app/client/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL_STATE: ClientAuthFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating your account…</> : "Create Your Account"}
    </Button>
  );
}

export function AcceptParticipantForm({ token, email }: { token: string; email: string }) {
  const [state, formAction] = React.useActionState(acceptParticipantInvitationAction, INITIAL_STATE);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="email" value={email} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          readOnly
          aria-readonly="true"
          className="bg-muted/50 text-muted-foreground"
        />
        <p className="text-[11px] text-muted-foreground">
          This is the address you were invited with — it can&apos;t be changed here.
        </p>
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
