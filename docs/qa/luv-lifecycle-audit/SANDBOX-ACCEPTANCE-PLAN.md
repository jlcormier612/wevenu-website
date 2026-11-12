# Luv lifecycle safety — Sandbox acceptance plan

**Status:** Implementation complete on branch `fix/luv-lifecycle-communication-safety`.  
**No deploy yet.** Browser acceptance against live Sandbox requires an approved Sandbox-only deploy of this branch tip (or merge to `main` then standard Sandbox deploy).

## Preconditions

- Serving SHA includes this fix.
- Do **not** mutate Ellie St. James records.
- Do **not** send email/SMS/portal messages.
- Prefer disposable fixtures for positive prospect / planning cases if needed.

## Checks (after deploy)

1. **Ellie (Willow Grove)** — open lead Luv  
   - Pending tour sales draft moves to “No longer applicable” with contract-signed reason.  
   - Copy / Send this → blocked server-side with the same reason.  
   - “Draft a follow-up” CTA hidden/blocked (not replaced by generic congrats).

2. **Unbooked prospect with upcoming tour** — generate + pending review still works.

3. **Completed-tour prospect (no contract)** — owner draft still available; proactive silence preserved.

4. **Booked client planning** — client/event planning surfaces still available (not sales follow-up path).

5. **Cross-venue** — withdrawn draft for venue A never appears under venue B.

6. **Stale tab** — open Ellie draft, then attempt copy after load; server reject still holds.

7. **Performance** — lead detail Luv load: one lifecycle facts batch (clients+contracts+payments), no N+1 per draft beyond optional context stamp.

## Evidence to capture

- Desktop screenshots: Ellie Luv (withdrawn), prospect pending draft.  
- Server reject message on blocked copy.  
- Serving SHA / task definition / digest after deploy.
