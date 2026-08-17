import type { Metadata } from "next";
import Link from "next/link";

import {
  BookOpen, Boxes, CalendarClock, ClipboardList, FileSignature, FileText,
  Layers, LayoutGrid, Mail, Megaphone, Package, QrCode,
} from "lucide-react";

import { PageHeader } from "@/components/shell/module-placeholder";
import { Badge } from "@/components/ui/badge";
import { getTemplates as getContractTemplates } from "@/lib/contracts/service";
import { getTemplates as getMessageTemplates } from "@/lib/message-templates/service";
import { getTemplatesForLibrary as getPlaybookTemplates } from "@/lib/playbooks/service";
import { getTemplatesForLibrary as getTimelineTemplates } from "@/lib/timeline-templates/service";
import { getTemplatesForLibrary as getFloorPlanTemplates } from "@/lib/floor-plan-templates/service";
import { getPackages } from "@/lib/packages/service";
import { getItemsForLibrary } from "@/lib/inventory/service";
import { getTemplates as getInventoryTemplates } from "@/lib/event-inventory/service";
import { getTemplates as getQuestionnaireTemplates } from "@/lib/questionnaire-templates/service";
import { getQrCampaigns } from "@/lib/qr-campaigns/service";
import { getTemplates as getEventOrderTemplates } from "@/lib/event-order-templates/service";
import { getBrochures } from "@/lib/brochures/service";
import { getSavedReports } from "@/lib/saved-reports/service";
import { getPaymentPlanStarters } from "@/lib/payments/starters";
import { ensureBrochureStartersForCurrentVenue } from "@/lib/brochures/provision";
import { ensureSavedReportStartersForCurrentVenue } from "@/lib/saved-reports/provision";

export const metadata: Metadata = { title: "Library" };

// Work Package BA4, Step 1B — the Library landing page. Organizes the
// existing template destinations. Work Package D7 replaced the "Coming
// later" placeholders with real capabilities one at a time as each one
// actually shipped — see docs/library-remaining-capabilities-implementation.md.

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
  await Promise.all([
    ensureBrochureStartersForCurrentVenue(),
    ensureSavedReportStartersForCurrentVenue(),
  ]);
  const [
    contractTemplates, playbookTemplatesAll, timelineTemplatesAll, floorPlanTemplatesAll,
    packagesAll, inventoryItemsAll, qrCampaigns, messageTemplates, inventoryTemplates,
    questionnaireTemplates, eventOrderTemplatesAll, brochuresAll, savedReports,
  ] = await Promise.all([
    getContractTemplates(),
    getPlaybookTemplates(),
    getTimelineTemplates(),
    getFloorPlanTemplates(),
    getPackages(true),
    getItemsForLibrary(),
    getQrCampaigns(),
    getMessageTemplates(),
    getInventoryTemplates(),
    getQuestionnaireTemplates(),
    getEventOrderTemplates(true),
    getBrochures(true),
    getSavedReports(),
  ]);
  const eventOrderTemplates = eventOrderTemplatesAll.filter((t) => !t.isArchived);
  const brochures = brochuresAll.filter((b) => !b.isArchived);
  const playbookTemplates = playbookTemplatesAll.filter((t) => !t.isArchived);
  const timelineTemplates = timelineTemplatesAll.filter((t) => !t.isArchived);
  const floorPlanTemplates = floorPlanTemplatesAll.filter((t) => !t.isArchived);
  const inventoryItems = inventoryItemsAll.filter((i) => !i.isArchived);
  const packages = packagesAll;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Library"
        description="Your venue's toolbox — the things you set up once and use again and again: agreements, packages, planning tools, marketing, and more."
      />

      <Group title="Agreements & Forms">
        <ToolboxCard title="Contract Templates" description="Reusable contracts with fill-in details, ready to send." href="/library/contracts" count={contractTemplates.length} icon={FileSignature} />
        <ToolboxCard title="Questionnaires & Feedback" description="Client Planning Questionnaire, Final Details, and Post-Event Feedback starters." href="/library/questionnaire-templates" count={questionnaireTemplates.length} icon={FileText} />
      </Group>

      <Group title="Pricing &amp; Packages">
        <ToolboxCard title="Packages" description="What you offer — customize inclusions and set your price before adding to an event or invoice." href="/packages" count={packages.length} icon={Boxes} />
        {/* D8 — count was a hardcoded literal 3; matched today's real
            starter list by coincidence, but would have silently gone stale
            the moment a starter was added or removed. Every other Library
            card computes its own count — this now does too. */}
        <ToolboxCard title="Payment Schedules" description="Starter payment plans — 3-payment, 4-payment, or custom — always tied to a real invoice total." href="/library/payment-schedules" count={getPaymentPlanStarters().length} icon={ClipboardList} />
      </Group>

      <Group title="Planning">
        <ToolboxCard title="Planning Templates" description="The task checklists you've refined over the years." href="/library/playbooks" count={playbookTemplates.length} icon={BookOpen} />
        <ToolboxCard title="Timeline Templates" description="Reusable day-of schedules for any booking." href="/library/timeline-templates" count={timelineTemplates.length} icon={CalendarClock} />
        <ToolboxCard title="Floor Plan Templates" description="Reusable room layouts for any booking." href="/library/floor-plan-templates" count={floorPlanTemplates.length} icon={LayoutGrid} />
        <ToolboxCard title="Event Order Templates" description="Reusable starting points for the Event Orders you create for your events." href="/library/event-order-templates" count={eventOrderTemplates.length} icon={ClipboardList} />
        <ToolboxCard title="Available Inventory Items" description="What your venue provides — customize examples, then use them on events." href="/library/inventory" count={inventoryItems.length} icon={Package} />
        <ToolboxCard title="Inventory Templates" description="What you typically use for a wedding — Ceremony + Reception or Reception Only starters." href="/library/inventory-templates" count={inventoryTemplates.length} icon={Layers} />
      </Group>

      <Group title="Communication">
        <ToolboxCard title="Message Templates" description="Emails and texts you send often, ready to reuse." href="/communication/templates" count={messageTemplates.length} icon={Mail} />
      </Group>

      <Group title="Marketing">
        <ToolboxCard title="QR Campaigns" description="Trackable QR codes for print materials and signage." href="/library/qr-campaigns" count={qrCampaigns.length} icon={QrCode} />
        <ToolboxCard title="Brochures" description="Reusable, brandable overviews of your venue to share with prospects." href="/library/brochures" count={brochures.length} icon={Megaphone} />
      </Group>

      <Group title="Reports">
        <ToolboxCard title="Saved Reports" description="Reports you've saved to return to quickly, or have delivered to you." href="/reporting/saved" count={savedReports.length} icon={FileText} />
      </Group>
    </div>
  );
}
