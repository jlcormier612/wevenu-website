import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decidePhoneA2pEventApply,
  isPhoneA2pRegistered,
  parsePhoneA2pCloudEvent,
  phoneA2pStatusFromEvent,
  PHONE_A2P_EVENT_TYPES,
  type PhoneA2pEventPayload,
} from "@/lib/texting-provisioning/phone-a2p-status";

function payload(overrides: Partial<PhoneA2pEventPayload> = {}): PhoneA2pEventPayload {
  return {
    eventId: "CE000000000000000000000000000001",
    eventType: "com.twilio.messaging.compliance.number-registration.pending",
    eventTimeMs: 1_700_000_000_000,
    accountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    phoneNumberSid: "PNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    messagingServiceSid: "MGcccccccccccccccccccccccccccccccc",
    campaignSid: "CMdddddddddddddddddddddddddddddddd",
    externalStatus: "pending_registration",
    phoneNumber: "5551112222",
    ...overrides,
  };
}

describe("phone A2P status mapping", () => {
  it("maps the six lifecycle event types", () => {
    assert.equal(PHONE_A2P_EVENT_TYPES.length, 6);
    assert.equal(
      phoneA2pStatusFromEvent("com.twilio.messaging.compliance.number-registration.pending"),
      "PENDING_REGISTRATION",
    );
    assert.equal(
      phoneA2pStatusFromEvent("com.twilio.messaging.compliance.number-registration.successful"),
      "REGISTERED",
    );
    assert.equal(
      phoneA2pStatusFromEvent("com.twilio.messaging.compliance.number-registration.failed"),
      "FAILURE",
    );
    assert.equal(
      phoneA2pStatusFromEvent("com.twilio.messaging.compliance.number-deregistration.pending"),
      "PENDING_DEREGISTRATION",
    );
    assert.equal(
      phoneA2pStatusFromEvent("com.twilio.messaging.compliance.number-deregistration.successful"),
      "UNREGISTERED",
    );
    assert.equal(
      phoneA2pStatusFromEvent("com.twilio.messaging.compliance.number-deregistration.failed"),
      "FAILURE",
    );
  });

  it("treats only explicit registered-class statuses as registered", () => {
    assert.equal(isPhoneA2pRegistered("REGISTERED"), true);
    assert.equal(isPhoneA2pRegistered("PENDING_REGISTRATION"), false);
    assert.equal(isPhoneA2pRegistered(null), false);
    assert.equal(isPhoneA2pRegistered(""), false);
  });
});

describe("decidePhoneA2pEventApply", () => {
  const base = {
    venueAccountSid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    expectedPhoneNumberSid: "PNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    expectedMessagingServiceSid: "MGcccccccccccccccccccccccccccccccc",
    lastEventTimeMs: 1_700_000_000_000 as number | null,
    alreadyProcessedEventId: false,
  };

  it("applies pending → registered", () => {
    const pending = decidePhoneA2pEventApply({
      ...base,
      payload: payload(),
    });
    assert.equal(pending.action, "apply");
    if (pending.action === "apply") {
      assert.equal(pending.phoneA2pStatus, "PENDING_REGISTRATION");
      assert.equal(pending.clearSendReady, true);
    }

    const registered = decidePhoneA2pEventApply({
      ...base,
      payload: payload({
        eventId: "CE2",
        eventType: "com.twilio.messaging.compliance.number-registration.successful",
        externalStatus: "registered",
        eventTimeMs: 1_700_000_100_000,
      }),
    });
    assert.equal(registered.action, "apply");
    if (registered.action === "apply") {
      assert.equal(registered.phoneA2pStatus, "REGISTERED");
      assert.equal(registered.clearSendReady, false);
      assert.equal(registered.needsAttention, false);
    }
  });

  it("applies pending → failed with needs attention", () => {
    const failed = decidePhoneA2pEventApply({
      ...base,
      payload: payload({
        eventType: "com.twilio.messaging.compliance.number-registration.failed",
        externalStatus: "failure",
      }),
    });
    assert.equal(failed.action, "apply");
    if (failed.action === "apply") {
      assert.equal(failed.phoneA2pStatus, "FAILURE");
      assert.equal(failed.needsAttention, true);
      assert.equal(failed.clearSendReady, true);
    }
  });

  it("ignores duplicates and stale events", () => {
    assert.equal(
      decidePhoneA2pEventApply({
        ...base,
        alreadyProcessedEventId: true,
        payload: payload(),
      }).action,
      "ignore",
    );
    assert.equal(
      decidePhoneA2pEventApply({
        ...base,
        lastEventTimeMs: 1_700_000_200_000,
        payload: payload({ eventTimeMs: 1_700_000_100_000 }),
      }).action,
      "ignore",
    );
  });

  it("treats concurrent duplicate REGISTERED deliveries as ignore after first apply", () => {
    const registeredPayload = payload({
      eventId: "CE-registered-1",
      eventType: "com.twilio.messaging.compliance.number-registration.successful",
      externalStatus: "registered",
      eventTimeMs: 1_700_000_100_000,
    });
    const first = decidePhoneA2pEventApply({
      ...base,
      payload: registeredPayload,
    });
    assert.equal(first.action, "apply");
    const second = decidePhoneA2pEventApply({
      ...base,
      alreadyProcessedEventId: true,
      lastEventTimeMs: 1_700_000_100_000,
      payload: registeredPayload,
    });
    assert.equal(second.action, "ignore");
  });

  it("rejects unknown account / mismatched phone / mismatched messaging service", () => {
    assert.equal(
      decidePhoneA2pEventApply({
        ...base,
        venueAccountSid: "ACffffffffffffffffffffffffffffffff",
        payload: payload(),
      }).action,
      "reject",
    );
    assert.equal(
      decidePhoneA2pEventApply({
        ...base,
        expectedPhoneNumberSid: "PNffffffffffffffffffffffffffffffff",
        payload: payload(),
      }).action,
      "reject",
    );
    assert.equal(
      decidePhoneA2pEventApply({
        ...base,
        expectedMessagingServiceSid: "MGffffffffffffffffffffffffffffffff",
        payload: payload(),
      }).action,
      "reject",
    );
  });

  it("clears send-ready on deregistration after approval", () => {
    const decision = decidePhoneA2pEventApply({
      ...base,
      payload: payload({
        eventType: "com.twilio.messaging.compliance.number-deregistration.successful",
        externalStatus: "unregistered",
        eventTimeMs: 1_700_000_300_000,
      }),
    });
    assert.equal(decision.action, "apply");
    if (decision.action === "apply") {
      assert.equal(decision.phoneA2pStatus, "UNREGISTERED");
      assert.equal(decision.clearSendReady, true);
    }
  });
});

describe("parsePhoneA2pCloudEvent", () => {
  it("parses a successful registration CloudEvent", () => {
    const parsed = parsePhoneA2pCloudEvent({
      type: "com.twilio.messaging.compliance.number-registration.successful",
      id: "CE111111111111111111111111111111",
      time: "2024-03-13T15:51:10.552Z",
      data: {
        accountsid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        phonenumbersid: "PNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        messagingservicesid: "MGcccccccccccccccccccccccccccccccc",
        campaignsid: "CMdddddddddddddddddddddddddddddddd",
        externalstatus: "registered",
        phonenumber: "5551112222",
        updateddate: 1710345070476,
      },
    });
    assert.ok(parsed);
    assert.equal(parsed?.phoneNumberSid, "PNbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    assert.equal(phoneA2pStatusFromEvent(parsed!.eventType, parsed!.externalStatus), "REGISTERED");
  });

  it("returns null for unknown event types", () => {
    assert.equal(
      parsePhoneA2pCloudEvent({
        type: "com.twilio.messaging.message.delivered",
        id: "CE1",
        data: { accountsid: "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
      }),
      null,
    );
  });
});
