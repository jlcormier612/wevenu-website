/**
 * Legal Acceptance Engine — single source of truth for required docs,
 * version checks, and append-only acceptance recording (WP2).
 *
 * Existing gates (`getLegalGateStatus`, portal helpers) are intentionally
 * left unchanged; wire those to this module in WP3+.
 */

import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { publishLegalEvent } from "@/lib/legal/events";
import {
  getRequiredDocumentTypes,
  type LegalAcceptanceUserType,
} from "@/lib/legal/required-documents";
import {
  getActiveLegalDocumentByType,
  getLatestLegalAcceptanceForDocumentType,
  getLegalDocumentById,
  insertLegalAcceptance,
} from "@/lib/legal/repository";
import {
  DEFAULT_LEGAL_ACCEPTANCE_METHOD,
  type LegalAcceptance,
  type LegalAcceptanceMethod,
  type LegalDocument,
  type LegalDocumentType,
} from "@/lib/legal/types";

/** Identity + role used by the acceptance engine. */
export type LegalAcceptanceUser = {
  userId: string;
  userType: LegalAcceptanceUserType;
  relationshipId?: string | null;
};

export type AcceptedDocumentSnapshot = {
  documentType: LegalDocumentType;
  active: LegalDocument | null;
  acceptance: LegalAcceptance | null;
  /** True when an acceptance exists and matches active.version exactly. */
  isCurrent: boolean;
};

export type OutstandingDocument = {
  documentType: LegalDocumentType;
  /** Null when no active version exists for a required type. */
  active: LegalDocument | null;
  acceptance: LegalAcceptance | null;
};

export type RequiresAcceptanceResult = {
  requiresAcceptance: boolean;
  outstanding: OutstandingDocument[];
  userType: LegalAcceptanceUserType;
  userId: string;
};

export type RecordAcceptanceInput = {
  acceptanceMethod?: LegalAcceptanceMethod | string;
  ipAddress?: string | null;
  userAgent?: string | null;
  relationshipId?: string | null;
  acceptedAt?: string | null;
};

export type RecordAcceptanceResult =
  | {
      ok: true;
      status: "recorded";
      acceptance: LegalAcceptance;
      document: LegalDocument;
    }
  | {
      ok: true;
      /**
       * User already accepted the active version of this type.
       * No new audit row is inserted (gate-idempotent). Documented in tests.
       */
      status: "already_accepted";
      acceptance: LegalAcceptance;
      document: LegalDocument;
    }
  | {
      ok: false;
      error:
        | "invalid_user"
        | "user_not_found"
        | "document_not_found"
        | "document_inactive"
        | "document_unpublished"
        | "insert_failed";
      message: string;
    };

export type LegalAcceptanceEngineDeps = {
  getActiveDocumentByType: (
    documentType: LegalDocumentType,
  ) => Promise<LegalDocument | null>;
  getDocumentById: (id: string) => Promise<LegalDocument | null>;
  getLatestAcceptanceForDocumentType: (input: {
    documentType: LegalDocumentType;
    userId?: string | null;
    relationshipId?: string | null;
  }) => Promise<LegalAcceptance | null>;
  insertAcceptance: (input: {
    userId: string;
    legalDocumentId: string;
    acceptedVersion: string;
    acceptanceMethod: LegalAcceptanceMethod;
    relationshipId?: string | null;
    acceptedAt?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) => Promise<LegalAcceptance>;
  /**
   * Optional auth.users existence check. When omitted, a non-empty userId
   * is treated as valid (callers that need a hard check inject this).
   */
  userExists?: (userId: string) => Promise<boolean>;
  publishEvent?: typeof publishLegalEvent;
};

/** Exact string match on version — all engine version decisions use this. */
export function isAcceptanceCurrentForActive(
  acceptance: LegalAcceptance | null,
  active: LegalDocument | null,
): boolean {
  if (!acceptance || !active) return false;
  return acceptance.acceptedVersion === active.version;
}

function createDefaultDeps(): LegalAcceptanceEngineDeps {
  return {
    async getActiveDocumentByType(documentType) {
      if (!isSupabaseConfigured) return null;
      const admin = createAdminClient();
      return getActiveLegalDocumentByType(admin, documentType);
    },
    async getDocumentById(id) {
      if (!isSupabaseConfigured) return null;
      const admin = createAdminClient();
      return getLegalDocumentById(admin, id);
    },
    async getLatestAcceptanceForDocumentType(input) {
      if (!isSupabaseConfigured) return null;
      const admin = createAdminClient();
      return getLatestLegalAcceptanceForDocumentType(admin, input);
    },
    async insertAcceptance(input) {
      if (!isSupabaseConfigured) {
        throw new Error("Supabase is not configured.");
      }
      const admin = createAdminClient();
      return insertLegalAcceptance(admin, input);
    },
    publishEvent: publishLegalEvent,
  };
}

function normalizeAcceptanceMethod(
  method: LegalAcceptanceMethod | string | undefined,
): LegalAcceptanceMethod {
  const trimmed = (method ?? DEFAULT_LEGAL_ACCEPTANCE_METHOD).trim();
  return (trimmed || DEFAULT_LEGAL_ACCEPTANCE_METHOD) as LegalAcceptanceMethod;
}

/**
 * Central Legal Acceptance Service.
 * Prefer `createLegalAcceptanceService()` / the default export singleton
 * rather than duplicating version comparison elsewhere.
 */
export class LegalAcceptanceService {
  private readonly deps: LegalAcceptanceEngineDeps;

  constructor(deps?: Partial<LegalAcceptanceEngineDeps>) {
    this.deps = { ...createDefaultDeps(), ...deps };
  }

  /** Required document types from config (no DB). */
  getRequiredDocuments(
    userType: LegalAcceptanceUserType,
  ): readonly LegalDocumentType[] {
    return getRequiredDocumentTypes(userType);
  }

  /** Currently active rows for each required type (nulls omitted). */
  async getActiveDocuments(
    userType: LegalAcceptanceUserType,
  ): Promise<LegalDocument[]> {
    const types = this.getRequiredDocuments(userType);
    const docs = await Promise.all(
      types.map((type) => this.deps.getActiveDocumentByType(type)),
    );
    return docs.filter((doc): doc is LegalDocument => Boolean(doc));
  }

  /**
   * Latest acceptance per required type for this user, plus active row and
   * whether that acceptance matches the active version.
   */
  async getAcceptedDocuments(
    user: LegalAcceptanceUser,
  ): Promise<AcceptedDocumentSnapshot[]> {
    const types = this.getRequiredDocuments(user.userType);
    const userId = user.userId?.trim() || null;
    const relationshipId = user.relationshipId?.trim() || null;

    return Promise.all(
      types.map(async (documentType) => {
        const [active, acceptance] = await Promise.all([
          this.deps.getActiveDocumentByType(documentType),
          userId || relationshipId
            ? this.deps.getLatestAcceptanceForDocumentType({
                documentType,
                userId,
                relationshipId,
              })
            : Promise.resolve(null),
        ]);
        return {
          documentType,
          active,
          acceptance,
          isCurrent: isAcceptanceCurrentForActive(acceptance, active),
        };
      }),
    );
  }

  /**
   * Required types that are not current: missing acceptance, version mismatch,
   * or missing active document.
   */
  async getOutstandingDocuments(
    user: LegalAcceptanceUser,
  ): Promise<OutstandingDocument[]> {
    const snapshots = await this.getAcceptedDocuments(user);
    const outstanding: OutstandingDocument[] = [];
    for (const snap of snapshots) {
      if (!snap.isCurrent) {
        outstanding.push({
          documentType: snap.documentType,
          active: snap.active,
          acceptance: snap.acceptance,
        });
      }
    }
    return outstanding;
  }

  async requiresAcceptance(
    user: LegalAcceptanceUser,
  ): Promise<RequiresAcceptanceResult> {
    const outstanding = await this.getOutstandingDocuments(user);
    return {
      requiresAcceptance: outstanding.length > 0,
      outstanding,
      userType: user.userType,
      userId: user.userId,
    };
  }

  /**
   * Append-only acceptance for an active (and preferably published) document.
   * If the user is already current on this document's type, returns
   * `already_accepted` without inserting a new row.
   */
  async recordAcceptance(
    user: LegalAcceptanceUser,
    document: LegalDocument | { id: string },
    input: RecordAcceptanceInput = {},
  ): Promise<RecordAcceptanceResult> {
    const userId = user.userId?.trim() ?? "";
    if (!userId) {
      return {
        ok: false,
        error: "invalid_user",
        message: "A non-empty user id is required.",
      };
    }

    if (this.deps.userExists) {
      const exists = await this.deps.userExists(userId);
      if (!exists) {
        return {
          ok: false,
          error: "user_not_found",
          message: "User was not found.",
        };
      }
    }

    const documentId =
      "id" in document && document.id
        ? document.id
        : (document as LegalDocument).id;
    if (!documentId?.trim()) {
      return {
        ok: false,
        error: "document_not_found",
        message: "Document id is required.",
      };
    }

    const resolved =
      "documentType" in document && "version" in document && "isActive" in document
        ? (document as LegalDocument)
        : await this.deps.getDocumentById(documentId);

    if (!resolved) {
      return {
        ok: false,
        error: "document_not_found",
        message: "Legal document was not found.",
      };
    }

    if (!resolved.isActive) {
      return {
        ok: false,
        error: "document_inactive",
        message: "Only the active version of a legal document may be accepted.",
      };
    }

    if (!resolved.isPublished) {
      return {
        ok: false,
        error: "document_unpublished",
        message: "Only published legal documents may be accepted.",
      };
    }

    const relationshipId =
      input.relationshipId?.trim() ||
      user.relationshipId?.trim() ||
      null;

    const latest = await this.deps.getLatestAcceptanceForDocumentType({
      documentType: resolved.documentType,
      userId,
      relationshipId,
    });

    if (isAcceptanceCurrentForActive(latest, resolved)) {
      return {
        ok: true,
        status: "already_accepted",
        acceptance: latest!,
        document: resolved,
      };
    }

    const acceptanceMethod = normalizeAcceptanceMethod(input.acceptanceMethod);

    let acceptance: LegalAcceptance;
    try {
      acceptance = await this.deps.insertAcceptance({
        userId,
        legalDocumentId: resolved.id,
        acceptedVersion: resolved.version,
        acceptanceMethod,
        relationshipId,
        acceptedAt: input.acceptedAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not record acceptance.";
      return { ok: false, error: "insert_failed", message };
    }

    const at = acceptance.acceptedAt;
    const publish = this.deps.publishEvent ?? publishLegalEvent;

    publish({
      type: "LegalDocumentAccepted",
      userId,
      userType: user.userType,
      document: resolved,
      acceptance,
      relationshipId,
      at,
    });

    const outstanding = await this.getOutstandingDocuments({
      ...user,
      userId,
      relationshipId,
    });

    if (outstanding.length === 0) {
      publish({
        type: "LegalRequirementsSatisfied",
        userId,
        userType: user.userType,
        relationshipId,
        satisfiedDocumentTypes: this.getRequiredDocuments(user.userType),
        at,
      });
    }

    return {
      ok: true,
      status: "recorded",
      acceptance,
      document: resolved,
    };
  }
}

export function createLegalAcceptanceService(
  deps?: Partial<LegalAcceptanceEngineDeps>,
): LegalAcceptanceService {
  return new LegalAcceptanceService(deps);
}

/** Default process singleton wired to Supabase repositories. */
export const legalAcceptanceService = createLegalAcceptanceService();
