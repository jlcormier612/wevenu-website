"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";

import { sendOnboardingUpdateAction } from "@/app/admin/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** §2.2a step 5 — "Communicate with the venue," scoped to outbound email for v1 (see the action's own doc comment for why). */
export function OnboardingSendUpdate({ venueId, venueEmail }: { venueId: string; venueEmail: string | null }) {
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");

  function handleSend() {
    if (!venueEmail) return;
    startTransition(async () => {
      const result = await sendOnboardingUpdateAction(venueId, venueEmail, subject, body);
      if (result.ok) {
        toast.success("Update sent.");
        setSubject("");
        setBody("");
      } else {
        toast.error(result.message ?? "Could not send this update.");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <h2 className="font-heading text-sm font-semibold text-heading">Send an update</h2>
        <p className="text-xs text-muted-foreground">
          {venueEmail ? `Emails ${venueEmail} directly and logs it to this venue's activity trail.` : "No email on file for this venue."}
        </p>
      </CardHeader>
      {venueEmail && (
        <CardContent className="pt-0 space-y-2">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="text-sm" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Message…" rows={4} className="text-sm" />
          <div className="flex justify-end">
            <Button size="sm" disabled={pending || !subject.trim() || !body.trim()} onClick={handleSend}>
              {pending ? "Sending…" : "Send"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
