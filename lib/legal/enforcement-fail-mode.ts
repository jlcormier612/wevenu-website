/**
 * Legal proxy enforcement failure mode.
 *
 * Sandbox/Production fail closed when the service role is missing or the
 * acceptance engine cannot run. Local development may opt into fail-open only
 * via an explicit env flag that is rejected in deployed runtimes.
 */

import { isApiPath } from "@/lib/legal/welcome-middleware";

/** Recovery page — must stay on the legal enforcement skip list. */
export const LEGAL_ENFORCEMENT_UNAVAILABLE_PATH =
  "/system/legal-unavailable" as const;

export type LegalEnforcementFailureReason =
  | "missing_service_role"
  | "admin_client_failure"
  | "engine_error";

/**
 * True only for intentional local-dev escape hatch.
 * Never true when NODE_ENV=production, ECS/AWS, Vercel preview/prod, or
 * HTC_ENVIRONMENT is sandbox|production — even if the flag is set.
 */
export function isLegalEnforcementFailOpenEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.LEGAL_ENFORCEMENT_FAIL_OPEN?.trim() !== "1") return false;

  const nodeEnv = (env.NODE_ENV || "").trim().toLowerCase();
  if (nodeEnv === "production") return false;

  const htcEnv = (env.HTC_ENVIRONMENT || env.EnvironmentName || "")
    .trim()
    .toLowerCase();
  if (htcEnv === "sandbox" || htcEnv === "production") return false;

  const vercelEnv = (env.VERCEL_ENV || "").trim().toLowerCase();
  if (vercelEnv === "production" || vercelEnv === "preview") return false;

  if (
    env.AWS_EXECUTION_ENV ||
    env.AWS_REGION ||
    env.ECS_CONTAINER_METADATA_URI ||
    env.ECS_CONTAINER_METADATA_URI_V4 ||
    env.ECS_AGENT_URI
  ) {
    return false;
  }

  // Require explicit development (or test harness) — unset NODE_ENV is not enough.
  return nodeEnv === "development" || nodeEnv === "test";
}

export function logLegalEnforcementFailure(input: {
  reason: LegalEnforcementFailureReason;
  pathname: string;
  userId?: string | null;
  error?: unknown;
}): void {
  const err = input.error;
  const errorName = err instanceof Error ? err.name : typeof err;
  const rawMessage = err instanceof Error ? err.message : String(err ?? "");
  // Strip anything that looks like a JWT / long secret token from logs.
  const errorMessage = rawMessage
    .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "[redacted-jwt]")
    .replace(/service[_-]?role[^.\s]*/gi, "[redacted-service-role]")
    .slice(0, 240);

  console.error("[legal] proxy enforcement unavailable", {
    reason: input.reason,
    pathname: input.pathname,
    userId: input.userId ?? null,
    errorName,
    errorMessage: errorMessage || null,
  });
}

export type LegalEnforcementFailureDecision =
  | {
      action: "unavailable";
      recoveryPath: typeof LEGAL_ENFORCEMENT_UNAVAILABLE_PATH;
      code: "legal_enforcement_unavailable";
      reason: LegalEnforcementFailureReason;
    }
  | {
      action: "block_api";
      welcomePath: typeof LEGAL_ENFORCEMENT_UNAVAILABLE_PATH;
      code: "legal_enforcement_unavailable";
      reason: LegalEnforcementFailureReason;
    };

/**
 * Fail-closed decision for protected routes when enforcement cannot run.
 * Callers must only invoke this after shouldSkipLegalEnforcement is false.
 */
export function buildLegalEnforcementFailureDecision(input: {
  pathname: string;
  reason: LegalEnforcementFailureReason;
}): LegalEnforcementFailureDecision {
  if (isApiPath(input.pathname)) {
    return {
      action: "block_api",
      welcomePath: LEGAL_ENFORCEMENT_UNAVAILABLE_PATH,
      code: "legal_enforcement_unavailable",
      reason: input.reason,
    };
  }
  return {
    action: "unavailable",
    recoveryPath: LEGAL_ENFORCEMENT_UNAVAILABLE_PATH,
    code: "legal_enforcement_unavailable",
    reason: input.reason,
  };
}
