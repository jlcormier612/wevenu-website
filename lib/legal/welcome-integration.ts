/**
 * Welcome Experience integration (WP4) — wiring helpers between the Legal
 * Acceptance Engine and onboarding / returning-user flows.
 *
 * Does not change the engine or Welcome Experience presentational API.
 */

import {
  legalAcceptanceService,
  type LegalAcceptanceService,
  type LegalAcceptanceUser,
  type OutstandingDocument,
} from "@/lib/legal/acceptance-engine";
import type { LegalAcceptanceUserType } from "@/lib/legal/required-documents";
import type {
  LegalAcceptanceMethod,
  LegalDocument,
} from "@/lib/legal/types";

/** Welcome Experience entry contexts used by WP4 callers. */
export type WelcomeFlowContext =
  | "venueSignup"
  | "coupleInvitation"
  | "vendorInvitation"
  | "versionUpdate";

/**
 * WP4-specified copy for each integration context.
 * Passed into Welcome Experience by wrappers (component has no defaults).
 */
export const WP4_WELCOME_COPY = {
  venueSignup: {
    heading: "Welcome to Hello to Cheers",
    introduction:
      "Before creating your venue workspace, please review the documents below.",
  },
  coupleInvitation: {
    heading: "Welcome",
    introduction: [
      "Your venue has invited you to begin planning together through Hello to Cheers.",
      "Before continuing, please review the following documents.",
    ],
  },
  vendorInvitation: {
    heading: "Welcome",
    introduction: [
      "Your venue has invited you to collaborate on an upcoming celebration.",
      "Before continuing, please review the following documents.",
    ],
  },
  versionUpdate: {
    heading: "We've updated a few things.",
    introduction:
      "To continue using Hello to Cheers, please review the updated documents below.",
  },
} as const satisfies Record<
  WelcomeFlowContext,
  { heading: string; introduction: string | readonly string[] }
>;

export const WELCOME_PATH = "/welcome";

export function isWelcomeFlowContext(
  value: string | null | undefined,
): value is WelcomeFlowContext {
  return (
    value === "venueSignup" ||
    value === "coupleInvitation" ||
    value === "vendorInvitation" ||
    value === "versionUpdate"
  );
}

export function copyForWelcomeContext(context: WelcomeFlowContext): {
  heading: string;
  introduction: string | string[];
} {
  const copy = WP4_WELCOME_COPY[context];
  return {
    heading: copy.heading,
    introduction: Array.isArray(copy.introduction)
      ? [...copy.introduction]
      : String(copy.introduction),
  };
}

export function acceptanceMethodForContext(
  context: WelcomeFlowContext,
): LegalAcceptanceMethod {
  switch (context) {
    case "venueSignup":
      return "Venue Signup";
    case "coupleInvitation":
      return "Couple Invitation";
    case "vendorInvitation":
      return "Vendor Invitation";
    case "versionUpdate":
      return "Version Update";
  }
}

/**
 * Map venue org roles (`current_user_role` / venue_staff.role) to engine types.
 * Unknown / missing roles during signup default to Venue Owner.
 */
export function mapStaffRoleToLegalUserType(
  role: string | null | undefined,
): Extract<
  LegalAcceptanceUserType,
  "venue_owner" | "venue_manager" | "team_member"
> {
  const normalized = (role ?? "").trim().toLowerCase();
  if (normalized === "manager") return "venue_manager";
  if (
    normalized === "staff" ||
    normalized === "coordinator" ||
    normalized === "team_member" ||
    normalized === "team member"
  ) {
    return "team_member";
  }
  // owner, empty (pre-setup), or unrecognized → venue owner requirements
  return "venue_owner";
}

/**
 * Infer Welcome context when the caller did not pass one.
 * First-time principals use invitation/signup methods; anyone with a prior
 * acceptance on any required type uses Version Update.
 */
export function inferWelcomeContext(input: {
  userType: LegalAcceptanceUserType;
  pathname?: string | null;
  hasPriorAcceptance: boolean;
}): WelcomeFlowContext {
  if (input.hasPriorAcceptance) return "versionUpdate";
  if (input.userType === "couple") return "coupleInvitation";
  if (input.userType === "vendor") return "vendorInvitation";
  const path = input.pathname ?? "";
  if (path === "/setup" || path.startsWith("/setup/") || path.startsWith("/setup-hub")) return "venueSignup";
  if (input.userType === "venue_owner") return "venueSignup";
  return "versionUpdate";
}

/** True when any outstanding row already has a prior (non-current) acceptance. */
export function outstandingImpliesPriorAcceptance(
  outstanding: readonly OutstandingDocument[],
): boolean {
  return outstanding.some((row) => Boolean(row.acceptance));
}

/**
 * Outstanding rows that can actually be reviewed / recorded (active version
 * present). Missing active platform docs must not block Welcome with an empty
 * Continue-enabled screen.
 */
export function reviewableOutstanding(
  outstanding: readonly OutstandingDocument[],
): OutstandingDocument[] {
  return outstanding.filter((row): row is OutstandingDocument & {
    active: NonNullable<OutstandingDocument["active"]>;
  } => Boolean(row.active));
}

/** Welcome gate should mount only when there is at least one reviewable doc. */
export function welcomeRequiresReview(
  outstanding: readonly OutstandingDocument[],
): boolean {
  return reviewableOutstanding(outstanding).length > 0;
}

/**
 * Same-origin relative return paths only. Rejects protocol-relative and
 * external URLs. Defaults to `/dashboard` when missing/unsafe.
 */
export function safeReturnToPath(
  raw: string | null | undefined,
  options?: { fallback?: string; origin?: string },
): string {
  const fallback = options?.fallback ?? "/dashboard";
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  try {
    const origin = options?.origin ?? "http://local.test";
    const url = new URL(trimmed, origin);
    if (options?.origin && url.origin !== origin) return fallback;
    // Never bounce back into the Welcome Experience itself.
    if (url.pathname === WELCOME_PATH || url.pathname.startsWith(`${WELCOME_PATH}/`)) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function buildWelcomeRedirectPath(input: {
  returnTo: string;
  context: WelcomeFlowContext;
  portalToken?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("returnTo", input.returnTo);
  params.set("context", input.context);
  if (input.portalToken?.trim()) {
    params.set("token", input.portalToken.trim());
  }
  return `${WELCOME_PATH}?${params.toString()}`;
}

export type RecordOutstandingAcceptancesResult =
  | {
      ok: true;
      recorded: number;
      alreadyAccepted: number;
    }
  | {
      ok: false;
      message: string;
      error?: string;
    };

/**
 * Record acceptances for every outstanding active document via the engine.
 * Relies on engine `already_accepted` so compliant re-posts never duplicate.
 */
export async function recordOutstandingAcceptances(input: {
  user: LegalAcceptanceUser;
  outstanding: readonly OutstandingDocument[];
  acceptanceMethod: LegalAcceptanceMethod | string;
  ipAddress?: string | null;
  userAgent?: string | null;
  /** Injectable for tests; defaults to the process singleton. */
  service?: LegalAcceptanceService;
}): Promise<RecordOutstandingAcceptancesResult> {
  const service = input.service ?? legalAcceptanceService;
  let recorded = 0;
  let alreadyAccepted = 0;
  const reviewable = reviewableOutstanding(input.outstanding);

  // Nothing reviewable → idempotent success (callers should also skip Welcome).
  if (reviewable.length === 0) {
    return { ok: true, recorded: 0, alreadyAccepted: 0 };
  }

  for (const row of reviewable) {
    const result = await service.recordAcceptance(
      input.user,
      row.active as LegalDocument,
      {
        acceptanceMethod: input.acceptanceMethod,
        relationshipId: input.user.relationshipId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    );

    if (!result.ok) {
      return {
        ok: false,
        message: result.message,
        error: result.error,
      };
    }

    if (result.status === "already_accepted") {
      alreadyAccepted += 1;
    } else {
      recorded += 1;
    }
  }

  return { ok: true, recorded, alreadyAccepted };
}
