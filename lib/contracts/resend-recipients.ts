/**
 * Contract resend recipient selection — pure helpers.
 * Selection uses contract_signers.id only (never arbitrary emails).
 */
import type { ContractSigner } from "@/lib/contracts/signers";

export type ResendRecipientView = {
  signerId: string;
  name: string;
  email: string | null;
  roleLabel: string | null;
  alreadySigned: boolean;
};

export type ResendDeliveryOutcome = {
  signerId: string;
  name: string;
  email: string | null;
  /** Provider accepted the message for delivery (not inbox proof). */
  status: "accepted" | "failed" | "skipped_no_email" | "mailto";
  message?: string;
};

export function formatSignerRoleLabel(role: string | null | undefined): string | null {
  if (!role || !role.trim()) return "Client";
  const r = role.trim().toLowerCase();
  if (r === "primary") return "Primary";
  if (r === "partner") return "Partner";
  return role.trim();
}

/** Required client signatories for the resend dialog — dynamic from contract rows. */
export function listResendRecipients(
  signers: readonly ContractSigner[],
): ResendRecipientView[] {
  return signers
    .filter((s) => s.signerType === "client" && s.isRequired)
    .slice()
    .sort((a, b) => a.signOrder - b.signOrder || a.createdAt.localeCompare(b.createdAt))
    .map((s) => ({
      signerId: s.id,
      name: (s.signerName ?? "").trim() || "Client",
      email: s.signerEmail?.trim() || null,
      roleLabel: formatSignerRoleLabel(s.signerRole),
      alreadySigned: Boolean(s.signedAt),
    }));
}

/** Default selection: every required client signatory. */
export function defaultResendSelection(recipients: readonly ResendRecipientView[]): string[] {
  return recipients.map((r) => r.signerId);
}

export type ValidateResendSelectionResult =
  | { ok: true; signerIds: string[] }
  | { ok: false; message: string };

/**
 * Validate selected signer ids against this contract's required client signers.
 * Rejects empty selection, foreign ids, and any non-id payload.
 */
export function validateResendSelection(
  signers: readonly ContractSigner[],
  selectedIds: readonly string[] | null | undefined,
): ValidateResendSelectionResult {
  const authorized = new Set(
    signers
      .filter((s) => s.signerType === "client" && s.isRequired)
      .map((s) => s.id),
  );
  if (!selectedIds || selectedIds.length === 0) {
    return { ok: false, message: "Select at least one recipient to resend." };
  }
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of selectedIds) {
    if (typeof raw !== "string" || !raw.trim()) {
      return { ok: false, message: "Invalid recipient selection." };
    }
    const id = raw.trim();
    // Reject anything that looks like an email slipped into the id list.
    if (id.includes("@")) {
      return { ok: false, message: "Recipients must be selected from this contract's signatories." };
    }
    if (!authorized.has(id)) {
      return { ok: false, message: "One or more selected recipients are not authorized for this contract." };
    }
    if (seen.has(id)) continue;
    seen.add(id);
    cleaned.push(id);
  }
  if (cleaned.length === 0) {
    return { ok: false, message: "Select at least one recipient to resend." };
  }
  return { ok: true, signerIds: cleaned };
}

/** Summarize delivery outcomes for the venue UI — truthful about acceptance vs inbox. */
export function summarizeResendDeliveries(outcomes: readonly ResendDeliveryOutcome[]): {
  ok: boolean;
  message: string;
} {
  if (outcomes.length === 0) {
    return { ok: false, message: "No recipients were selected." };
  }
  const accepted = outcomes.filter((o) => o.status === "accepted" || o.status === "mailto");
  const failed = outcomes.filter((o) => o.status === "failed");
  const skipped = outcomes.filter((o) => o.status === "skipped_no_email");

  if (failed.length === 0 && skipped.length === 0) {
    const names = accepted.map((o) => o.name).join(", ");
    return {
      ok: true,
      message:
        accepted.length === 1
          ? `Signing link accepted for delivery to ${names}.`
          : `Signing links accepted for delivery to ${names}.`,
    };
  }

  if (accepted.length === 0) {
    const parts = [
      ...failed.map((o) => `${o.name}: ${o.message ?? "could not send"}`),
      ...skipped.map((o) => `${o.name}: no email on file`),
    ];
    return { ok: false, message: parts.join("; ") };
  }

  const okNames = accepted.map((o) => o.name).join(", ");
  const failParts = [
    ...failed.map((o) => `${o.name}: ${o.message ?? "failed"}`),
    ...skipped.map((o) => `${o.name}: no email on file`),
  ];
  return {
    ok: true,
    message: `Accepted for ${okNames}. Issues — ${failParts.join("; ")}.`,
  };
}
