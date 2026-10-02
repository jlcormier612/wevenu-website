# Luv — pipeline stage is never authoritative evidence

**Status:** IMPLEMENTED IN TREE — NOT GREEN  
**Applies to:** coordinator observations AND customer-facing drafts  
**Production:** untouched

## Locked rule

Pipeline / sales stage must never be used as authoritative proof that an action occurred or that a customer is currently in that state.

Stage may tell Luv: this relationship may be around this part of the journey.  
Stage must not tell Luv: this specific thing happened.

| Claim | Authoritative record | Stage cannot prove |
| --- | --- | --- |
| Tour scheduled / confirmed | `tour_appointments.status` | `sales_stage` |
| Contact / no contact | `conversation_messages` (customer-facing) + tour record + `last_contacted_at` | stage, or empty last-contacted alone as “no contact” when messages/tours exist |
| Proposal sent | `commercial_proposals.status = 'sent'` AND `offered_at IS NOT NULL` | `proposal_sent` stage |
| Contract signed | contract lifecycle (`status = signed` or client signer) | stage |
| Paid / obligation | invoice / payment line records | stage |
| Booked | `first_booked_at` + locked commercial booking rule | later sales stage |
| Lost | `lost_at` | `lost` stage |
| Task completion | task / activity / workflow evidence | stage advance |
| Customer response | inbound communication evidence | stage |

A venue owner's imperfect stage hygiene (forgotten, late, out-of-order, skipped, or manual stage changes) must not degrade Luv's factuality.

## Engineering lock

- `lib/luv/pipeline-stage-evidence.ts`
- Observations: S3/S4, qualified-leads retired, momentum/booked-lost, tour follow-up supersession, tour-followup pattern, spot-pattern P-A1
- Drafts: `buildFollowUpPrompt` + `loadProposalSentFact` + `loadFollowUpTourState`
- Tests: `lib/luv/pipeline-stage-evidence.test.ts` (change/omit/misorder stage) + observation-quality + existing Luv suites

## GREEN only after

Exact Sandbox runtime (commit / TD / task / digest / health) + browser+DB proof. Tests alone do not close this.
