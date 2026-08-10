"use client";

import * as React from "react";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { WaitingStateBadge, type WaitingOn } from "@/components/business-assets/waiting-state";
import { Button } from "@/components/ui/button";

/**
 * Business Asset Experience Consolidation (Work Package BA4, Step 2).
 *
 * One shared header shape, exactly these regions, in this order, for every
 * Business Asset: What is this / Current Status / Who owns it / Who is
 * waiting / Last updated / Primary Action / Relationship. No asset gets
 * its own header redesign — differences live in the page body below this,
 * never in the identity block itself.
 */
export function BusinessAssetHeader({
  backHref,
  backLabel,
  whatIsThis,
  title,
  status,
  waitingOn,
  owner = "Venue",
  lastUpdated,
  relationship,
  primaryAction,
  compact = false,
}: {
  /**
   * Back link — omit entirely for assets reached inside a Relationship
   * Workspace tab (Event Orders, Task Lists), which never navigate to a
   * separate page in the first place. Provide it for assets with their own
   * standalone page (Contracts, Invoices, Floor Plans, Payment Plans).
   */
  backHref?: string;
  backLabel?: string;
  /** "What is this?" — a short, plain category word, e.g. "Contract," "Invoice." Never the asset's own title. */
  whatIsThis: string;
  title: string;
  /** The asset's own real status badge (Draft/Sent/Signed, etc.) — rendered as-is, not reinterpreted here. */
  status: React.ReactNode;
  /** Omit entirely for assets with no real turn-taking (per BA2/BA3 — e.g. Floor Plans, Event Orders are venue-only edited). */
  waitingOn?: WaitingOn;
  owner?: string;
  lastUpdated: string;
  /** href omitted (embedded contexts that already know their own relationship, e.g. a tab inside the Booking workspace) renders as plain text instead of a link. */
  relationship?: { name: string; href?: string } | null;
  primaryAction?: React.ReactNode;
  /** Same regions, same order — smaller type, for assets already living inside a Relationship Workspace tab/card rather than their own page (Step 8: same mental model, not identical chrome). */
  compact?: boolean;
}) {
  return (
    <div className="space-y-3">
      {backHref && (
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" render={<Link href={backHref} />}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> {backLabel}
        </Button>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{whatIsThis}</p>
          <h1 className={compact ? "text-base font-medium text-heading" : "font-heading text-2xl font-medium text-heading"}>{title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>Owner: {owner}</span>
            <span className="text-border">·</span>
            <span>Updated {lastUpdated}</span>
            {relationship && (
              <>
                <span className="text-border">·</span>
                {relationship.href ? <Link href={relationship.href} className="hover:text-primary">{relationship.name}</Link> : <span>{relationship.name}</span>}
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {status}
          {waitingOn && <WaitingStateBadge waitingOn={waitingOn} />}
          {primaryAction}
        </div>
      </div>
    </div>
  );
}

/**
 * Step 3 — consistent action placement. Primary lives in the header
 * itself; everything else (secondary actions, History, Share, Versions,
 * Print/Download, More) renders in this one row, in this order, every
 * time. Omit a slot entirely when an asset genuinely doesn't have it —
 * never reorder what's present.
 */
export function BusinessAssetActionRow({
  secondary,
  history,
  share,
  versions,
  printOrDownload,
  more,
}: {
  secondary?: React.ReactNode;
  history?: React.ReactNode;
  share?: React.ReactNode;
  versions?: React.ReactNode;
  printOrDownload?: React.ReactNode;
  more?: React.ReactNode;
}) {
  const slots = [secondary, history, share, versions, printOrDownload, more].filter(Boolean);
  if (slots.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {secondary}
      {history}
      {share}
      {versions}
      {printOrDownload}
      {more}
    </div>
  );
}
