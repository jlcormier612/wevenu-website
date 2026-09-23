"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function SmsConsentOptInForm({
  token,
  venueName,
}: {
  token: string;
  venueName: string;
}) {
  const router = useRouter();
  const [checked, setChecked] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/sms-consent/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, optedIn: checked }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Could not save your preference.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          className="mt-1"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <span>
          Yes, I&apos;d like to receive text messages from <strong>{venueName}</strong> about my
          inquiry, tour, or event. Message and data rates may apply. Reply STOP to opt out.
        </span>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="button" disabled={!checked || pending} onClick={submit} className="w-full">
        {pending ? "Saving…" : "Allow text messages"}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Opening this page is not consent. You are not opted in until you confirm here.
      </p>
    </div>
  );
}
