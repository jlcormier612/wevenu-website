"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import {
  isSafeSetupHubReturnPath,
  isSetupHubSection,
  SETUP_HUB_SECTION_RETURN,
} from "@/lib/setup-hub/phase-b1-routes";

/** Shown only when a destination was opened from Milestone 02. Ordinary nav is unchanged. */
export function SetupHubReturnLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Suspense fallback={null}>
      <SetupHubReturnLinkInner href={href} label={label} />
    </Suspense>
  );
}

function SetupHubReturnLinkInner({ href, label }: { href: string; label: string }) {
  const params = useSearchParams();
  if (params.get("from") !== "setup-hub") return null;
  const customReturn = params.get("setupReturn");
  const customLabel = params.get("setupReturnLabel");
  if (isSafeSetupHubReturnPath(customReturn)) {
    return (
      <Link
        href={customReturn}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-heading"
        data-testid="phase-b1-back-to-guided-setup"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {customLabel?.trim() || label}
      </Link>
    );
  }
  const section = params.get("setupSection");
  const mapped = isSetupHubSection(section) ? SETUP_HUB_SECTION_RETURN[section] : null;
  const dest = mapped?.href ?? href;
  const text = mapped?.label ?? label;
  return (
    <Link
      href={dest}
      className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-heading"
      data-testid="phase-b1-back-to-guided-setup"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {text}
    </Link>
  );
}
