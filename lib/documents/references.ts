/**
 * What still depends on a Documents row — and, separately, on the storage
 * object underneath it.
 *
 * Those are two different questions, and conflating them is how you either
 * lose files or refuse deletions that were always safe:
 *
 *   - Some references need the *row*. Dropping it silently guts a venue-facing
 *     feature (a message template loses its attachment, a floor plan loses its
 *     background), so the delete is refused and explained instead.
 *
 *   - One reference needs the *file* and not the row. A conversation attachment
 *     records its own file_url, so an already-sent message keeps rendering
 *     after the Library row is gone — but only while the object survives. The
 *     row may go; the object must stay.
 *
 *   - Some references are history. A migration session records what an import
 *     touched; cascading it away costs nothing and needs no file.
 *
 * The invariant this exists to hold: never destroy a storage object while a
 * live product reference still depends on that object.
 */
import type { createClient } from "@/integrations/supabase/server";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type DocumentReferenceKind =
  | "conversation_attachment"
  | "message_template"
  | "playbook_task"
  | "event_task_context"
  | "timeline_entry"
  | "floor_plan"
  | "floor_plan_template"
  | "migration_session";

/**
 * blocks_delete    — a live venue-facing feature points at this row.
 * retains_storage  — the row may go, the storage object may not.
 * cascades_safely  — history; the FK cascade is the intended outcome.
 */
export type ReferenceSafety = "blocks_delete" | "retains_storage" | "cascades_safely";

export const DOCUMENT_REFERENCE_SAFETY: Record<DocumentReferenceKind, ReferenceSafety> = {
  // conversation_message_attachments.file_url — a text URL, no FK, so nothing
  // in the database stops the row from going away. An already-sent message is
  // not something the venue can retract, so the file has to outlive the row.
  conversation_attachment: "retains_storage",
  // FK cascade — the template would keep working but quietly lose the file it
  // was built to send.
  message_template: "blocks_delete",
  playbook_task: "blocks_delete",
  event_task_context: "blocks_delete",
  timeline_entry: "blocks_delete",
  // FK set null — the plan survives but renders without its background image.
  floor_plan: "blocks_delete",
  floor_plan_template: "blocks_delete",
  // FK cascade — an import audit trail, not a live surface, and it never needs
  // the file itself.
  migration_session: "cascades_safely",
};

/** How the refusal reads to the venue. Plural handled by the caller. */
export const DOCUMENT_REFERENCE_LABEL: Record<DocumentReferenceKind, string> = {
  conversation_attachment: "already-sent message",
  message_template: "message template",
  playbook_task: "planning template task",
  event_task_context: "task",
  timeline_entry: "timeline entry",
  floor_plan: "floor plan",
  floor_plan_template: "floor plan template",
  migration_session: "import session",
};

export type DocumentReferenceCount = { kind: DocumentReferenceKind; count: number };

export type DocumentDeletionPlan = {
  /** Refuse the delete; blocking tells the venue what to detach first. */
  blocked: boolean;
  blocking: DocumentReferenceCount[];
  /** Keep the object in the bucket even though the row is going away. */
  retainStorage: boolean;
  /** Everything found, including the harmless history references. */
  references: DocumentReferenceCount[];
};

/**
 * Decide from a reference set alone — no database, so the rules are testable
 * without fixtures and the classification stays the single source of truth.
 */
export function planDocumentDeletion(references: DocumentReferenceCount[]): DocumentDeletionPlan {
  const present = references.filter((r) => r.count > 0);
  const blocking = present.filter((r) => DOCUMENT_REFERENCE_SAFETY[r.kind] === "blocks_delete");
  const retainStorage = present.some(
    (r) => DOCUMENT_REFERENCE_SAFETY[r.kind] === "retains_storage",
  );
  return { blocked: blocking.length > 0, blocking, retainStorage, references: present };
}

/** "2 message templates and 1 floor plan" */
export function describeBlockingReferences(blocking: DocumentReferenceCount[]): string {
  const parts = blocking.map((r) => {
    const label = DOCUMENT_REFERENCE_LABEL[r.kind];
    return `${r.count} ${r.count === 1 ? label : `${label}s`}`;
  });
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const FK_SOURCES: { kind: DocumentReferenceKind; table: string; column: string }[] = [
  { kind: "message_template", table: "message_template_attachments", column: "document_id" },
  { kind: "playbook_task", table: "playbook_task_attachments", column: "document_id" },
  { kind: "event_task_context", table: "event_task_context_links", column: "document_id" },
  { kind: "timeline_entry", table: "timeline_entry_attachments", column: "document_id" },
  { kind: "migration_session", table: "migration_session_documents", column: "document_id" },
  { kind: "floor_plan", table: "floor_plans", column: "background_document_id" },
  { kind: "floor_plan_template", table: "floor_plan_templates", column: "background_document_id" },
];

/**
 * Count everything pointing at this document. RLS scopes each table to the
 * caller's venue, and documentId was already resolved within the venue, so no
 * additional venue predicate is needed here.
 *
 * A table that errors is reported as referenced rather than as zero — an
 * unreadable table must not be mistaken for permission to delete a file.
 */
export async function getVenueDocumentReferences(
  client: DbClient,
  input: { documentId: string; storagePath: string | null },
): Promise<DocumentReferenceCount[]> {
  const counts = await Promise.all(
    FK_SOURCES.map(async ({ kind, table, column }) => {
      const { count, error } = await client
        .from(table)
        .select(column, { count: "exact", head: true })
        .eq(column, input.documentId);
      if (error) return { kind, count: 1 };
      return { kind, count: count ?? 0 };
    }),
  );

  return [...counts, await countConversationAttachments(client, input.storagePath)];
}

/**
 * conversation_message_attachments stores a public URL, not a document_id, so
 * the storage path is the only thing tying the two together. Matching a
 * substring rather than the exact URL keeps a signed/derived variant from
 * reading as "unreferenced" — over-matching only ever preserves a file, which
 * is the direction to fail in.
 */
async function countConversationAttachments(
  client: DbClient,
  storagePath: string | null,
): Promise<DocumentReferenceCount> {
  if (!storagePath) return { kind: "conversation_attachment", count: 0 };
  const { count, error } = await client
    .from("conversation_message_attachments")
    .select("id", { count: "exact", head: true })
    .like("file_url", `%${storagePath}%`);
  if (error) return { kind: "conversation_attachment", count: 1 };
  return { kind: "conversation_attachment", count: count ?? 0 };
}
