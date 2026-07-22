import Link from "next/link";

import { LibraryExperience } from "@/components/communications/library-experience";
import {
  DataTable,
  PageHeader,
  Panel,
  RelationshipLink,
  StatusPill,
} from "@/components/shared/ui";
import { getCommunications, getRelationship } from "@/lib/data/store";
import {
  ensureProgram3Data,
  getBrandingSync,
  getCategoriesSync,
  getSequencesSync,
  getTemplatesSync,
} from "@/lib/program3/store";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Communications" };

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  contact_form: "Contact form",
  walkthrough_request: "Walkthrough request",
  newsletter: "Newsletter",
  support: "Support",
  manual_note: "Manual note",
  internal_comment: "Internal comment",
};

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await ensureProgram3Data();
  const params = await searchParams;
  const tab = params.tab === "library" ? "library" : "history";
  const communications = getCommunications();

  return (
    <div>
      <PageHeader
        eyebrow="Communications"
        title={tab === "library" ? "Communication library" : "Unified history"}
        description={
          tab === "library"
            ? "Reusable templates and sequences — relative delays or absolute calendar sends. Enroll from a relationship or /sequences."
            : "Emails, forms, walkthrough requests, support, notes, and internal comments — all belonging to one relationship, not module silos."
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/communications"
          className={
            tab === "history"
              ? "rounded-sm bg-[var(--forest-sage)] px-3 py-1.5 text-sm text-[var(--true-white)]"
              : "rounded-sm bg-[var(--true-white)] px-3 py-1.5 text-sm ring-1 ring-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)]"
          }
        >
          History
        </Link>
        <Link
          href="/communications?tab=library"
          className={
            tab === "library"
              ? "rounded-sm bg-[var(--forest-sage)] px-3 py-1.5 text-sm text-[var(--true-white)]"
              : "rounded-sm bg-[var(--true-white)] px-3 py-1.5 text-sm ring-1 ring-[color-mix(in_srgb,var(--taupe-medium)_50%,transparent)]"
          }
        >
          Library
        </Link>
      </div>

      {tab === "library" ? (
        <LibraryExperience
          templates={getTemplatesSync()}
          sequences={getSequencesSync()}
          categories={getCategoriesSync()}
          branding={getBrandingSync()}
        />
      ) : (
        <Panel>
          <DataTable
            headers={["When", "Relationship", "Channel", "Subject", "Direction", "From"]}
            rows={communications.map((c) => {
              const rel = getRelationship(c.relationshipId);
              return [
                formatDateTime(c.occurredAt),
                rel ? (
                  <RelationshipLink id={rel.id} name={rel.venue.name} />
                ) : (
                  c.relationshipId
                ),
                <StatusPill key={`${c.id}-ch`}>
                  {CHANNEL_LABELS[c.channel] ?? c.channel}
                </StatusPill>,
                <div key={`${c.id}-sub`}>
                  <p className="font-medium">{c.subject}</p>
                  <p className="mt-1 line-clamp-2 text-xs ws-muted">{c.body}</p>
                </div>,
                c.direction,
                c.authorName ?? "—",
              ];
            })}
          />
        </Panel>
      )}
    </div>
  );
}
