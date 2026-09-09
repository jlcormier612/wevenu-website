import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  normalizeVenueNotificationHref,
  venueMessageNotificationHref,
} from "@/lib/notifications/venue-deep-links";

describe("venue message notification deep links", () => {
  it("opens Booking Conversation when a client record exists", () => {
    assert.equal(
      venueMessageNotificationHref({
        conversationId: "c1",
        clientId: "client-1",
        leadId: "lead-1",
      }),
      "/clients/client-1#messages",
    );
  });

  it("opens Lead Conversation when only a lead record exists", () => {
    assert.equal(
      venueMessageNotificationHref({
        conversationId: "c1",
        clientId: null,
        leadId: "lead-9",
      }),
      "/leads/lead-9#messages",
    );
  });

  it("opens Inbox with the exact conversation when no Conversation surface exists", () => {
    assert.equal(
      venueMessageNotificationHref({
        conversationId: "convo-42",
        clientId: null,
        leadId: null,
      }),
      "/messaging?conversation=convo-42",
    );
  });
});

describe("normalizeVenueNotificationHref", () => {
  it("upgrades bare booking/lead message links to #messages", () => {
    assert.equal(
      normalizeVenueNotificationHref("/clients/abc", "message_received"),
      "/clients/abc#messages",
    );
    assert.equal(
      normalizeVenueNotificationHref("/leads/xyz", "message_received"),
      "/leads/xyz#messages",
    );
  });

  it("preserves an already-deep message link", () => {
    assert.equal(
      normalizeVenueNotificationHref("/clients/abc#messages", "message_received"),
      "/clients/abc#messages",
    );
  });

  it("keeps Inbox conversation query for orphan threads", () => {
    assert.equal(
      normalizeVenueNotificationHref("/messaging?conversation=c9", "message_received"),
      "/messaging?conversation=c9",
    );
  });

  it("maps legacy ?tab= onto Booking hash tabs for action notifications", () => {
    assert.equal(
      normalizeVenueNotificationHref("/events/e1?tab=playbook", "task_completed_couple"),
      "/events/e1#playbook",
    );
    assert.equal(
      normalizeVenueNotificationHref("/events/e1?tab=feedback", "feedback_received"),
      "/events/e1#feedback",
    );
    assert.equal(
      normalizeVenueNotificationHref("/events/e1?tab=final-details", "rsvp_received"),
      "/events/e1#documents",
    );
  });

  it("adds a surface hash for overview-only action links by type", () => {
    assert.equal(
      normalizeVenueNotificationHref("/events/e1", "questionnaire_submitted"),
      "/events/e1#playbook",
    );
    assert.equal(
      normalizeVenueNotificationHref("/events/e1", "final_guest_count_submitted"),
      "/events/e1#playbook",
    );
    assert.equal(
      normalizeVenueNotificationHref("/events/e1", "contract_signed"),
      "/events/e1#documents",
    );
    assert.equal(
      normalizeVenueNotificationHref("/events/e1", "rsvp_received"),
      "/events/e1#documents",
    );
  });
});

describe("RSVP notification CTA vs destination", () => {
  it("does not claim Guest List when the action opens Documents", () => {
    const bell = readFileSync(resolve("components/shell/notification-bell.tsx"), "utf8");
    const sql = readFileSync(
      resolve("supabase/migrations/20261360000000_notification_action_deep_links.sql"),
      "utf8",
    );
    const rsvpFn = sql.slice(sql.indexOf("_trigger_rsvp_notification"));

    assert.match(rsvpFn, /#documents/);
    assert.doesNotMatch(rsvpFn, /guest.?list/i);
    assert.equal(
      normalizeVenueNotificationHref("/events/e1#documents", "rsvp_received"),
      "/events/e1#documents",
    );

    assert.match(bell, /rsvp_received:\s*"Open documents"/);
    assert.doesNotMatch(bell, /View guest list/);
    assert.doesNotMatch(
      bell.slice(bell.indexOf("rsvp_received"), bell.indexOf("rsvp_received") + 80),
      /guest list/i,
    );
  });
});

describe("notification / conversation UX seams", () => {
  it("NotificationBell routes through the deep-link normalizer", () => {
    const src = readFileSync(resolve("components/shell/notification-bell.tsx"), "utf8");
    assert.match(src, /normalizeVenueNotificationHref/);
    assert.match(src, /Reply to message/);
  });

  it("ConversationThread sticks to newest without yanking history readers", () => {
    const src = readFileSync(resolve("components/conversations/conversation-thread.tsx"), "utf8");
    assert.match(src, /stickToBottomRef/);
    assert.match(src, /scrollMessagesToBottom/);
    assert.match(src, /useLayoutEffect/);
    assert.doesNotMatch(src, /scrollIntoView\(\{ behavior: "smooth" \}\);\n  \}, \[messages\?\.length\]/);
  });

  it("Inbox default sort remains newest activity first", () => {
    const inbox = readFileSync(resolve("app/(app)/messaging/conversation-inbox.tsx"), "utf8");
    assert.match(inbox, /searchParams\.get\("conversation"\)/);
    const sql = readFileSync(resolve("supabase/migrations/20261357000000_inbox_product_filters.sql"), "utf8");
    assert.match(sql, /p_sort text default 'recent'/);
    assert.match(sql, /v_sort = 'recent' then e\.last_message_at end desc/);
  });

  it("SQL migration deep-links message notifications to Conversation / Inbox", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20261360000000_notification_action_deep_links.sql"),
      "utf8",
    );
    assert.match(sql, /#messages/);
    assert.match(sql, /\/messaging\?conversation=/);
    assert.match(sql, /#playbook/);
    assert.match(sql, /#feedback/);
    assert.match(sql, /#documents/);
    assert.doesNotMatch(
      sql.slice(sql.indexOf("_trigger_task_completed_notification")),
      /\?tab=playbook/,
    );

    const msgFn = sql.slice(
      sql.indexOf("_trigger_conversation_message_notification"),
      sql.indexOf("_trigger_message_notification"),
    );
    assert.match(msgFn, /\/clients\/' \|\| v_client_id::text \|\| '#messages'/);
    assert.match(msgFn, /\/leads\/' \|\| v_lead_id::text \|\| '#messages'/);
    assert.match(msgFn, /\/messaging\?conversation=' \|\| new\.conversation_id::text/);
  });
});
