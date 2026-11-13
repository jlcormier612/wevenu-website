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
import { countActivePlanningLibraryTemplates } from "@/lib/playbooks/library-count";
import { getTemplatesForLibrary as getPlaybookTemplates } from "@/lib/playbooks/service";
import { getTemplatesForLibrary as getTimelineTemplates } from "@/lib/timeline-templates/service";
import { getTemplatesForLibrary as getFloorPlanTemplates } from "@/lib/floor-plan-templates/service";
import { getPackages } from "@/lib/packages/service";
import { getItemsForLibrary } from "@/lib/inventory/service";
import { getTemplates as getInventoryTemplates } from "@/lib/event-inventory/service";
import { getTemplates as getQuestionnaireTemplates } from "@/lib/questionnaire-templates/service";
import { getQrCampaigns } from "@/lib/qr-campaigns/service";
import { listPublicForms } from "@/lib/public-forms/service";
import { getTemplates as getEventOrderTemplates } from "@/lib/event-order-templates/service";
import { getBrochures } from "@/lib/brochures/service";
import { getSavedReports } from "@/lib/saved-reports/service";
import { ensureBrochureStartersForCurrentVenue } from "@/lib/brochures/provision";
import { ensureSavedReportStartersForCurrentVenue } from "@/lib/saved-reports/provision";
import { ensureOfferingStartersForCurrentVenue } from "@/lib/offerings/provision";
import { listOfferings } from "@/lib/offerings/service";

export const metadata: Metadata = { title: "Library" };

type LibraryCard = {
  title: string;
  description: string;
  href?: string;
  count?: number;
  icon: React.ElementType;
  kind?: "template" | "catalog" | "primary";
  secondaryHref?: string;
  secondaryLabel?: string;
};

function ToolboxCard({
  title, description, href, count, icon: Icon, kind, secondaryHref, secondaryLabel,
}: LibraryCard) {
  const inner = (
    <>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          {href ? (
            <Link href={href} className="htc-record-link text-sm font-medium">
              {title}
            </Link>
          ) : (
            <p className="htc-record-link text-sm font-medium">{title}</p>
          )}
          {kind === "template" && <Badge variant="accent" className="text-[10px]">Template</Badge>}
          {kind === "catalog" && <Badge variant="outline" className="text-[10px]">Catalog</Badge>}
          {count !== undefined && <Badge variant="muted">{count}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
        {secondaryHref && secondaryLabel ? (
          <p className="pt-1 text-xs">
            <Link
              href={secondaryHref}
              className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {secondaryLabel}
            </Link>
          </p>
        ) : null}
      </div>
    </>
  );

  // Avoid nested <a> when a secondary link is present.
  if (href && !secondaryHref) {
    return (
      <Link href={href} className="htc-record-card-link group">
        <div className="htc-toolbox-card flex h-full items-start gap-3 rounded-sm border border-border p-4">
          {inner}
        </div>
      </Link>
    );
  }

  return (
    <div className="htc-toolbox-card flex h-full items-start gap-3 rounded-sm border border-border p-4">
      {inner}
    </div>
  );
}

function Group({
  title,
  children,
  compact,
}: {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className="space-y-3" data-testid={`library-group-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className={compact ? "grid gap-2 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-2 sm:grid-cols-1 md:grid-cols-1"}>
        {children}
      </div>
    </section>
  );
}

export default async function LibraryPage() {
  await Promise.all([
    ensureBrochureStartersForCurrentVenue(),
    ensureSavedReportStartersForCurrentVenue(),
    ensureOfferingStartersForCurrentVenue(),
  ]);
  const [
    contractTemplates, playbookTemplatesAll, timelineTemplatesAll, floorPlanTemplatesAll,
    packagesAll, inventoryItemsAll, qrCampaigns, publicForms, messageTemplates, inventoryTemplates,
    questionnaireTemplates, eventOrderTemplatesAll, brochuresAll, savedReports, offeringsAll,
  ] = await Promise.all([
    getContractTemplates(),
    getPlaybookTemplates(),
    getTimelineTemplates(),
    getFloorPlanTemplates(),
    getPackages(true),
    getItemsForLibrary(),
    getQrCampaigns(),
    listPublicForms(),
    getMessageTemplates(),
    getInventoryTemplates(),
    getQuestionnaireTemplates(),
    getEventOrderTemplates(true),
    getBrochures(true),
    getSavedReports(),
    listOfferings(true),
  ]);
  const eventOrderTemplates = eventOrderTemplatesAll.filter((t) => !t.isArchived);
  const brochures = brochuresAll.filter((b) => !b.isArchived);
  const playbookTemplatesCount = countActivePlanningLibraryTemplates(playbookTemplatesAll);
  const timelineTemplates = timelineTemplatesAll.filter((t) => !t.isArchived);
  const floorPlanTemplates = floorPlanTemplatesAll.filter((t) => !t.isArchived);
  const inventoryItems = inventoryItemsAll.filter((i) => !i.isArchived);
  const packages = packagesAll;
  const offerings = offeringsAll.filter((o) => !o.isArchived);
  const savedLists = inventoryTemplates.filter((t) => !t.isArchived);

  return (
    <div className="htc-hospitality-page space-y-6 sm:space-y-8" data-testid="library-commercial-ia">
      <div className="htc-hospitality-heading htc-hospitality-intro-accent">
        <PageHeader
          title="Library"
          description="What you sell, what you have, and what you deliver — reusable resources for bookings and events."
        />
      </div>

      <Group title="Sales">
        <ToolboxCard
          kind="primary"
          title="Packages & Pricing"
          description="Priced offers for proposals and contracts."
          href="/packages"
          count={packages.length}
          icon={Boxes}
        />
      </Group>

      <Group title="Stock">
        <ToolboxCard
          kind="primary"
          title="Available Inventory"
          description="Physical items your venue owns or can provide."
          href="/library/inventory"
          count={inventoryItems.length}
          icon={Package}
          secondaryHref="/library/inventory-templates"
          secondaryLabel={`Saved starting lists (${savedLists.length})`}
        />
      </Group>

      <Group title="Delivery">
        <ToolboxCard
          kind="primary"
          title="Event Order plans"
          description="Reusable delivery plans with included items and couple choices."
          href="/library/event-order-templates"
          count={eventOrderTemplates.length}
          icon={Layers}
          secondaryHref="/library/offerings"
          secondaryLabel={`Choices catalog (${offerings.length})`}
        />
      </Group>

      <Group title="Other templates & assets" compact>
        <ToolboxCard kind="template" title="Contract Templates" description="Reusable agreements with fill-in details." href="/library/contracts" count={contractTemplates.length} icon={FileSignature} />
        <ToolboxCard kind="template" title="Planning Templates" description="Client and venue planning checklists." href="/library/playbooks" count={playbookTemplatesCount} icon={BookOpen} />
        <ToolboxCard kind="template" title="Timeline Templates" description="Reusable day-of schedules." href="/library/timeline-templates" count={timelineTemplates.length} icon={CalendarClock} />
        <ToolboxCard kind="template" title="Floor Plan Templates" description="Reusable room layouts." href="/library/floor-plan-templates" count={floorPlanTemplates.length} icon={LayoutGrid} />
        <ToolboxCard kind="template" title="Questionnaires & Feedback" description="Client questionnaires and post-event feedback." href="/library/questionnaire-templates" count={questionnaireTemplates.length} icon={FileText} />
        <ToolboxCard kind="template" title="Message Templates" description="Emails and texts you send often." href="/communication/templates" count={messageTemplates.length} icon={Mail} />
        <ToolboxCard kind="catalog" title="Public Forms" description="Lead-capture forms for expos and open houses." href="/library/public-forms" count={publicForms.length} icon={ClipboardList} />
        <ToolboxCard kind="catalog" title="QR Campaigns" description="Printable QR codes with scan tracking." href="/library/qr-campaigns" count={qrCampaigns.length} icon={QrCode} />
        <ToolboxCard kind="catalog" title="Brochures" description="Brandable venue overviews." href="/library/brochures" count={brochures.length} icon={Megaphone} />
        <ToolboxCard title="Saved Reports" description="Reports you’ve saved to reopen quickly." href="/reporting/saved" count={savedReports.length} icon={FileText} />
      </Group>
    </div>
  );
}
