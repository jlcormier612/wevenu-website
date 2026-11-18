#!/usr/bin/env bash
# Read-only Sandbox inspection of texting self-service provisioning state.
# Mirrors claimDueProvisioningVenueIds and processor eligibility gates
# from commit b40b4e48 (A2P automation on main).
#
# Usage: bash scripts/inspect-sandbox-texting-provisioning.sh "$SANDBOX_DB_URL"
# The connection string is an argument only. This script never prints it.
#
# Guarantees:
# - SELECT-only reviewed SQL (no caller-supplied queries)
# - Explicit READ ONLY transaction
# - No Twilio / HTTP / provisioning processor calls
# - No secrets, phone numbers, or error message bodies in output
set -euo pipefail

CONN="${1:-${SANDBOX_DB_URL:-}}"
if [ -z "$CONN" ]; then
  echo "usage: $0 <SANDBOX_DB_URL>" >&2
  exit 1
fi

# Fail closed if required tables are missing (migration not applied / wrong DB).
missing=$(psql "$CONN" -v ON_ERROR_STOP=1 -Atqc "
SELECT string_agg(name, ',')
FROM (VALUES
  ('venue_texting_provisioning_steps'),
  ('venue_twilio_accounts'),
  ('venue_texting_registrations')
) AS t(name)
WHERE to_regclass('public.' || name) IS NULL;
")
if [ -n "$missing" ]; then
  echo "error: required public tables missing (fail closed): $missing" >&2
  exit 1
fi

psql "$CONN" -v ON_ERROR_STOP=1 -P pager=off <<'SQL'
BEGIN READ ONLY;

\echo === INSPECT: texting provisioning (read-only) ===
\echo Generated_at_utc:
SELECT now() AT TIME ZONE 'utc';

\echo
\echo === A. Step counts by status x step ===
SELECT status, step, count(*)::int AS n
FROM public.venue_texting_provisioning_steps
WHERE generation = 1
GROUP BY status, step
ORDER BY status, step;

\echo
\echo === A2. Totals by status ===
SELECT status, count(*)::int AS n
FROM public.venue_texting_provisioning_steps
WHERE generation = 1
GROUP BY status
ORDER BY status;

\echo
\echo === B. Due pending/failed rows (next_attempt_at <= now) ===
SELECT
  s.venue_id::text AS venue_id,
  s.step,
  s.status,
  s.next_attempt_at,
  coalesce(nullif(trim(s.last_error_code), ''), '(none)') AS error_code,
  CASE
    WHEN nullif(trim(s.last_error_code), '') IN (
      'FAILED','SUSPENDED','REJECTED','twilio-rejected','noncompliant',
      'brand_rejected','campaign_rejected','secondary_rejected',
      'secondary_rejected_only','trust_product_rejected','details_needed'
    ) THEN 'terminal_excluded_from_claim'
    ELSE 'non_terminal_or_waiting'
  END AS error_class
FROM public.venue_texting_provisioning_steps s
WHERE s.generation = 1
  AND s.status IN ('pending', 'failed')
  AND s.next_attempt_at <= now()
ORDER BY s.next_attempt_at, s.venue_id, s.step;

\echo
\echo === C/D. Venue-level first incomplete step + claimability (mirrors b40b4e48) ===
WITH step_order(step, ord) AS (
  VALUES
    ('create_subaccount', 1),
    ('create_api_key', 2),
    ('store_secret', 3),
    ('create_messaging_service', 4),
    ('configure_webhooks', 5),
    ('configure_event_streams', 6),
    ('submit_secondary_profile', 7),
    ('submit_a2p_trust_product', 8),
    ('submit_brand', 9),
    ('await_brand_approved', 10),
    ('submit_campaign', 11),
    ('await_campaign_verified', 12),
    ('buy_number', 13),
    ('attach_number', 14),
    ('await_number_a2p', 15),
    ('mark_ready', 16)
),
mutation_steps(step) AS (
  VALUES
    ('create_subaccount'),
    ('create_api_key'),
    ('store_secret'),
    ('create_messaging_service'),
    ('configure_webhooks'),
    ('configure_event_streams'),
    ('submit_secondary_profile'),
    ('submit_a2p_trust_product'),
    ('submit_brand'),
    ('submit_campaign'),
    ('buy_number'),
    ('attach_number')
),
protected(venue_id) AS (
  VALUES
    ('0149e0d4-3cd9-459a-a9a2-6c5e2b30869e'::uuid),
    ('a415ac52-cd74-42a6-8df7-7a8f6e71d080'::uuid)
),
venues_with_steps AS (
  SELECT DISTINCT venue_id
  FROM public.venue_texting_provisioning_steps
  WHERE generation = 1
),
first_incomplete AS (
  SELECT s.venue_id, s.step AS first_step, o.ord AS first_ord, s.status AS first_status,
         s.next_attempt_at, s.last_error_code
  FROM public.venue_texting_provisioning_steps s
  JOIN step_order o ON o.step = s.step
  WHERE s.generation = 1
    AND s.status IS DISTINCT FROM 'succeeded'
    AND NOT EXISTS (
      SELECT 1
      FROM public.venue_texting_provisioning_steps earlier
      JOIN step_order eo ON eo.step = earlier.step
      WHERE earlier.venue_id = s.venue_id
        AND earlier.generation = 1
        AND earlier.status IS DISTINCT FROM 'succeeded'
        AND eo.ord < o.ord
    )
),
-- claimDue selects venues that have ANY due pending/failed non-terminal row,
-- then filters Ready account + blocked registration phases.
due_claim_candidates AS (
  SELECT DISTINCT s.venue_id
  FROM public.venue_texting_provisioning_steps s
  WHERE s.generation = 1
    AND s.status IN ('pending', 'failed')
    AND s.next_attempt_at <= now()
    AND coalesce(nullif(trim(s.last_error_code), ''), '') NOT IN (
      'FAILED','SUSPENDED','REJECTED','twilio-rejected','noncompliant',
      'brand_rejected','campaign_rejected','secondary_rejected',
      'secondary_rejected_only','trust_product_rejected','details_needed'
    )
),
venue_ctx AS (
  SELECT
    v.venue_id,
    a.status AS twilio_account_status,
    r.phase AS registration_phase,
    (p.venue_id IS NOT NULL) AS is_protected,
    (a.status = 'ready') AS account_ready,
    (r.phase IN ('needs_attention', 'failed', 'ready')) AS phase_blocks_claim,
    (d.venue_id IS NOT NULL) AS has_due_claim_row
  FROM venues_with_steps v
  LEFT JOIN public.venue_twilio_accounts a ON a.venue_id = v.venue_id
  LEFT JOIN public.venue_texting_registrations r ON r.venue_id = v.venue_id
  LEFT JOIN protected p ON p.venue_id = v.venue_id
  LEFT JOIN due_claim_candidates d ON d.venue_id = v.venue_id
),
lookahead AS (
  SELECT
    fi.venue_id,
    string_agg(so.step, ',' ORDER BY so.ord) AS next_up_to_4_steps,
    bool_or(ms.step IS NOT NULL) AS mutation_in_next_4
  FROM first_incomplete fi
  JOIN step_order so ON so.ord BETWEEN fi.first_ord AND fi.first_ord + 3
  LEFT JOIN mutation_steps ms ON ms.step = so.step
  GROUP BY fi.venue_id
)
SELECT
  vc.venue_id::text AS venue_id,
  coalesce(fi.first_step, '(all_succeeded_or_no_steps)') AS first_incomplete_step,
  coalesce(fi.first_status, '-') AS first_step_status,
  fi.next_attempt_at AS first_step_next_attempt_at,
  coalesce(nullif(trim(fi.last_error_code), ''), '(none)') AS first_step_error_code,
  coalesce(vc.twilio_account_status, '(no_account_row)') AS twilio_account_status,
  coalesce(vc.registration_phase, '(no_registration_row)') AS registration_phase,
  CASE WHEN vc.is_protected THEN 'yes' ELSE 'no' END AS protected_venue,
  CASE
    WHEN vc.is_protected THEN 'protected_noop_if_claimed'
    WHEN NOT vc.has_due_claim_row THEN 'present_not_currently_claimable'
    WHEN vc.account_ready THEN 'excluded_account_ready'
    WHEN vc.phase_blocks_claim THEN 'excluded_registration_phase'
    ELSE 'currently_due_and_claimable'
  END AS scheduler_eligibility,
  coalesce(la.next_up_to_4_steps, '') AS next_up_to_4_steps,
  CASE
    WHEN vc.is_protected THEN 'no_twilio_mutation_protected_gate'
    -- Conservative: missing configure_event_streams after later succeeded steps means
    -- ensureProvisioningSteps may add it and reorder firstIncomplete after deploy.
    WHEN EXISTS (
      SELECT 1 FROM public.venue_texting_provisioning_steps later
      JOIN step_order lo ON lo.step = later.step
      WHERE later.venue_id = vc.venue_id AND later.generation = 1
        AND later.status = 'succeeded' AND lo.ord >= 5
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.venue_texting_provisioning_steps ces
      WHERE ces.venue_id = vc.venue_id AND ces.generation = 1
        AND ces.step = 'configure_event_streams'
    )
    AND vc.has_due_claim_row
    AND NOT vc.account_ready
    AND NOT vc.phase_blocks_claim
    THEN 'potential_twilio_mutation_if_claimed'
    WHEN coalesce(la.mutation_in_next_4, false) AND (
      vc.has_due_claim_row
      AND NOT vc.account_ready
      AND NOT vc.phase_blocks_claim
    ) THEN 'potential_twilio_mutation_if_claimed'
    WHEN coalesce(la.mutation_in_next_4, false) THEN 'mutation_steps_ahead_but_not_currently_claimable'
    WHEN EXISTS (
      SELECT 1 FROM public.venue_texting_provisioning_steps later
      JOIN step_order lo ON lo.step = later.step
      WHERE later.venue_id = vc.venue_id AND later.generation = 1
        AND later.status = 'succeeded' AND lo.ord >= 5
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.venue_texting_provisioning_steps ces
      WHERE ces.venue_id = vc.venue_id AND ces.generation = 1
        AND ces.step = 'configure_event_streams'
    )
    THEN 'uncertain_ensureProvisioningSteps_may_add_mutation_step'
    ELSE 'no_mutation_in_next_4_known_steps'
  END AS mutation_risk,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.venue_texting_provisioning_steps later
      JOIN step_order lo ON lo.step = later.step
      WHERE later.venue_id = vc.venue_id AND later.generation = 1
        AND later.status = 'succeeded' AND lo.ord >= 5
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.venue_texting_provisioning_steps ces
      WHERE ces.venue_id = vc.venue_id AND ces.generation = 1
        AND ces.step = 'configure_event_streams'
    )
    THEN 'missing_configure_event_streams_row_ensureProvisioningSteps_may_add'
    ELSE 'ok_or_n_a'
  END AS ensure_steps_uncertainty
FROM venue_ctx vc
LEFT JOIN first_incomplete fi ON fi.venue_id = vc.venue_id
LEFT JOIN lookahead la ON la.venue_id = vc.venue_id
ORDER BY
  CASE
    WHEN vc.is_protected THEN 2
    WHEN vc.has_due_claim_row AND NOT vc.account_ready AND NOT vc.phase_blocks_claim THEN 0
    ELSE 1
  END,
  vc.venue_id;

\echo
\echo === E. Venues with twilio account status = ready ===
SELECT
  a.venue_id::text AS venue_id,
  a.status,
  coalesce(nullif(trim(a.phone_a2p_status), ''), '(null)') AS phone_a2p_status_sanitized,
  CASE WHEN p.venue_id IS NOT NULL THEN 'yes' ELSE 'no' END AS protected_venue
FROM public.venue_twilio_accounts a
LEFT JOIN (
  VALUES
    ('0149e0d4-3cd9-459a-a9a2-6c5e2b30869e'::uuid),
    ('a415ac52-cd74-42a6-8df7-7a8f6e71d080'::uuid)
) AS p(venue_id) ON p.venue_id = a.venue_id
WHERE a.status = 'ready'
ORDER BY a.venue_id;

\echo
\echo === F. Protected QuickCloud + Jen Fancy detail ===
SELECT
  p.venue_id::text AS venue_id,
  CASE
    WHEN p.venue_id = '0149e0d4-3cd9-459a-a9a2-6c5e2b30869e'::uuid THEN 'QuickCloud'
    ELSE 'Jens_Fancy'
  END AS label,
  coalesce(a.status, '(no_account_row)') AS twilio_account_status,
  coalesce(r.phase, '(no_registration_row)') AS registration_phase,
  (SELECT count(*)::int FROM public.venue_texting_provisioning_steps s
   WHERE s.venue_id = p.venue_id AND s.generation = 1) AS step_rows,
  (SELECT count(*)::int FROM public.venue_texting_provisioning_steps s
   WHERE s.venue_id = p.venue_id AND s.generation = 1
     AND s.status IN ('pending','failed') AND s.next_attempt_at <= now()) AS due_pending_failed_rows,
  (SELECT string_agg(s.step || ':' || s.status, ',' ORDER BY s.step)
   FROM public.venue_texting_provisioning_steps s
   WHERE s.venue_id = p.venue_id AND s.generation = 1
     AND s.status IN ('pending','failed','running')) AS non_succeeded_steps
FROM (
  VALUES
    ('0149e0d4-3cd9-459a-a9a2-6c5e2b30869e'::uuid),
    ('a415ac52-cd74-42a6-8df7-7a8f6e71d080'::uuid)
) AS p(venue_id)
LEFT JOIN public.venue_twilio_accounts a ON a.venue_id = p.venue_id
LEFT JOIN public.venue_texting_registrations r ON r.venue_id = p.venue_id
ORDER BY label;

\echo
\echo === G. Candidate disposable venues (heuristic; human must confirm) ===
\echo Criteria: not protected; not account ready; has incomplete steps; buy_number not succeeded; preferably claimable or early-phase.
WITH step_order(step, ord) AS (
  VALUES
    ('create_subaccount', 1), ('create_api_key', 2), ('store_secret', 3),
    ('create_messaging_service', 4), ('configure_webhooks', 5),
    ('configure_event_streams', 6), ('submit_secondary_profile', 7),
    ('submit_a2p_trust_product', 8), ('submit_brand', 9),
    ('await_brand_approved', 10), ('submit_campaign', 11),
    ('await_campaign_verified', 12), ('buy_number', 13),
    ('attach_number', 14), ('await_number_a2p', 15), ('mark_ready', 16)
),
protected(venue_id) AS (
  VALUES
    ('0149e0d4-3cd9-459a-a9a2-6c5e2b30869e'::uuid),
    ('a415ac52-cd74-42a6-8df7-7a8f6e71d080'::uuid)
)
SELECT
  s.venue_id::text AS venue_id,
  coalesce(a.status, '(no_account_row)') AS twilio_account_status,
  coalesce(r.phase, '(no_registration_row)') AS registration_phase,
  bool_or(s.step = 'buy_number' AND s.status = 'succeeded') AS buy_number_succeeded,
  min(CASE WHEN s.status IS DISTINCT FROM 'succeeded' THEN o.ord END) AS first_incomplete_ord
FROM public.venue_texting_provisioning_steps s
JOIN step_order o ON o.step = s.step
LEFT JOIN public.venue_twilio_accounts a ON a.venue_id = s.venue_id
LEFT JOIN public.venue_texting_registrations r ON r.venue_id = s.venue_id
LEFT JOIN protected p ON p.venue_id = s.venue_id
WHERE s.generation = 1
  AND p.venue_id IS NULL
  AND coalesce(a.status, '') IS DISTINCT FROM 'ready'
GROUP BY s.venue_id, a.status, r.phase
HAVING bool_or(s.status IS DISTINCT FROM 'succeeded')
   AND NOT bool_or(s.step = 'buy_number' AND s.status = 'succeeded')
ORDER BY first_incomplete_ord NULLS LAST, s.venue_id
LIMIT 50;

\echo
\echo === H. Claimable venues with potential Twilio mutation in next 4 steps ===
WITH step_order(step, ord) AS (
  VALUES
    ('create_subaccount', 1), ('create_api_key', 2), ('store_secret', 3),
    ('create_messaging_service', 4), ('configure_webhooks', 5),
    ('configure_event_streams', 6), ('submit_secondary_profile', 7),
    ('submit_a2p_trust_product', 8), ('submit_brand', 9),
    ('await_brand_approved', 10), ('submit_campaign', 11),
    ('await_campaign_verified', 12), ('buy_number', 13),
    ('attach_number', 14), ('await_number_a2p', 15), ('mark_ready', 16)
),
mutation_steps(step) AS (
  VALUES
    ('create_subaccount'), ('create_api_key'), ('store_secret'),
    ('create_messaging_service'), ('configure_webhooks'),
    ('configure_event_streams'), ('submit_secondary_profile'),
    ('submit_a2p_trust_product'), ('submit_brand'), ('submit_campaign'),
    ('buy_number'), ('attach_number')
),
protected(venue_id) AS (
  VALUES
    ('0149e0d4-3cd9-459a-a9a2-6c5e2b30869e'::uuid),
    ('a415ac52-cd74-42a6-8df7-7a8f6e71d080'::uuid)
),
due_claim_candidates AS (
  SELECT DISTINCT s.venue_id
  FROM public.venue_texting_provisioning_steps s
  WHERE s.generation = 1
    AND s.status IN ('pending', 'failed')
    AND s.next_attempt_at <= now()
    AND coalesce(nullif(trim(s.last_error_code), ''), '') NOT IN (
      'FAILED','SUSPENDED','REJECTED','twilio-rejected','noncompliant',
      'brand_rejected','campaign_rejected','secondary_rejected',
      'secondary_rejected_only','trust_product_rejected','details_needed'
    )
),
first_incomplete AS (
  SELECT s.venue_id, s.step AS first_step, o.ord AS first_ord
  FROM public.venue_texting_provisioning_steps s
  JOIN step_order o ON o.step = s.step
  WHERE s.generation = 1
    AND s.status IS DISTINCT FROM 'succeeded'
    AND NOT EXISTS (
      SELECT 1
      FROM public.venue_texting_provisioning_steps earlier
      JOIN step_order eo ON eo.step = earlier.step
      WHERE earlier.venue_id = s.venue_id AND earlier.generation = 1
        AND earlier.status IS DISTINCT FROM 'succeeded' AND eo.ord < o.ord
    )
)
SELECT
  fi.venue_id::text AS venue_id,
  fi.first_step,
  string_agg(so.step, ',' ORDER BY so.ord) AS next_up_to_4_steps
FROM due_claim_candidates d
JOIN first_incomplete fi ON fi.venue_id = d.venue_id
JOIN public.venue_twilio_accounts a ON a.venue_id = d.venue_id
LEFT JOIN public.venue_texting_registrations r ON r.venue_id = d.venue_id
LEFT JOIN protected p ON p.venue_id = d.venue_id
JOIN step_order so ON so.ord BETWEEN fi.first_ord AND fi.first_ord + 3
JOIN mutation_steps ms ON ms.step = so.step
WHERE p.venue_id IS NULL
  AND coalesce(a.status, '') IS DISTINCT FROM 'ready'
  AND coalesce(r.phase, '') NOT IN ('needs_attention', 'failed', 'ready')
GROUP BY fi.venue_id, fi.first_step
ORDER BY fi.venue_id;

\echo
\echo === Scheduler contract reminder ===
\echo claim_limit_per_tick=8
\echo max_steps_advanced_per_venue_per_tick=4
\echo protected_venues_return_protected_venue_noop_after_claim
\echo ensureProvisioningSteps_may_add_missing_configure_event_streams_after_deploy
\echo DB_alone_cannot_prove_Twilio_API_outcomes_review_mutation_risk_rows_manually

\echo
\echo === DONE (READ ONLY; rolling back transaction) ===
ROLLBACK;
SQL
