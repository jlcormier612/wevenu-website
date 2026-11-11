/**
 * Invitation orchestration with an in-memory store.
 * send() stands in for the provider. This is not a Resend delivery.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  INVITE_PROVIDER_ID_NOT_SAVED,
  INVITE_SEND_AMBIGUOUS,
  transmitClientInvitation,
  type InvitationDeliveryRow,
  type InvitationDeliveryStore,
} from "@/lib/client-auth/invite-delivery";
import { beginClientInviteSend, endClientInviteSend } from "@/lib/client-auth/invite-send-lock";
import { shouldSendClientInvitation } from "@/lib/client-auth/service";
import type { SendResult } from "@/lib/email/send";

function row(patch: Partial<InvitationDeliveryRow> = {}): InvitationDeliveryRow {
  return {
    id: "inv-1",
    status: "pending",
    email: "invitee@mail.hellotocheers.test",
    token: "token-1",
    deliveryStatus: null,
    providerMessageId: null,
    ...patch,
  };
}

function storeFor(initial: InvitationDeliveryRow, saveError?: string) {
  const current = { ...initial };
  const sends: string[] = [];
  const store: InvitationDeliveryStore = {
    async markSending(id) {
      assert.equal(id, current.id);
      current.deliveryStatus = "sending";
      return {};
    },
    async saveOutcome(_id, patch) {
      if (saveError) return { error: saveError };
      current.deliveryStatus = patch.deliveryStatus;
      current.providerMessageId = patch.providerMessageId;
      return {};
    },
  };
  return { current, sends, store };
}

const accepted: SendResult = { ok: true, method: "resend", providerId: "re_provider_1" };

describe("transmitClientInvitation", () => {
  it("persists the provider id only after the provider accepts", async () => {
    const bucket = storeFor(row());
    const result = await transmitClientInvitation({
      row: row(),
      mode: "invite",
      sendUnrecorded: true,
      store: bucket.store,
      send: async () => {
        bucket.sends.push("send");
        return accepted;
      },
    });
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(bucket.sends, ["send"]);
    assert.equal(bucket.current.deliveryStatus, "accepted");
    assert.equal(bucket.current.providerMessageId, "re_provider_1");
    assert.equal(bucket.current.status, "pending");
  });

  it("records provider rejection and does not report success", async () => {
    const bucket = storeFor(row());
    const result = await transmitClientInvitation({
      row: row(),
      mode: "invite",
      sendUnrecorded: true,
      store: bucket.store,
      send: async () => ({ ok: false, message: "The email provider rejected this address." }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /rejected/);
    assert.equal(bucket.current.deliveryStatus, "failed");
    assert.equal(bucket.current.providerMessageId, null);
  });

  it("leaves an ambiguous sending row when the transport throws and will not send again", async () => {
    const bucket = storeFor(row());
    const first = await transmitClientInvitation({
      row: row(),
      mode: "invite",
      sendUnrecorded: true,
      store: bucket.store,
      send: async () => {
        throw new Error("socket hang up");
      },
    });
    assert.deepEqual(first, { ok: false, error: INVITE_SEND_AMBIGUOUS });
    assert.equal(bucket.current.deliveryStatus, "sending");
    const second = await transmitClientInvitation({
      row: { ...bucket.current },
      mode: "invite",
      store: bucket.store,
      send: async () => {
        bucket.sends.push("again");
        return accepted;
      },
    });
    assert.deepEqual(second, { ok: false, error: INVITE_SEND_AMBIGUOUS });
    assert.deepEqual(bucket.sends, []);
    assert.equal(bucket.current.providerMessageId, null);
  });

  it("does not send again when the provider id could not be saved", async () => {
    const bucket = storeFor(row(), "write failed");
    const first = await transmitClientInvitation({
      row: row(),
      mode: "invite",
      sendUnrecorded: true,
      store: bucket.store,
      send: async () => {
        bucket.sends.push("send");
        return accepted;
      },
    });
    assert.deepEqual(first, { ok: false, error: INVITE_PROVIDER_ID_NOT_SAVED });
    assert.equal(bucket.current.deliveryStatus, "sending");
    const second = await transmitClientInvitation({
      row: { ...bucket.current },
      mode: "resend",
      store: bucket.store,
      send: async () => {
        bucket.sends.push("again");
        return accepted;
      },
    });
    assert.deepEqual(second, { ok: false, error: INVITE_SEND_AMBIGUOUS });
    assert.deepEqual(bucket.sends, ["send"]);
  });

  it("does not insert or send for pending, accepted, or an already accepted provider id", async () => {
    assert.equal(shouldSendClientInvitation({ status: "pending" }), false);
    assert.equal(shouldSendClientInvitation({ status: "accepted" }), false);
    assert.equal(shouldSendClientInvitation({ status: "revoked" }), true);
    assert.equal(shouldSendClientInvitation(null), true);

    const pending = storeFor(row());
    const pendingResult = await transmitClientInvitation({
      row: row(),
      mode: "invite",
      store: pending.store,
      send: async () => {
        pending.sends.push("send");
        return accepted;
      },
    });
    assert.deepEqual(pendingResult, { ok: true });
    assert.deepEqual(pending.sends, []);

    const acceptedRow = storeFor(row({ status: "accepted", providerMessageId: "re_old" }));
    const acceptedResult = await transmitClientInvitation({
      row: row({ status: "accepted", providerMessageId: "re_old" }),
      mode: "invite",
      store: acceptedRow.store,
      send: async () => accepted,
    });
    assert.deepEqual(acceptedResult, { ok: true });
    assert.equal(acceptedRow.current.providerMessageId, "re_old");

    const handedOff = storeFor(row({ deliveryStatus: "accepted", providerMessageId: "re_old" }));
    const handedOffResult = await transmitClientInvitation({
      row: row({ deliveryStatus: "accepted", providerMessageId: "re_old" }),
      mode: "invite",
      store: handedOff.store,
      send: async () => accepted,
    });
    assert.deepEqual(handedOffResult, { ok: true });
    assert.equal(handedOff.current.providerMessageId, "re_old");
  });

  it("retries a known provider rejection once and replaces the id on an explicit resend", async () => {
    const failed = storeFor(row({ deliveryStatus: "failed" }));
    const retried = await transmitClientInvitation({
      row: row({ deliveryStatus: "failed" }),
      mode: "invite",
      store: failed.store,
      send: async () => accepted,
    });
    assert.deepEqual(retried, { ok: true });
    assert.equal(failed.current.providerMessageId, "re_provider_1");
    assert.equal(failed.current.deliveryStatus, "accepted");

    const resent = await transmitClientInvitation({
      row: { ...failed.current },
      mode: "resend",
      store: failed.store,
      send: async () => ({ ok: true, method: "resend", providerId: "re_provider_2" }),
    });
    assert.deepEqual(resent, { ok: true });
    assert.equal(failed.current.providerMessageId, "re_provider_2");
  });

  it("uses the in-flight guard so two invite attempts cannot both proceed", () => {
    const key = "invite:client-lock";
    assert.equal(beginClientInviteSend(key), true);
    assert.equal(beginClientInviteSend(key), false);
    endClientInviteSend(key);
    assert.equal(beginClientInviteSend(key), true);
    endClientInviteSend(key);
  });
});
