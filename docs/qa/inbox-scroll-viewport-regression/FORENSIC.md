# Inbox scroll/viewport regression — forensic

**Date:** 2026-10-14  
**Mode:** Reproduced on Sandbox before fix

## Reproduction

1. Fancy Sandbox → Inbox → client conversation with many emails  
   (`e389ecd5-4c11-42ca-af5f-4896c76df69b`, Rebecca Sunshine & Brian)
2. On open (before any expand), layout already broken.

## Measurements (serving pre-fix)

| Route | header.top | main.top | overlap (header.bottom − main.top) |
|-------|-----------:|---------:|-----------------------------------:|
| `/dashboard` | 0 | **68** | 0 |
| `/messaging` (list) | 0 | **68** | 0 |
| `/messaging?conversation=…` | 0 | **0** | **68** |

Shell remains `fixed inset-0` height 800. With `main.top = 0` and `main.height = 732`, a **68px white band** appears at the bottom of the viewport (exactly the workspace header height). Screenshots: `probe-after-collapse.png`, `06-scroll-bottom.png`.

## Root cause

In `ConversationThread` **page flow** (Inbox), after messages load:

```ts
topRef.current?.scrollIntoView({ behavior, block: "start" });
```

`scrollIntoView` scrolls ancestors such that `main` is pulled under the sticky workspace header. Expand/collapse then runs inside that broken geometry (scroll anchoring), so the gap/displacement feels tied to expanding emails — but the overlap is already present on conversation open.

Contained flow (Booking Workspace) scrolls its own overflow element and was not implicated.

## Fix direction

Page flow must only adjust `[data-workspace-main].scrollTop` (see `lib/conversations/page-flow-scroll.ts`). Do not call `scrollIntoView` from the Inbox thread.
