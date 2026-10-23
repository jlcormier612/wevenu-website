# Vendor selection task lifecycle — submit ≠ complete

**STATUS:** IN PROGRESS — code + tests landed; awaiting Sandbox migration + deploy + browser proof.

Production untouched. Unrelated dirty tree preserved.

## Forensic baseline

| Fact | Evidence |
| --- | --- |
| Task creation | Client Planning seed: title “Choose your vendors”, `owner_type=couple`, `visibility=client_owned` (“Client completes”), `auto_complete_trigger=vendor_selected` |
| Prior finish line | `submit_vendor_list` set `status=complete`, `completed_by=system` on every Submit |
| Draft picks | `picked_at` only — never touched the task |
| Isolation | `event_tasks` scoped by `venue_id` + `event_id` |
| Reopen | None on re-submit (once complete, stayed complete) |
| Dependencies | Retired (`depends_on_event_task_id` null) |

## Correct lifecycle (implemented)

1. **Not started** — no submission; `progress_state` null/`not_started`, status pending/overdue  
2. **Submitted / Needs review** — couple Submit → `progress_state=in_progress`, status stays open (reopens if was complete)  
3. **Changes requested** — venue reopens to pending (existing Mark incomplete / pending); trigger syncs progress  
4. **Complete** — venue Mark complete only (existing `completeEventTask_`)

Submit never auto-completes. No duplicate task rows.

## Files

- `supabase/migrations/20261422600000_vendor_selection_task_submit_not_complete.sql`
- `lib/playbooks/constants.ts`, `types.ts`, `repository.ts`
- `components/playbooks/event-task-list.tsx`
- `components/portal/vendor-section.tsx`
- `lib/portal/unified-tasks.ts`
- `lib/portal/vendor-selection-task-lifecycle.test.ts`
