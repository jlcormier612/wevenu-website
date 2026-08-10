import type { Metadata } from "next";
import Link from "next/link";

import {
  BookOpen, Boxes, CalendarClock, ClipboardList, FileSignature, FileText, GitBranch,
  HelpCircle, LayoutGrid, Mail, Megaphone, Package, QrCode,
} from "lucide-react";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Badge } from "@/components/ui/badge";
import { getTemplates as getContractTemplates } from "@/lib/contracts/service";
import { getTemplates as getMessageTemplates } from "@/lib/message-templates/service";
import { getTemplatesForLibrary as getPlaybookTemplates } from "@/lib/playbooks/service";
import { getTemplatesForLibrary as getTimelineTemplates } from "@/lib/timeline-templates/service";
import { getTemplatesForLibrary as getFloorPlanTemplates } from "@/lib/floor-plan-templates/service";
import { getTemplates as getPipelineTemplates } from "@/lib/pipeline-templates/service";
import { getPackages } from "@/lib/packages/service";
import { getItemsForLibrary } from "@/lib/inventory/service";
import { getQrCampaigns } from "@/lib/qr-campaigns/service";

export const metadata: Metadata = { title: "Library" };

// Work Package BA4, Step 1B — the Library landing page. Organizes the
// existing template destinations only; nothing here is a new template type,
// and nothing under "Coming later" is implemented — those cards are
// disabled on purpose, per the brief's own instruction.

type LibraryCard = {
  title: string;
  description: string;
  href?: string;
  count?: number;
  icon: React.ElementType;
};

function ToolboxCard({ title, description, href, count, icon: Icon }: LibraryCard) {
  const body = (
    <div className="flex h-full items-start gap-3 rounded-sm border border-border bg-card p-4 transition-colors hover:bg-muted/20">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-heading">{title}</p>
          {count !== undefined && <Badge variant="muted">{count}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function ComingLaterCard({ title, description, icon: Icon }: Omit<LibraryCard, "href" | "count">) {
  return (
    <div className="flex h-full items-start gap-3 rounded-sm border border-dashed border-border bg-muted/10 p-4 opacity-60">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-heading">{title}</p>
          <Badge variant="outline">Coming later</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default async function LibraryPage() {
  // Work Package D2, Step 8 — counts must reflect active, reusable
  // templates only. This page originally passed includeArchived=true for
  // Contracts/Messages/QR (fixed by omitting the flag, its default is
  // false), and — a second, separate bug found this pass — the "for
  // library" fetchers for Playbooks/Timeline/Floor Plan Templates and
  // Inventory never filter archived at all (confirmed against their real
  // repository queries: no archived predicate exists in any of the four).
  // They're used unfiltered elsewhere for pages with their own "show
  // archived" toggle (e.g. contract-template-list.tsx's own pattern), so
  // the fix belongs here — filtering client-side for the count — not in
  // the shared fetcher, which other real callers still need unfiltered.
  const [
    contractTemplates, playbookTemplatesAll, timelineTemplatesAll, floorPlanTemplatesAll,
    pipelineTemplates, packagesAll, inventoryItemsAll, qrCampaigns, messageTemplates,
  ] = await Promise.all([
    getContractTemplates(),
    getPlaybookTemplates(),
    getTimelineTemplates(),
    getFloorPlanTemplates(),
    getPipelineTemplates(),
    getPackages(true),
    getItemsForLibrary(),
    getQrCampaigns(),
    getMessageTemplates(),
  ]);
  const playbookTemplates = playbookTemplatesAll.filter((t) => !t.isArchived);
  const timelineTemplates = timelineTemplatesAll.filter((t) => !t.isArchived);
  const floorPlanTemplates = floorPlanTemplatesAll.filter((t) => !t.isArchived);
  const inventoryItems = inventoryItemsAll.filter((i) => !i.isArchived);
  const packages = packagesAll;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Library"
        description="Your venue's toolbox — everything reusable, in one place. Templates you build once and use for every wedding."
      />

      <Group title="Agreements">
        <ToolboxCard title="Contract Templates" description="Reusable contracts with fill-in details, ready to send." href="/library/contracts" count={contractTemplates.length} icon={FileSignature} />
        <ComingLaterCard title="Questionnaire Templates" description="A customizable final-details form for your venue. Today, every event uses one built-in questionnaire." icon={FileText} />
      </Group>

      <Group title="Pricing &amp; Packages">
        <ToolboxCard title="Packages" description="What you sell — priced, ready to add to any invoice." href="/packages" count={packages.length} icon={Boxes} />
        <ToolboxCard title="Inventory" description="Tables, chairs, decor — everything you set up for a booking." href="/library/inventory" count={inventoryItems.length} icon={Package} />
      </Group>

      <Group title="Planning">
        <ToolboxCard title="Planning Templates" description="The task checklists you've refined over the years." href="/library/playbooks" count={playbookTemplates.length} icon={BookOpen} />
        <ToolboxCard title="Timeline Templates" description="Reusable day-of schedules for any booking." href="/library/timeline-templates" count={timelineTemplates.length} icon={CalendarClock} />
        <ToolboxCard title="Pipeline Templates" description="How a lead moves through your booking process." href="/library/pipeline-templates" count={pipelineTemplates.length} icon={GitBranch} />
        <ToolboxCard title="Floor Plan Templates" description="Reusable room layouts for any booking." href="/library/floor-plan-templates" count={floorPlanTemplates.length} icon={LayoutGrid} />
        <ComingLaterCard title="Event Orders" description="A reusable starting point for what a booking receives — today, every Event Order is built from scratch per event." icon={ClipboardList} />
      </Group>

      <Group title="Communication">
        <ToolboxCard title="Message Templates" description="Emails and texts you send often, ready to reuse." href="/communication/templates" count={messageTemplates.length} icon={Mail} />
        <ToolboxCard title="FAQs" description="Answers your clients and vendors see in the Venue Guide." href="/guide" icon={HelpCircle} />
      </Group>

      <Group title="Marketing">
        <ToolboxCard title="QR Campaigns" description="Trackable QR codes for print materials and signage." href="/library/qr-campaigns" count={qrCampaigns.length} icon={QrCode} />
        <ComingLaterCard title="Brochures" description="A reusable, brandable overview of your venue to share with prospects." icon={Megaphone} />
      </Group>

      <Group title="Reports">
        <ComingLaterCard title="Saved Reports" description="Export or schedule the analytics you check most." icon={FileText} />
      </Group>
    </div>
  );
}
