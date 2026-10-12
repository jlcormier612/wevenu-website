# Ops Alerts — Email + Persistent HQ CRM

**Scope:** Sandbox only. No Production. No billing / Spend Cap changes.  
**Customer-traffic / capacity readiness:** remains **YELLOW** until Spend Cap + authoritative Supabase usage headroom are independently closed.

## Design

| Channel | Path |
|---|---|
| Email | CloudWatch → SNS `htc-sandbox-ops-alerts` → Lambda `htc-sandbox-ops-alert-email` → Resend → `jennifer@hellotocheers.com` |
| In-product | Same Lambda upserts `ops_incidents` (+ events / notification attempts) → Hello to Cheers HQ `/admin/ops-alerts` |

Channels are independent: email failure does not delete the incident; DB persist failure does not block email.

## Data model

- `ops_incidents` — dedupe_key, severity, status (`active` / `acknowledged` / `recovered` / `resolved`), timestamps, safe diagnostics
- `ops_incident_events` — timeline
- `ops_notification_attempts` — email/in-product outcomes with idempotency keys
- RLS: `is_hq_admin()` only; Lambda writes via service role
- Acknowledge RPC does **not** resolve

## UI

- HQ nav **Ops Alerts** with active count badge
- Banner on HQ home when unresolved alerts exist
- List + detail with severity, service, timestamps, recommended action, timeline, acknowledge

## Thresholds (unchanged usage canaries)

See `EARLY-WARNING.md`. Monthly Resend warning ≥70%; daily ≥80%.

## Residual gaps (YELLOW)

- Current-cycle Supabase egress / log ingestion / Spend Cap still require owner Dashboard evidence when API meters are unavailable
- Native SNS email subscription may remain PendingConfirmation (Resend fanout is the proven human path)
- Shared dependency: Resend for ops email; HQ UI depends on Sandbox app + Supabase availability
