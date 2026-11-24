/**
 * Persist marketing acquisition attribution on Relationship.meta.
 * First-touch is immutable once set; latest-touch updates on each touch.
 * Never confuses offer flags (founding / Weven / group) with acquisition source.
 * referralSource remains a separate human channel label (manual-friendly).
 */

import type { Relationship } from "./types";
import type {
  AcquisitionAttributionPayload,
  AcquisitionTouch,
} from "../analytics/acquisition-attribution";
import { normalizeAcquisitionPayload } from "../analytics/acquisition-attribution";

export const ACQ_FIRST_TOUCH_META = "acq_first_touch";
export const ACQ_LATEST_TOUCH_META = "acq_latest_touch";

function readTouch(relationship: Relationship, key: string): AcquisitionTouch | null {
  const raw = relationship.meta?.[key];
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as AcquisitionTouch;
  } catch {
    return null;
  }
}

function writeTouch(
  relationship: Relationship,
  key: string,
  touch: AcquisitionTouch,
): void {
  if (!relationship.meta) relationship.meta = {};
  relationship.meta[key] = JSON.stringify(touch);
}

/**
 * Apply attribution from a marketing journey step.
 * - Sets first-touch only when absent (prospect → customer preserves original).
 * - Always refreshes latest-touch when provided.
 */
export function applyAcquisitionAttributionToRelationship(
  relationship: Relationship,
  payload: AcquisitionAttributionPayload | null | undefined,
): void {
  const normalized = normalizeAcquisitionPayload(payload);
  if (!normalized) return;

  const existingFirst = readTouch(relationship, ACQ_FIRST_TOUCH_META);
  if (!existingFirst && normalized.first_touch) {
    writeTouch(relationship, ACQ_FIRST_TOUCH_META, normalized.first_touch);
  } else if (!existingFirst && normalized.latest_touch) {
    // If client only sent latest, seed first from it once.
    writeTouch(relationship, ACQ_FIRST_TOUCH_META, normalized.latest_touch);
  }

  if (normalized.latest_touch) {
    writeTouch(relationship, ACQ_LATEST_TOUCH_META, normalized.latest_touch);
  }
}

export function readAcquisitionAttribution(relationship: Relationship): {
  first_touch: AcquisitionTouch | null;
  latest_touch: AcquisitionTouch | null;
} {
  return {
    first_touch: readTouch(relationship, ACQ_FIRST_TOUCH_META),
    latest_touch: readTouch(relationship, ACQ_LATEST_TOUCH_META),
  };
}
