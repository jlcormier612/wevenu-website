"use client";

/**
 * Pre-Launch Commercial Readiness, Initiative 1 (2026-08-03) — the "Bring
 * Your Business" / "Your Offerings" / "Your Business Tools" / "Your People &
 * Business" stages of Guided Setup.
 *
 * These stages embed the existing Migration Center (components/settings/
 * import-wizard.tsx) directly inside the setup wizard, rather than linking
 * out to /settings/import — a mid-setup venue has a real (in-progress)
 * venue row by this point (see lib/venue/service.ts's saveSetupProgress),
 * but every other (app)/* route is still gated behind setup_completed, so
 * navigating away would just bounce back to /setup. Embedding is the only
 * safe way to offer migration during onboarding without touching that gate.
 *
 * Nothing here writes data through a new path — every import still goes
 * through ImportWizard's existing createClient_/createLead/createVendor/
 * createItem/createPackage calls, same duplicate detection, same batch
 * tracking. This file only adds: a source-identity question (populating the
 * existing-but-previously-unused import_batches.source_label column), a
 * documents-only "save the file, don't structure it" path, and the
 * status/shortcut screens for Offerings/Tools/People.
 */
import * as React from "react";
import {
  ArrowRight,
  Check,
  FileStack,
  FileText,
  Heart,
  Package,
  RefreshCw,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ImportWizard } from "@/components/settings/import-wizard";
import { saveVenueDocumentAction } from "@/app/(app)/documents/actions";
import { getSetupReadyCountsAction } from "@/app/setup/actions";
import { createClient } from "@/integrations/supabase/client";
import type { SetupReadyCounts } from "@/lib/venue/service";
import type { SetupStepId } from "@/lib/venue/validation";

const MAX_FILE_SIZE_MB = 25;

// ---- shared: real-count status line -----------------------------------------

export function useSetupReadyCounts() {
  const [counts, setCounts] = React.useState<SetupReadyCounts | null>(null);
  React.useEffect(() => {
    void getSetupReadyCountsAction().then(setCounts);
  }, []);
  return counts;
}

function ReadyLine({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <Check className="h-3 w-3" />
      </span>
      <span className="text-foreground">
        <span className="font-medium">{count}</span> {label}
      </span>
    </div>
  );
}

// ---- shared: source identity (Weven / other platform / spreadsheets / files / manual) ----

export type ImportSource = "weven" | "other_platform" | "spreadsheets" | "files" | "manual";

const SOURCE_OPTIONS: {
  id: ImportSource;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  label: string; // recorded on the import batch as source_label
}[] = [
  {
    id: "weven", icon: Heart, title: "Weven",
    description: "Welcome back — we'll make this transition smooth.",
    label: "Weven",
  },
  {
    id: "other_platform", icon: RefreshCw, title: "Another platform",
    description: "HoneyBook, Aisle Planner, or anything similar.",
    label: "Another platform",
  },
  {
    id: "spreadsheets", icon: FileStack, title: "Spreadsheets",
    description: "CSV or Excel exports you already have.",
    label: "Spreadsheet export",
  },
  {
    id: "files", icon: FileText, title: "Files or documents",
    description: "Contracts, PDFs, Word docs — we'll keep the originals safe.",
    label: "Uploaded files",
  },
  {
    id: "manual", icon: Sparkles, title: "I'll enter things myself",
    description: "No import needed — you're all set to continue.",
    label: "Manual entry",
  },
];

function OptionCard({
  icon: Icon, title, description, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/40 text-heading">
        <Icon className="h-5 w-5" />
      </span>
      <span className="space-y-0.5">
        <span className="block text-sm font-medium text-heading">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

// ---- documents-only path (Part 8 — save the original, don't structure it) ----

function DocumentsUploadStep({ onDone }: { onDone: () => void }) {
  const [uploading, setUploading] = React.useState(false);
  const [saved, setSaved] = React.useState<string[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const supabase = createClient();
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} is too large (max ${MAX_FILE_SIZE_MB} MB).`);
        continue;
      }
      const docId = crypto.randomUUID();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const storagePath = `venue/${docId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, file, { upsert: false, contentType: file.type });
      if (uploadError) {
        toast.error(`Could not upload ${file.name}: ${uploadError.message}`);
        continue;
      }
      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(storagePath);
      const result = await saveVenueDocumentAction({
        name: file.name.replace(/\.[^.]+$/, ""),
        category: "other",
        notes: "Brought over during setup.",
        // Reliable marker for the Setup Hub "you brought over N files" nudge
        // (client-experience stage) — a real tag to filter on, not the notes
        // string above, which is prose, not a stable machine-readable key.
        tags: "setup_import",
        expiresAt: "",
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storagePath,
        storageUrl: urlData.publicUrl,
      });
      if (result.ok) {
        setSaved((prev) => [...prev, file.name]);
      } else {
        toast.error(result.message ?? `Could not save ${file.name}.`);
        await supabase.storage.from("documents").remove([storagePath]);
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Bring your files</h2>
        <p className="text-sm text-muted-foreground">
          Contracts, PDFs, Word docs — anything that doesn&apos;t fit neatly into a
          spreadsheet. We&apos;ll save the originals exactly as they are in your
          Documents library. Nothing is turned into a contract, template, or
          package automatically — that stays a step only you take.
        </p>
      </div>

      <label
        htmlFor="setup-doc-upload"
        className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/40 hover:bg-muted/20"
      >
        <Upload className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          {uploading ? "Uploading…" : "Click to choose files, or drag them here"}
        </span>
        <span className="text-xs text-muted-foreground">Up to {MAX_FILE_SIZE_MB} MB each</span>
        <input
          id="setup-doc-upload"
          ref={fileRef}
          type="file"
          multiple
          className="sr-only"
          disabled={uploading}
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </label>

      {saved.length > 0 && (
        <div className="rounded-lg border border-border p-3 space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Saved as original files
          </p>
          {saved.map((name) => (
            <div key={name} className="flex items-center gap-2 text-sm text-foreground">
              <Check className="h-3.5 w-3.5 text-success" />
              {name}
            </div>
          ))}
        </div>
      )}

      <Button type="button" onClick={onDone} disabled={uploading}>
        {saved.length > 0 ? "Continue setting up" : "Skip for now"}
        <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}

// ---- Stage 2: Bring Your Business -------------------------------------------

export function BringYourBusinessStep({
  onAdvance,
  onPersonaHint,
}: {
  onAdvance: () => void;
  /** Picking "Weven" here is a real signal even for a venue that chose "starting fresh" up front — nudges onboarding_persona without ever overwriting an explicit later choice. */
  onPersonaHint: (persona: "switching" | "weven_returning") => void;
}) {
  const [choice, setChoice] = React.useState<"unset" | "yes" | "no">("unset");
  const [source, setSource] = React.useState<ImportSource | null>(null);

  if (choice === "unset") {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-4">
        <div className="space-y-2 text-center">
          <h1 className="font-heading text-2xl font-medium tracking-tight text-heading">
            Bring your business to Hello to Cheers
          </h1>
          <p className="text-sm text-muted-foreground">
            Already have years of information somewhere else? Start with what
            you have. We&apos;ll help organize it here.
          </p>
        </div>
        <p className="text-center text-sm font-medium text-foreground">
          Do you already have information you&apos;d like to bring in?
        </p>
        <div className="mx-auto flex max-w-sm flex-col gap-3 sm:flex-row">
          <Button type="button" size="lg" className="flex-1" onClick={() => setChoice("yes")}>
            Yes — help me bring it over
          </Button>
          <Button type="button" size="lg" variant="outline" className="flex-1" onClick={() => { setChoice("no"); onAdvance(); }}>
            Not right now
          </Button>
        </div>
      </div>
    );
  }

  if (choice === "yes" && !source) {
    return (
      <div className="mx-auto max-w-xl space-y-6 py-4">
        <div className="space-y-2 text-center">
          <h1 className="font-heading text-2xl font-medium tracking-tight text-heading">
            Where is your information coming from?
          </h1>
          <p className="text-sm text-muted-foreground">
            This just helps us guide you to the right place.
          </p>
        </div>
        <div className="space-y-3">
          {SOURCE_OPTIONS.map((opt) => (
            <OptionCard
              key={opt.id}
              icon={opt.icon}
              title={opt.title}
              description={opt.description}
              onClick={() => {
                setSource(opt.id);
                if (opt.id === "weven") onPersonaHint("weven_returning");
                else if (opt.id === "other_platform" || opt.id === "spreadsheets" || opt.id === "files") onPersonaHint("switching");
                if (opt.id === "manual") onAdvance();
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setChoice("unset")}
          className="mx-auto block text-xs text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>
      </div>
    );
  }

  if (source === "files") {
    return <DocumentsUploadStep onDone={onAdvance} />;
  }

  if (source) {
    const meta = SOURCE_OPTIONS.find((o) => o.id === source);
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {meta?.title === "Weven"
            ? "We know exactly what that transition feels like — let's make it easy. Upload a CSV or Excel export (or paste what you have), and we'll help map it into place."
            : "Upload a CSV or Excel export from where you're coming from (or paste what you have), and we'll help map it into place."}
        </p>
        <ImportWizard embedded sourceLabel={meta?.label} onDone={onAdvance} />
        <button
          type="button"
          onClick={() => setSource(null)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Choose a different source
        </button>
      </div>
    );
  }

  return null;
}

// ---- Stage 3: Your Offerings -------------------------------------------------

export function YourOfferingsStep({ goToStep }: { goToStep?: (step: SetupStepId) => void }) {
  const counts = useSetupReadyCounts();
  const hasOfferings = !!counts && (counts.packages > 0 || counts.inventory > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/40 text-heading">
          <Package className="h-4.5 w-4.5" />
        </span>
        <p className="text-sm text-muted-foreground">
          Your packages and inventory are what couples see and what your team
          books against — worth having in place early, but not required to
          continue.
        </p>
      </div>

      {counts === null ? (
        <p className="text-sm text-muted-foreground">Checking what you already have…</p>
      ) : hasOfferings ? (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <ReadyLine count={counts.packages} label="packages ready" />
          <ReadyLine count={counts.inventory} label="inventory items ready" />
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <p className="text-sm text-foreground">
            No packages or inventory yet — that&apos;s completely fine.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" size="sm" variant="outline" onClick={() => goToStep?.("bring-your-business")}>
              Bring these over now
            </Button>
            <p className="self-center text-xs text-muted-foreground">
              or add them anytime from the Library once you&apos;re in.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Stage 4: Your Business Tools -------------------------------------------

export function BusinessToolsStep({ goToStep }: { goToStep?: (step: SetupStepId) => void }) {
  const counts = useSetupReadyCounts();
  const hasTools = !!counts && (counts.contractTemplates > 0 || counts.communicationTemplates > 0 || counts.playbookTemplates > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/40 text-heading">
          <FileText className="h-4.5 w-4.5" />
        </span>
        <p className="text-sm text-muted-foreground">
          Contract wording, message wording, and planning checklists — the
          reusable tools your team relies on for every event.
        </p>
      </div>

      {counts === null ? (
        <p className="text-sm text-muted-foreground">Checking what you already have…</p>
      ) : hasTools ? (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <ReadyLine count={counts.contractTemplates} label="contract templates ready" />
          <ReadyLine count={counts.communicationTemplates} label="communication templates ready" />
          <ReadyLine count={counts.playbookTemplates} label="planning templates ready" />
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <p className="text-sm text-foreground">
            Bring over what you already use — or start fresh. Either way,
            nothing here is required to continue.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" size="sm" variant="outline" onClick={() => goToStep?.("bring-your-business")}>
              Bring my files over now
            </Button>
            <p className="self-center text-xs text-muted-foreground">
              or start fresh — once you&apos;re in, Contracts, Message
              Templates, and Planning each have their own &quot;Bring your
              existing wording&quot; option to turn what you brought over into
              a real template.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Stage 5: Your People & Business -----------------------------------------

export function YourPeopleStep({ goToStep }: { goToStep?: (step: SetupStepId) => void }) {
  const counts = useSetupReadyCounts();
  const hasPeople = !!counts && (counts.contacts > 0 || counts.vendorRelationships > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/40 text-heading">
          <Users className="h-4.5 w-4.5" />
        </span>
        <p className="text-sm text-muted-foreground">
          The people who make up your business — contacts, vendors, and the
          events already on your books.
        </p>
      </div>

      {counts === null ? (
        <p className="text-sm text-muted-foreground">Checking what you already have…</p>
      ) : (
        <div className="space-y-2 rounded-lg border border-border p-4">
          <ReadyLine count={counts.contacts} label="contacts ready" />
          <ReadyLine count={counts.vendorRelationships} label="vendor relationships ready" />
          <ReadyLine count={counts.upcomingEvents} label="upcoming events ready" />
          {!hasPeople && (
            <p className="text-sm text-foreground">Nothing yet — that&apos;s okay.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="button" size="sm" variant="outline" onClick={() => goToStep?.("bring-your-business")}>
          Bring contacts or vendors over
        </Button>
        <p className="self-center text-xs text-muted-foreground">
          Booked events aren&apos;t part of import yet — add your first one from
          Events once you&apos;re in.
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        You can invite your team from Settings once you&apos;re in the workspace.
      </p>
    </div>
  );
}

export { SOURCE_OPTIONS };
