# Inbound reply attention / email notification — STATUS

**STATUS:** GREEN / CLOSED  
**Date:** 2026-10-15  
**Implementation commit:** `149b7f5fda1857b696de5fa1e91350bb5521cc0b`  
**Exact serving (proof):** `5ad70d80962ea5a3cbfb51728f7ceecc58e6d685` / `htc-sandbox-venue-app:757` (contains `149b7f5f`)  
**Deploy lineage:** https://github.com/jlcormier612/wevenu-website/actions/runs/38675746150 (image cutover; sole PRIMARY COMPLETED)  
**Production / Resend / DNS:** untouched  

## Root causes

1. `message_received` emails went only to `venues.email` (~28.6 min via cron).
2. No lead-level message attention distinct from `venue_seen_at`.
3. Inbox unread≠needs_response is intentional (not a defect).

## Exact-runtime proof (`EXPECTED_SHA=5ad70d80…`)

```
npx tsx scripts/qa/inbound-reply-attention-verify.mts
```

**24/24 PASS** — `docs/qa/inbound-reply-attention-email/runtime-verify-results.json`

| Proof | Evidence |
|-------|----------|
| Serving SHA | image `…:5ad70d80…` TD `:757` |
| Owner + Ellie assignee recipients | logs `73a99189-…`, `e2d0c3dd-…` |
| Prompt dispatch | ~662 ms insert→emailed_at |
| Idempotent redispatch | 2→2 logs |
| `status=sent`, `delivered_at=null` | delivery not claimed |
| Lead Message indicator (detail + list) | browser PASS; navigates `#messages` |
| Open clears unread, keeps `needs_response` | `venue_unread=0`, `needs_response=true` |

## Tests (implementation)

71/71 PASS on focused suites at commit time (see FORENSIC).

## Safety

No Production; no Resend/DNS changes; controlled Sandbox recipients only.
