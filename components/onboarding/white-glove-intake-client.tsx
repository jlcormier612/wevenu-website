"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { OnboardingIntakeForm, type IntakePrefill } from "@/components/onboarding/onboarding-intake-form";
import type { OnboardingIntakeInput } from "@/lib/onboarding/types";
import { Button } from "@/components/ui/button";

export function WhiteGloveIntakeClient({
  intakeToken,
  prefill,
}: {
  intakeToken: string;
  prefill: IntakePrefill;
}) {
  const router = useRouter();
  const [uploads, setUploads] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set("intakeToken", intakeToken);
        form.set("file", file);
        const res = await fetch("/api/onboarding/white-glove/materials", {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as { ok?: boolean; fileName?: string; error?: string };
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "Upload failed");
        }
        setUploads((prev) => [...prev, data.fileName || file.name]);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(intake: OnboardingIntakeInput) {
    const res = await fetch("/api/onboarding/white-glove/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intakeToken, intake }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Could not submit intake");
    }
    router.push(`/onboarding/white-glove/${encodeURIComponent(intakeToken)}/waiting`);
  }

  return (
    <OnboardingIntakeForm
      mode="white_glove"
      prefill={prefill}
      submitLabel="Submit"
      onSubmit={onSubmit}
      materialsSlot={
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Have materials you&apos;d like us to use?</h2>
          <p className="text-sm text-muted-foreground">
            Upload whatever you already have. You don&apos;t need to organize or rename
            everything first.
          </p>
          <p className="text-sm text-muted-foreground">Examples</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Venue brochure</li>
            <li>Package/pricing sheets</li>
            <li>Contracts</li>
            <li>Proposals</li>
            <li>Client questionnaires</li>
            <li>Floor plans</li>
            <li>Planning guides</li>
            <li>Spreadsheets/exports</li>
            <li>Other venue information</li>
          </ul>
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground hover:bg-muted/40">
            <span className="font-medium text-foreground">Drop files here</span>
            <span className="mt-1 text-xs">{uploading ? "Uploading…" : "or click to browse"}</span>
            <input
              type="file"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => uploadFiles(e.target.files)}
            />
          </label>
          {uploads.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {uploads.map((name) => (
                <li key={name}>✓ {name}</li>
              ))}
            </ul>
          ) : null}
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-sm font-medium">Don&apos;t have everything handy? That&apos;s okay.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit what you have and we&apos;ll get started. We&apos;ll ask if we need anything
              else.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" disabled className="hidden">
            noop
          </Button>
        </div>
      }
    />
  );
}
