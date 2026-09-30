import type { Metadata } from "next";
import Link from "next/link";

import {
  BookOpen, Boxes, CalendarClock, ClipboardList, FileSignature, FileText,
  Layers, LayoutGrid, Mail, Megaphone, Package, QrCode,
} from "lucide-react";

import { LibraryHowItWorks } from "@/components/library/library-guidance";
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
import { listPublicForms } from "@/lib/public-forms/service";
import { getTemplates as getEventOrderTemplates } from "@/lib/event-order-templates/service";
import { getBrochures } from "@/lib/brochures/service";
import { getSavedReports } from "@/lib/saved-reports/service";
import { ensureBrochureStartersForCurrentVenue } from "@/lib/brochures/provision";
import { ensureSavedReportStartersForCurrentVenue } from "@/lib/saved-reports/provision";
import { ensureOfferingStartersForCurrentVenue } from "@/lib/offerings/provision";
import { listOfferings } from "@/lib/offerings/service";

export const metadata: Metadata = { title: "Templates" };

type LibraryCard = {
  title: string;
  description: string;
  href?: string;
  count?: number;
  icon: React.ElementType;
  kind?: "template" | "catalog";
};

function ToolboxCard({ title, description, href, count, icon: Icon, kind }: LibraryCard) {
  const body = (
    <div className="flex h-full items-start gap-3 rounded-sm border border-border bg-card p-4 transition-colors hover:bg-muted/20">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-heading">{title}</p>
          {kind === "template" && <Badge variant="accent" className="text-[10px]">Template</Badge>}
          {kind === "catalog" && <Badge variant="outline" className="text-[10px]">Catalog</Badge>}
          {count !== undefined && <Badge variant="muted">{count}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function Group({
  title,
  guidance,
  children,
}: {
  title: string;
  guidance: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        <LibraryHowItWorks>{guidance}</LibraryHowItWorks>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">{children}</div>
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
  const playbookTemplates = playbookTemplatesAll.filter((t) => !t.isArchived);
  const timelineTemplates = timelineTemplatesAll.filter((t) => !t.isArchived);
  const floorPlanTemplates = floorPlanTemplatesAll.filter((t) => !t.isArchived);
  const inventoryItems = inventoryItemsAll.filter((i) => !i.isArchived);
  const packages = packagesAll;
  const offerings = offeringsAll.filter((o) => !o.isArchived);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Templates"
        description="Reusable things you create once and use again — templates you apply to events, plus catalogs and assets those templates pull from."
      />

      <Group
        title="Applyable templates"
        guidance="Templates are reusable starting points. Create one here, then use it when setting up an event. Applying always creates that event’s own editable copy."
      >
        <ToolboxCard kind="template" title="Contract Templates" description="Reusable agreements with fill-in details. Use creates a draft contract — send and sign later." href="/library/contracts" count={contractTemplates.length} icon={FileSignature} />
        <ToolboxCard kind="template" title="Planning Templates" description="Client Planning and Venue Planning checklists you refine once, then apply per booking." href="/library/playbooks" count={playbookTemplates.length} icon={BookOpen} />
        <ToolboxCard kind="template" title="Timeline Templates" description="Reusable day-of schedules. Use adds entries to an event timeline." href="/library/timeline-templates" count={timelineTemplates.length} icon={CalendarClock} />
        <ToolboxCard kind="template" title="Floor Plan Templates" description="Reusable room layouts. Use creates an event floor plan." href="/library/floor-plan-templates" count={floorPlanTemplates.length} icon={LayoutGrid} />
        <ToolboxCard kind="template" title="Event Order Templates" description="Commercial build sheets — fixed offerings and selectable groups. Use applies on the venue side; Send lets the client choose." href="/library/event-order-templates" count={eventOrderTemplates.length} icon={Layers} />
        <ToolboxCard kind="template" title="Inventory Templates" description="Reusable inventory setups built from Available Inventory. Use creates event inventory." href="/library/inventory-templates" count={inventoryTemplates.length} icon={Layers} />
        <ToolboxCard kind="template" title="Questionnaires & Feedback" description="Client questionnaires and post-event feedback you can send per booking." href="/library/questionnaire-templates" count={questionnaireTemplates.length} icon={FileText} />
        <ToolboxCard kind="template" title="Message Templates" description="Emails and texts you send often — pick one when composing." href="/communication/templates" count={messageTemplates.length} icon={Mail} />
      </Group>

      <Group
        title="Reusable assets & catalogs"
        guidance="These are reusable items your templates can pull from, or shareable assets (forms, QR codes, brochures). They are not applied like templates."
      >
        <ToolboxCard kind="catalog" title="Offerings" description="Menus, bar, services, and rentals. Event Order Templates select from here." href="/library/offerings" count={offerings.length} icon={Package} />
        <ToolboxCard kind="catalog" title="Packages" description="What you sell commercially — priced packages with inclusions." href="/packages" count={packages.length} icon={Boxes} />
        <ToolboxCard kind="catalog" title="Available Inventory" description="Physical stock your venue owns. Inventory templates and floor plans use these items." href="/library/inventory" count={inventoryItems.length} icon={Package} />
        <ToolboxCard kind="catalog" title="Public Forms" description="Lead-capture forms for expos and open houses. Share by link or as a QR destination." href="/library/public-forms" count={publicForms.length} icon={ClipboardList} />
        <ToolboxCard kind="catalog" title="QR Campaigns" description="Printable QR codes that send people to a Public Form, tour, website, or URL — with scan tracking." href="/library/qr-campaigns" count={qrCampaigns.length} icon={QrCode} />
        <ToolboxCard kind="catalog" title="Brochures" description="Brandable venue overviews. Download PDF or share a hosted link with a lead." href="/library/brochures" count={brochures.length} icon={Megaphone} />
        <ToolboxCard title="Saved Reports" description="Reports you’ve saved to reopen quickly or have delivered." href="/reporting/saved" count={savedReports.length} icon={FileText} />
      </Group>
    </div>
  );
}
