import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PORTAL_INVITE_CTA,
  PORTAL_INVITE_TITLE,
  PORTAL_UNOPENED_CTA,
  PORTAL_UNOPENED_TITLE,
  VENUE_NEXT_STEPS_CAP,
  collectVenueNextSteps,
  portalLifecycleForClient,
  resolveVenueNextSteps,
  type PortalClientInput,
  type VenueNextStepsSnapshot,
  type VenueTaskInput,
} from "@/lib/dashboard/venue-next-steps";

const TODAY = "2026-09-01";

function client(partial: Partial<PortalClientInput> & Pick<PortalClientInput, "id">): PortalClientInput {
  return {
    status: "planning",
    name: "Sara Parker & Peter Parker",
    invitationSent: false,
    portalOpened: false,
    ...partial,
  };
}

function task(partial: Partial<VenueTaskInput> & Pick<VenueTaskInput, "id" | "title">): VenueTaskInput {
  return {
    dueDate: TODAY,
    eventId: "event-1",
    eventName: "Wedding",
    clientName: "Sara Parker & Peter Parker",
    ownerType: "coordinator",
    status: "pending",
    ...partial,
  };
}

function snapshot(partial: Partial<VenueNextStepsSnapshot> = {}): VenueNextStepsSnapshot {
  return {
    today: TODAY,
    clients: [],
    venueTasks: [],
    leadFollowUps: [],
    ...partial,
  };
}

describe("portal lifecycle", () => {
  it("State 1: No clients → no client invitation item", () => {
    const { visible } = resolveVenueNextSteps(snapshot());
    assert.equal(visible.some((i) => i.title === PORTAL_INVITE_TITLE), false);
    assert.equal(visible.some((i) => i.title === PORTAL_UNOPENED_TITLE), false);
  });

  it("State 2: One booked client, portal not invited → one Invite your couple item", () => {
    const { visible } = resolveVenueNextSteps(snapshot({
      clients: [client({ id: "c1", invitationSent: false, portalOpened: false })],
    }));
    const portal = visible.filter((i) => i.subjectKey.startsWith("portal:"));
    assert.equal(portal.length, 1);
    assert.equal(portal[0]!.title, PORTAL_INVITE_TITLE);
    assert.equal(portal[0]!.priority, "venue");
    assert.equal(portal[0]!.ctaLabel, PORTAL_INVITE_CTA);
    assert.equal(portal[0]!.href, "/clients/c1");
    assert.doesNotMatch(portal[0]!.title, /first couple/i);
    assert.doesNotMatch(portal[0]!.description, /first couple/i);
  });

  it("State 3: Invitation sent, portal not opened → unopened item; invitation item disappears", () => {
    const { visible } = resolveVenueNextSteps(snapshot({
      clients: [client({ id: "c1", invitationSent: true, portalOpened: false })],
    }));
    const portal = visible.filter((i) => i.subjectKey.startsWith("portal:"));
    assert.equal(portal.length, 1);
    assert.equal(portal[0]!.title, PORTAL_UNOPENED_TITLE);
    assert.equal(portal[0]!.priority, "shared");
    assert.equal(portal[0]!.ctaLabel, PORTAL_UNOPENED_CTA);
    assert.equal(visible.some((i) => i.title === PORTAL_INVITE_TITLE), false);
  });

  it("State 4: Portal opened → both portal-related items disappear", () => {
    const { visible } = resolveVenueNextSteps(snapshot({
      clients: [client({ id: "c1", invitationSent: true, portalOpened: true })],
    }));
    assert.equal(visible.some((i) => i.subjectKey.startsWith("portal:")), false);
  });

  it("treats invite and unopened as one lifecycle, never two slots for the same client", () => {
    assert.equal(portalLifecycleForClient(client({ id: "c1", invitationSent: false, portalOpened: false })), "invite");
    assert.equal(portalLifecycleForClient(client({ id: "c1", invitationSent: true, portalOpened: false })), "unopened");
    assert.equal(portalLifecycleForClient(client({ id: "c1", invitationSent: true, portalOpened: true })), "opened");
    const both = collectVenueNextSteps(snapshot({
      clients: [client({ id: "c1", invitationSent: true, portalOpened: false })],
    }));
    assert.equal(both.filter((i) => i.subjectKey === "portal:c1").length, 1);
  });

  it("skips cancelled clients", () => {
    const { visible } = resolveVenueNextSteps(snapshot({
      clients: [client({ id: "c1", status: "cancelled", invitationSent: false })],
    }));
    assert.equal(visible.length, 0);
  });
});

describe("priority and cap", () => {
  it("State 5: overdue venue task + unopened portal → overdue venue task before the portal item", () => {
    const { visible } = resolveVenueNextSteps(snapshot({
      clients: [client({ id: "c1", invitationSent: true, portalOpened: false })],
      venueTasks: [task({ id: "t1", title: "Send floor plan", dueDate: "2026-08-20", status: "overdue", ownerType: "coordinator" })],
    }));
    assert.ok(visible.length >= 2);
    assert.equal(visible[0]!.title, "Send floor plan");
    assert.equal(visible[0]!.priority, "venue");
    assert.equal(visible[1]!.title, PORTAL_UNOPENED_TITLE);
    assert.equal(visible[1]!.priority, "shared");
  });

  it("State 6: no venue-required actions but couple has a shared planning action → shared planning item appears", () => {
    const { visible } = resolveVenueNextSteps(snapshot({
      clients: [client({ id: "c1", invitationSent: true, portalOpened: true })],
      venueTasks: [task({ id: "t1", title: "Submit guest count", ownerType: "couple", dueDate: "2026-09-10" })],
    }));
    assert.equal(visible.length, 1);
    assert.equal(visible[0]!.title, "Submit guest count");
    assert.equal(visible[0]!.priority, "shared");
  });

  it("State 7: multiple actionable items → maximum 5, P1 then overdue/today/tomorrow/soonest/undated", () => {
    const { visible, total } = resolveVenueNextSteps(snapshot({
      venueTasks: [
        task({ id: "undated", title: "Undated venue", dueDate: null }),
        task({ id: "soon", title: "Soon venue", dueDate: "2026-09-20" }),
        task({ id: "tom", title: "Tomorrow venue", dueDate: "2026-09-02" }),
        task({ id: "today", title: "Today venue", dueDate: TODAY }),
        task({ id: "late", title: "Overdue venue", dueDate: "2026-08-01", status: "overdue" }),
        task({ id: "shared1", title: "Shared soon", ownerType: "couple", dueDate: "2026-08-01", status: "overdue" }),
      ],
    }));
    assert.ok(total > VENUE_NEXT_STEPS_CAP);
    assert.equal(visible.length, 5);
    assert.deepEqual(visible.map((i) => i.id), [
      "task-late",
      "task-today",
      "task-tom",
      "task-soon",
      "task-undated",
    ]);
  });

  it("State 8: resolving an item removes it and the next eligible item takes its place", () => {
    const tasks = [
      task({ id: "a", title: "A", dueDate: "2026-08-01", status: "overdue" }),
      task({ id: "b", title: "B", dueDate: TODAY }),
      task({ id: "c", title: "C", dueDate: "2026-09-02" }),
      task({ id: "d", title: "D", dueDate: "2026-09-10" }),
      task({ id: "e", title: "E", dueDate: "2026-09-20" }),
      task({ id: "f", title: "F", dueDate: null }),
    ];
    const before = resolveVenueNextSteps(snapshot({ venueTasks: tasks }));
    assert.deepEqual(before.visible.map((i) => i.id), ["task-a", "task-b", "task-c", "task-d", "task-e"]);
    const after = resolveVenueNextSteps(snapshot({
      venueTasks: tasks.filter((t) => t.id !== "a"),
    }));
    assert.deepEqual(after.visible.map((i) => i.id), ["task-b", "task-c", "task-d", "task-e", "task-f"]);
  });

  it("does not surface vendor-owned personal work", () => {
    const { visible } = resolveVenueNextSteps(snapshot({
      venueTasks: [task({ id: "v1", title: "Confirm rentals", ownerType: "vendor" })],
    }));
    assert.equal(visible.length, 0);
  });

  it("does not invent first-couple language when several clients need action", () => {
    const { visible } = resolveVenueNextSteps(snapshot({
      clients: [
        client({ id: "c1", name: "Alex & Jordan" }),
        client({ id: "c2", name: "Sam & Riley" }),
      ],
    }));
    assert.equal(visible.length, 2);
    assert.ok(visible.every((i) => i.title === PORTAL_INVITE_TITLE));
    assert.ok(visible.every((i) => !/first couple/i.test(i.title + i.description)));
  });
});
