/**
 * Real Resend delivery for Phase 3 upgrade notices.
 */

import { sendRawEmail } from "../email/client";
import { renderEmailTemplate } from "../email/templates/registry";
import {
  resolveNoticeDeliveryStatus,
  type TierUpgradeNoticeDeliveryStatus,
} from "./tier-upgrade-apply-gate";
import { buildTierUpgradeNoticeDraft } from "./tier-upgrade-notice";
import type { TierUpgradeRecord } from "./tier-upgrade-types";
import type { TierUpgradeStore } from "./tier-upgrade-store";

export type SendTierUpgradeNoticeResult =
  | {
      ok: true;
      deliveryStatus: TierUpgradeNoticeDeliveryStatus;
      providerMessageId: string | null;
      noticeSentAt: string;
      idempotencyKey: string;
      upgrade: TierUpgradeRecord;
      subject: string;
      to: string;
    }
  | {
      ok: false;
      code: string;
      message: string;
      deliveryStatus: TierUpgradeNoticeDeliveryStatus;
      upgrade: TierUpgradeRecord | null;
    };

export async function sendTierUpgradeNotice(input: {
  store: TierUpgradeStore;
  upgrade: TierUpgradeRecord;
  venueName: string;
  toEmail: string;
  contactEmail?: string;
}): Promise<SendTierUpgradeNoticeResult> {
  const to = input.toEmail.trim().toLowerCase();
  if (!to) {
    return {
      ok: false,
      code: "missing_recipient",
      message: "Billing contact email is required.",
      deliveryStatus: "failed",
      upgrade: input.upgrade,
    };
  }

  // Idempotent: already provider-accepted for this effective date.
  if (
    input.upgrade.noticeDeliveryStatus === "provider_accepted" &&
    input.upgrade.noticeSentAt &&
    input.upgrade.noticeProviderMessageId
  ) {
    return {
      ok: true,
      deliveryStatus: "provider_accepted",
      providerMessageId: input.upgrade.noticeProviderMessageId,
      noticeSentAt: input.upgrade.noticeSentAt,
      idempotencyKey:
        input.upgrade.noticeIdempotencyKey ??
        `tier-up-notice:${input.upgrade.id}`,
      upgrade: input.upgrade,
      subject: "Your Hello to Cheers plan is growing with you",
      to,
    };
  }

  const draft = buildTierUpgradeNoticeDraft({
    upgrade: input.upgrade,
    venueName: input.venueName,
    contactEmail: input.contactEmail,
  });
  const rendered = renderEmailTemplate(draft.templateId, draft.vars);
  const sendResult = await sendRawEmail({
    to,
    subject: rendered.subject || draft.subject,
    text: rendered.text,
    html: rendered.html,
    idempotencyKey: draft.idempotencyKey,
    tags: [
      { name: "template", value: "tier_upgrade_notice" },
      { name: "upgrade_id", value: input.upgrade.id.slice(0, 48) },
    ],
  });

  const deliveryStatus = resolveNoticeDeliveryStatus({
    providerOk: sendResult.ok,
    providerMessageId: sendResult.providerId ?? null,
    simulated: sendResult.delivery === "simulated",
  });

  if (deliveryStatus !== "provider_accepted") {
    const failed = await input.store.updateUpgradeStatus({
      id: input.upgrade.id,
      status: input.upgrade.status === "pending_notice" ? "pending_notice" : input.upgrade.status,
      patch: {
        noticeDeliveryStatus: deliveryStatus,
        noticeIdempotencyKey: draft.idempotencyKey,
      },
      error: {
        at: new Date().toISOString(),
        code: "notice_send_failed",
        message: sendResult.message || `Notice delivery status ${deliveryStatus}`,
        retryable: true,
      },
      audit: {
        at: new Date().toISOString(),
        by: "system",
        action: "notice_send_failed",
        note: sendResult.message || deliveryStatus,
      },
    });
    return {
      ok: false,
      code: "notice_not_provider_accepted",
      message:
        sendResult.message ||
        `Notice not provider-accepted (status=${deliveryStatus}). Simulated/draft sends do not authorize billing.`,
      deliveryStatus,
      upgrade: failed,
    };
  }

  const noticeSentAt = new Date().toISOString();
  const upgraded = await input.store.updateUpgradeStatus({
    id: input.upgrade.id,
    status: "notice_sent",
    patch: {
      noticeSentAt,
      noticeDeliveryStatus: "provider_accepted",
      noticeProviderMessageId: sendResult.providerId ?? null,
      noticeIdempotencyKey: draft.idempotencyKey,
    },
    audit: {
      at: noticeSentAt,
      by: "system",
      action: "notice_provider_accepted",
      note: `Resend accepted message ${sendResult.providerId}`,
      detail: {
        providerMessageId: sendResult.providerId,
        to,
        delivery: "provider_accepted",
      },
    },
  });

  return {
    ok: true,
    deliveryStatus: "provider_accepted",
    providerMessageId: sendResult.providerId ?? null,
    noticeSentAt,
    idempotencyKey: draft.idempotencyKey,
    upgrade: upgraded,
    subject: rendered.subject || draft.subject,
    to,
  };
}
