"use client";

/**
 * Post-intake waiting / materials hub — resumable until handoff.
 * Shows received files, allows additional uploads, and links back to correct intake.
 */
import * as React from "react";
import Link from "next/link";

import { WhiteGloveBrandChrome } from "@/components/onboarding/white-glove-brand-chrome";
import { Button } from "@/components/ui/button";

type MaterialRow = {
  id: string;
  fileName: string;
  contentType: string | null;
  byteSize: number | null;
  uploadedAt: string;
};

function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function WhiteGloveWaitingClient({
  intakeToken,
  venueName,
  activated,
}: {
  intakeToken: string;
  venueName: string | null;
  activated: boolean;
}) {
  const [materials, setMaterials] = React.useState<MaterialRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/onboarding/white-glove/materials?intakeToken=${encodeURIComponent(intakeToken)}`,
      );
      const data = (await res.json()) as {
        ok?: boolean;
        materials?: MaterialRow[];
        error?: string;
        activated?: boolean;
      };
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not load materials.");
        return;
      }
      setMaterials(data.materials ?? []);
    } catch {
      setError("Could not load materials.");
    } finally {
      setLoading(false);
    }
  }, [intakeToken]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length || activated) return;
    setUploading(true);
    setMessage(null);
    setError(null);
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
        setMessage(`Received: ${data.fileName || file.name}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (activated) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-16">
        <WhiteGloveBrandChrome />
        <h1 className="font-heading text-3xl font-medium tracking-tight">
          Your workspace access is ready
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          This intake link is closed because your Hello to Cheers workspace has already been
          activated. Sign in with the email we sent you.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-16">
      <WhiteGloveBrandChrome />
      <h1 className="font-heading text-3xl font-medium tracking-tight">
        We&apos;re getting {venueName?.trim() || "your venue"} ready
      </h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        We&apos;ve received your information. You can come back anytime to add materials or
        update details until we hand off your workspace.
      </p>

      <section className="mt-8 space-y-3" data-testid="wg-waiting-materials">
        <h2 className="text-lg font-medium">Materials we&apos;ve received</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No files yet — you can upload anything you already have below.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {materials.map((m) => (
              <li
                key={m.id}
                className="rounded-md border bg-muted/20 px-3 py-2"
                data-testid={`wg-waiting-file-${m.id}`}
              >
                <span className="font-medium">✓ {m.fileName}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Received {new Date(m.uploadedAt).toLocaleString()}
                  {m.byteSize != null ? ` · ${formatBytes(m.byteSize)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-medium">Add more materials</h2>
        <p className="text-sm text-muted-foreground">
          Brochures, packages, contracts, floor plans, spreadsheets — keep the names you
          already use.
        </p>
        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground hover:bg-muted/40">
          <span className="font-medium text-foreground">Drop files here</span>
          <span className="mt-1 text-xs">{uploading ? "Uploading…" : "or click to browse"}</span>
          <input
            type="file"
            multiple
            className="hidden"
            disabled={uploading}
            data-testid="wg-waiting-upload"
            onChange={(e) => {
              void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {message ? (
          <p className="text-sm text-emerald-700" data-testid="wg-waiting-upload-success">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" data-testid="wg-waiting-upload-error">
            {error}
          </p>
        ) : null}
      </section>

      <section className="mt-8 space-y-3 rounded-md border bg-muted/20 p-4">
        <h2 className="text-lg font-medium">Need to correct something?</h2>
        <p className="text-sm text-muted-foreground">
          You can update venue details you already submitted. Your login email and account
          ownership stay the same.
        </p>
        <Button
          render={
            <Link
              href={`/onboarding/white-glove/${encodeURIComponent(intakeToken)}?edit=1`}
              data-testid="wg-waiting-edit-intake"
            />
          }
          variant="outline"
        >
          Review or update your information
        </Button>
      </section>

      <p className="mt-10 text-sm leading-relaxed text-muted-foreground">
        We&apos;ll let you know if we need a decision from you. There is no fixed turnaround
        promise on this page — we work from what you&apos;ve shared.
      </p>
    </main>
  );
}
