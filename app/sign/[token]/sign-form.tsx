"use client";

import * as React from "react";

import { Loader2, PenLine } from "lucide-react";

import { signContractAction } from "@/app/sign/[token]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignForm({ token }: { token: string }) {
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function handleSign() {
    if (!name.trim()) { setError("Please enter your full name."); return; }
    setError("");
    startTransition(async () => {
      const result = await signContractAction(token, name);
      if (result.ok) {
        setDone(true);
      } else {
        setError(result.message ?? "Could not record your signature. Please try again.");
      }
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-2">
        <p className="text-lg font-semibold text-green-800">✓ Agreement signed</p>
        <p className="text-sm text-green-700">
          Thank you, {name}. Your signature has been recorded.
          The venue will receive a notification and may follow up with next steps.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <PenLine className="h-5 w-5 text-gray-500" />
        <p className="text-sm font-semibold text-gray-800">Sign this agreement</p>
      </div>
      <p className="text-sm text-gray-600">
        By entering your full name and clicking "Sign Agreement," you agree to all terms
        and conditions set forth in this document.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="signer-name" className="text-sm text-gray-700">Full legal name *</Label>
        <Input
          id="signer-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your full name"
          className="bg-white"
          onKeyDown={(e) => e.key === "Enter" && handleSign()}
          aria-invalid={error ? true : undefined}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>Today's date:</span>
        <span className="font-medium">
          {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </span>
      </div>
      <Button type="button" onClick={handleSign} disabled={pending} className="w-full">
        {pending
          ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Signing…</>
          : <><PenLine className="mr-1.5 h-4 w-4" />Sign Agreement</>}
      </Button>
    </div>
  );
}
