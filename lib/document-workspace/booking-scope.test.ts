import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  isBookingDocumentsScope,
  matchesBookingRelationshipScope,
} from "@/lib/document-workspace/booking-scope";
import { EXPERIENCE_STATUS_LABEL, experienceBadgeLabel } from "@/lib/document-workspace/experience";
import {
  applyQuestionnaireWorkspaceNames,
  questionnaireWorkspaceDocumentName,
} from "@/lib/document-workspace/questionnaire-names";

const root = process.cwd();
const bookingMigration = readFileSync(
  join(root, "supabase/migrations/20261411800000_venue_documents_booking_relationship_scope.sql"),
  "utf8",
);
const couplePortalMigration = readFileSync(
  join(root, "supabase/migrations/20261407500000_invoice_display_name_portal.sql"),
  "utf8",
);
const clientPage = readFileSync(join(root, "app/(app)/clients/[id]/page.tsx"), "utf8");
const documentsPage = readFileSync(join(root, "app/(app)/documents/page.tsx"), "utf8");
const leadsPage = readFileSync(join(root, "app/(app)/leads/[id]/page.tsx"), "utf8");
const vendorsPage = readFileSync(join(root, "app/(app)/vendors/[id]/page.tsx"), "utf8");

const BOOKING = {
  eventId: "event-a",
  clientId: "client-a",
};

describe("booking Documents relationship scope", () => {
  it("1–2. client-linked contract/invoice with event_id NULL match booking scope", () => {
    assert.equal(
      matchesBookingRelationshipScope({ eventId: null, clientId: "client-a" }, BOOKING),
      true,
    );
  });

  it("3–4. event-linked contract/invoice match booking scope", () => {
    assert.equal(
      matchesBookingRelationshipScope({ eventId: "event-a", clientId: "client-a" }, BOOKING),
      true,
    );
    assert.equal(
      matchesBookingRelationshipScope({ eventId: "event-a", clientId: null }, BOOKING),
      true,
    );
  });

  it("5. other-event commercial docs do not leak", () => {
    assert.equal(
      matchesBookingRelationshipScope({ eventId: "event-b", clientId: "client-a" }, BOOKING),
      false,
    );
    assert.equal(
      matchesBookingRelationshipScope({ eventId: null, clientId: "client-b" }, BOOKING),
      false,
    );
  });

  it("6–7. questionnaires remain kind-named and in booking via event match", () => {
    assert.equal(
      matchesBookingRelationshipScope({ eventId: "event-a", clientId: "client-a" }, BOOKING),
      true,
    );
    const named = applyQuestionnaireWorkspaceNames(
      [
        { docType: "questionnaire", id: "1", name: "x", kind: "client_planning" },
        { docType: "questionnaire", id: "2", name: "x", kind: "final_details" },
        { docType: "questionnaire", id: "3", name: "x", kind: "post_event_feedback" },
      ],
      new Map([
        ["1", "client_planning"],
        ["2", "final_details"],
        ["3", "post_event_feedback"],
      ]),
    );
    assert.deepEqual(named.map((r) => r.name), [
      "Client Planning Questionnaire",
      "Final Details",
      "Post-Event Feedback",
    ]);
    assert.equal(questionnaireWorkspaceDocumentName("final_details"), "Final Details");
  });

  it("8–9. portal couple-docs still client + is_couple_visible; Waiting on Client intact", () => {
    assert.match(couplePortalMigration, /c\.client_id = v_ids\.client_id/);
    assert.match(couplePortalMigration, /c\.is_couple_visible = true/);
    assert.match(couplePortalMigration, /i\.client_id = v_ids\.client_id/);
    assert.match(couplePortalMigration, /i\.is_couple_visible = true/);
    assert.equal(EXPERIENCE_STATUS_LABEL.with_someone, "Waiting on Client");
    assert.equal(experienceBadgeLabel("with_someone", "contract"), "Waiting on Client");
  });

  it("10. booking page passes eventId+clientId; global/lead/vendor scopes unchanged", () => {
    assert.equal(isBookingDocumentsScope({ eventId: "e", clientId: "c" }), true);
    assert.equal(isBookingDocumentsScope({ eventId: "e" }), false);
    assert.equal(isBookingDocumentsScope({ leadId: "l" }), false);
    assert.match(
      clientPage,
      /getVenueWorkspaceDocuments\(\{\s*eventId,\s*clientId:\s*id\s*\}\)/,
    );
    assert.match(documentsPage, /getVenueWorkspaceDocuments\(\)/);
    assert.match(leadsPage, /getVenueWorkspaceDocuments\(\{\s*leadId:\s*id\s*\}\)/);
    assert.match(vendorsPage, /getVenueWorkspaceDocuments\(\{\s*vendorId:\s*id\s*\}\)/);
  });

  it("11–12. conversation attachments stay excluded; migration does not insert producer rows", () => {
    assert.doesNotMatch(bookingMigration, /conversation_message_attachments/);
    assert.doesNotMatch(bookingMigration, /insert into public\.(contracts|invoices)/i);
    assert.match(
      bookingMigration,
      /when p_event_id is not null and p_client_id is not null then/,
    );
    assert.match(
      bookingMigration,
      /c\.event_id is null and c\.client_id = p_client_id/,
    );
    assert.match(
      bookingMigration,
      /i\.event_id is null and i\.client_id = p_client_id/,
    );
    // Questionnaires still project by kind — naming fix preserved.
    assert.match(bookingMigration, /when 'client_planning' then 'Client Planning Questionnaire'/);
    assert.match(bookingMigration, /when 'final_details' then 'Final Details'/);
    assert.match(bookingMigration, /when 'post_event_feedback' then 'Post-Event Feedback'/);
  });
});
