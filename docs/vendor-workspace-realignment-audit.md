# Vendor Workspace Realignment — Phase 1 Audit

Program 4, Initiative B. Audit only, no code changes in this phase. First Principle: the vendor is not another CRM customer — the vendor is an Event Participant in the venue's workspace. Every existing vendor-portal surface is tested against one question: **does this help the vendor participate in a booked event, or is it trying to let the vendor run their own business?**

## Decision table

| Current surface | File(s) | Question answer | Decision | Where it lands |
|---|---|---|---|---|
| `/vendor/dashboard` (stat tiles, connected-venues preview, health score) | `vendor-dashboard.tsx` | Own-business aggregation dashboard | **Rebuild** | Becomes **Home** — rebuilt around Phase 4's 5 questions only (events needing me today, messages needing reply, tasks due, timeline changes, venue documents needing attention). Stat tiles/health-score preview removed. |
| `/vendor/accept` (invitation claim) | `app/vendor/accept/page.tsx` | Onboarding, not nav-facing | **Keep** | Unchanged — outside the main nav, part of the Stage-2 connection flow. |
| `/vendor/inquiries` + `/vendor/inquiries/[id]` (lead pipeline CRM) | `vendor-inquiry-pipeline.tsx`, `vendor-inquiry-detail.tsx` | Own-business — explicitly a sales-lead CRM | **Remove from nav** | Drop from primary nav entirely (general lead management named for removal in Phase 2). Table/code untouched — not a data-destroying decision, just no longer a portal destination. |
| `/vendor/events` | `vendor-events-list.tsx` | Event-specific | **Keep** | Becomes **Events** — the center of the workspace per Phase 5. |
| `/vendor/events/[id]` (Overview/Timeline/Tasks/Messages/Documents/Floor Plans/Notes/Activity tabs) | `vendor-event-workspace.tsx` | Event-specific — this *is* the participation surface | **Reuse, restructure tabs** | Collapse Floor Plans into the Documents tab (it's a document category, not a separate concept). Fold Activity into Overview. Keep Notes (private vendor-side notes, no equivalent elsewhere). Result: Overview / Messages / Timeline / Tasks / Documents / Venue Information — matching the Client Workspace shape exactly, per Phase 5's explicit instruction. |
| `/vendor/messages` + `/vendor/messages/[conversationId]` | `vendor-messages-inbox.tsx`, `vendor-conversation-thread.tsx` | Event-specific (one Conversation per assignment) | **Keep** | Becomes top-level **Messages** — already correctly scoped, one thread per event, never merged. No change needed beyond nav placement. |
| `/vendor/tasks` (cross-event personal task list) | `vendor-tasks-list.tsx` | Mixed — event tasks + inquiry-linked tasks + manual | **Reuse, narrow source** | Becomes top-level **Tasks** — cross-event aggregation stays (matches Home's "what tasks are due"), but stops surfacing inquiry-linked rows once Inquiries drops from nav. |
| `/vendor/documents` (dead stub) | `app/vendor/documents/page.tsx` | Neither — placeholder, does nothing | **Rebuild** | Becomes top-level **Documents** — real cross-event aggregation of vendor-relevant documents, reusing the same read path `vendor-event-workspace.tsx`'s Documents tab already uses per event. |
| `/vendor/floor-plans/[planId]` | `app/vendor/floor-plans/[planId]/page.tsx` | Event-specific | **Keep/Reuse** | Unchanged as a viewer, now linked from Documents instead of a separate Floor Plans tab. |
| `/vendor/packages` (service listing CRUD) | `vendor-packages-manager.tsx` | Directory-presentation content (per Phase 11: Profile explicitly includes "packages") | **Merge into Profile** | Folds into **Profile** as a section — it's what a venue sees in the Directory, not a marketplace storefront. |
| `/vendor/availability` (calendar + accepting-inquiries toggle) | `vendor-availability-manager.tsx` | Directory-presentation content (Phase 11 explicitly lists "availability" under Profile) | **Merge into Profile** | Folds into **Profile** alongside Packages. |
| `/vendor/venues` (cross-venue relationship browser) | `vendor-venues-list.tsx` | Own-business — "Global Venues" named for removal in Phase 2 | **Remove from nav** | Drops as a standalone destination. Multi-venue data model (`venue_vendor_relationships`) stays — needed for Events/Home to resolve per-venue context — it just isn't a browsable nav page anymore. |
| `/vendor/profile` (business identity form) | `vendor-profile-form.tsx` | Directory-presentation content | **Keep/Restructure** | Becomes **Profile**, absorbing Packages + Availability as sections underneath it. |
| `/vendor/luv` + health-score widget | `vendor-luv-briefing.tsx`, `vendor-health-score-widget.tsx` | Own-business — "Business Health" named for removal in Phase 2 | **Remove from nav** | Drops entirely from the portal. No CRM metrics, no coaching surface. |
| (new) **Venue Information / Vendor Handbook** | none yet | N/A — doesn't exist | **New, but reuse data** | `venue_operational_info` (parking, transportation, policies, ceremony instructions, important contacts, FAQs) already backs the couple portal's Venue Guide — the same table backs the new Vendor Handbook. Needs one new SECURITY DEFINER RPC (`get_vendor_handbook`) since its current RLS policy (`venue_rw_operational_info`) only recognizes `venue_users`, not `vendor_users` — the same RLS gap already found and fixed for `event_vendor_assignments`/`timeline_entries`/etc. in the Sprint 2 vendor-certification pass. No new authoring surface required. |
| (new) top-level **Timeline** | none yet — Timeline currently only exists as a per-event tab | N/A | **New, reuse RPC** | Cross-event aggregation view, reading the same collaborative-timeline RPC the per-event Timeline tab already calls, just fanned out across all of the vendor's active event assignments. |
| `app/api/vendor/conversations/upload/route.ts` | — | Event-specific | **Keep** | Unchanged. |

## Architectural note carried into Phase 2+

Every vendor-portal read already goes through SECURITY DEFINER RPCs validated against `current_user_vendor_id()` (`get_vendor_events`, `get_vendor_event_detail`, `get_vendor_conversation_inbox`, etc.) — confirmed via the Sprint 2 Vendor Certification Pass, because `vendor_users` sessions were never recognized by the direct-table RLS policies venue staff use. Any new cross-event Tasks/Documents/Timeline aggregation, and the new Vendor Handbook, must follow this same RPC pattern rather than querying tables directly — the direct-table path is a known trap for vendor sessions in this codebase, not a style preference.

## Nav result (Phase 2)

**Home · Events · Messages · Tasks · Timeline · Documents · Venue Information · Profile**

Removed from nav entirely: Inquiries (CRM lead pipeline), Global Venues (cross-venue browser), Luv/Business Health (coaching + health score). Packages and Availability survive as sections inside Profile, not as their own nav items.

## Phase 14 — Final audit (implementation complete, 2026-07-22)

Every phase above was implemented and verified (`tsc --noEmit`, `next build`, live-fixture SQL against the local Supabase instance) in this pass, with two exceptions deliberately left as follow-on work rather than half-built:

**Built and verified:**
- Nav restructure (Phase 2), event workspace tab restructure — Floor Plans folded into Documents, Activity folded into Overview (Phase 5).
- Vendor Handbook (Phase 9) — `get_vendor_handbook`/`get_vendor_handbooks` RPCs reusing `venue_operational_info`, live-verified against a real assigned-vendor fixture (and confirmed an unassigned vendor is correctly blocked).
- Cross-event Timeline and Documents aggregations (Phases 7-8) — new `get_vendor_timeline`/`get_vendor_documents` RPCs, live-verified.
- Tasks narrowed to drop inquiry-linked rows now that Inquiries is off-nav (Phase 6).
- Home rebuilt around the five daily questions only — events today, unread messages, tasks due, next-up timeline, recent documents (Phase 4). The old CRM dashboard, Luv business-coaching briefing, and health-score widget are no longer linked from anywhere in the portal.
- Profile absorbed Packages and Availability as tabs of one Directory-presentation surface (Phase 11).
- Stage 3 (Booked) automation (Phase 3, partial): assigning a vendor to an event now automatically sends the claim-profile invitation email if the vendor hasn't claimed their account yet (`lib/vendor-invites/service.ts`, wired into `assignVendor`) — best-effort, never blocks the booking itself. Conversation-thread creation on assignment was already automatic before this pass (a DB trigger from RC2).

**Deliberately deferred, not half-built:**
- **Stage 2 (Connected) automation** — "a couple first contacts the vendor from a venue" has no real code path today; the couple portal's vendor cards are plain `mailto:`/`tel:`/website links with no app-side tracking. Building real in-app pre-booking contact would require a new conversation anchor (today's `conversations` rows are created via a DB trigger keyed to `event_vendor_assignment_id`, which doesn't exist pre-booking) — a genuine new concept, not a rewire of an existing one, so it wasn't built under this pass's "reuse existing, don't invent new concepts" constraint. Recommended as a scoped follow-up if the venue confirms couples should be able to message a vendor before booking them.
- **Vendor-targeted notifications** — no `vendor_notifications` table or vendor-facing notification mechanism exists anywhere in the codebase (confirmed via full-repo search); the existing `create_venue_notification` RPC is coordinator-inbox-only. Phase 13 asked for vendor notifications on new message/task/timeline/document/COI events — building that mechanism from scratch (schema + RLS + grants + delivery + UI) is a scoped feature in its own right, not a wiring task, so it's flagged here rather than shipped partially verified.

Files still present but now unreferenced by any nav or link (kept, not deleted, per repo convention of not force-deleting pre-existing files without explicit instruction): `app/vendor/inquiries/*`, `app/vendor/venues/*`, `app/vendor/luv/*`, `app/vendor/packages/page.tsx`, `app/vendor/availability/page.tsx` (both now folded into Profile's tabs, so their standalone routes are redundant but still functional if visited directly), `components/vendor-app/vendor-dashboard.tsx`, `vendor-luv-briefing.tsx`, `vendor-health-score-widget.tsx`. Safe to delete in a follow-up cleanup pass once confirmed unneeded.
