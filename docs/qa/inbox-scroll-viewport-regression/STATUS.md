# Inbox scroll/viewport regression

**Status: IMPLEMENTATION — Sandbox deploy/verify pending**

| Field | Value |
|-------|--------|
| Root cause | Page-flow `scrollIntoView` pulls `[data-workspace-main]` under sticky workspace header (68px overlap = bottom white gap) |
| Fix | `scrollWorkspaceMainToElement` — adjust main `scrollTop` only |
| Files | `lib/conversations/page-flow-scroll.ts`, `components/conversations/conversation-thread.tsx` |
| Focused tests | `page-flow-scroll.test.ts` + inbox product suite |
| Production | Untouched |

See `FORENSIC.md`.
