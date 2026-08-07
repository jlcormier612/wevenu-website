"use client";

/**
 * Client wrapper that mounts Welcome Experience and records acceptances
 * via the session or portal legal APIs (WP4). Does not modify Welcome UI.
 */

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  WelcomeExperience,
  type WelcomeExperienceDocument,
} from "@/components/welcome-experience";
import type { WelcomeFlowContext } from "@/lib/legal/welcome-integration";

export function WelcomeExperienceGate({
  heading,
  introduction,
  documents,
  context,
  returnTo,
  /** Couple portal access token — uses /api/portal/legal when set. */
  portalToken,
  /**
   * Optional success hook. Defaults to navigating to `returnTo`.
   * Portal shell passes a local unlock so remaining on `/p/{token}` does not
   * leave the soft gate mounted after acceptance.
   */
  onSuccess,
}: {
  heading: string;
  introduction: string | string[];
  documents: WelcomeExperienceDocument[];
  context: WelcomeFlowContext;
  returnTo: string;
  portalToken?: string | null;
  onSuccess?: () => void;
}) {
  const router = useRouter();

  async function onContinue() {
    if (portalToken) {
      const res = await fetch("/api/portal/legal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: portalToken,
          legalAccepted: true,
          context,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? "Unable to record acceptance.");
      }
      return;
    }

    const res = await fetch("/api/legal/welcome", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        legalAccepted: true,
        context,
        returnTo,
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error ?? "Unable to record acceptance.");
    }
  }

  return (
    <WelcomeExperience
      heading={heading}
      introduction={introduction}
      documents={documents}
      onContinue={onContinue}
      onSuccess={() => {
        if (onSuccess) {
          onSuccess();
          return;
        }
        router.replace(returnTo);
        router.refresh();
      }}
    />
  );
}
