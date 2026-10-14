# Presentation inventory — email delivery to venue owners

Evidence: source under `components/messaging/`, `components/conversations/`, `components/communication/`, `app/(app)/messaging/health/`, `lib/communication/*`, `lib/conversations/delivery-display.ts`.  
Runtime: Fancy Sandbox Attention / thread badges in `../communication-status-consistency-audit/browser-results.json` (confirmed long failure explanation + next action inline).

---

## Shared source of truth (do not fork)

| Layer | Location |
|-------|----------|
| Stored status / reason | `conversation_messages.status`, `.failure_reason` (+ legacy `messages`) |
| Provider events (internal + timeline) | `conversation_message_events` / `message_events` |
| Status advance | `shouldAdvanceStatus` (`lib/communication/status.ts`) |
| Vocabulary labels | `MESSAGE_STATUS_META` (`lib/communication/status-labels.ts`) |
| Venue-facing resolve | `resolveDeliveryDisplay` → `resolveEmailFailureGuidance` |
| Badge UI | `MessageStatusBadge` |
| Timeline UI | `MessageTimelinePopover` → `getMessageTimelineAction` / `lib/communication/timeline.ts` |
| Attention / counts | `failed` \| `undelivered` only (`attention-history`, `dashboard-counts`) |

| Stored / event | Venue label (when shown) | Notes |
|----------------|--------------------------|-------|
| `accepted` / `email.sent` | Sent | Provider accepted |
| `delivered` / `email.delivered` | Delivered | MTA acceptance — not inbox proof |
| `opened` / `clicked` | Opened / Clicked | Email only; suppressed on SMS |
| `replied` | Replied | |
| `failed` / `email.bounced` | Couldn't deliver | Sticky failure |
| `undelivered` | Not delivered | SMS-oriented |
| `email.delivery_delayed` | *(no status)* | Event only; not in `MESSAGE_STATUS_META` / badge |
| Complaint / suppress | *(not a message status)* | Permissions + health/ops |

---

## Surfaces

### 1. Communication Health — page chrome  
**File:** `app/(app)/messaging/health/page.tsx`

| Element | What owner sees | Prominence | Technical detail? | Action / support? |
|---------|-----------------|------------|-------------------|-------------------|
| Subtitle | “Whether your emails and texts are actually reaching…” | High | No | Frames trust |
| How to read this page | Setup vs retry vs contact support if many fail | High | No | Yes — support for systemic |
| Sent / Delivered / Attention tiles | Counts + red Attention when &gt;0 | High | Footnote `DASHBOARD_COUNT_NOTE` | Attention tile → filtered list |
| Count note | Sent vs Delivered vs pending confirmation | Secondary | Clarifies semantics | No |

**Verified runtime:** Fancy Attention tile showed **50** with destructive styling (prior screenshots).  
**Same event elsewhere:** Failures also appear in Attention list + Inbox + health issues.

---

### 2. Communication Health widget (status card)  
**File:** `components/communication/communication-health-widget.tsx`  
**Data:** `getCommunicationHealth` / `getRecentIssues` (`lib/communication/health.ts`)

| Element | What owner sees | Prominence | Technical detail? | Action / support? |
|---------|-----------------|------------|-------------------|-------------------|
| Excellent / attention / action_required | Headline + detail | High | No | Action Required → contact support |
| Issue rows | Channel emoji + **`issue.reason`** (stored failure text) | High list | Full reason string (bounce prose / legacy JSON-ish) | Link to lead/client/Inbox |

**Confirmed source:** Issue label is raw `failure_reason` / bounce explanation — **not** passed through `MessageStatusBadge` (so no structured next-action split; long prose inline).  
**Runtime:** Prior health screenshots showed Action Required + multiple bounce reason rows.

---

### 3. Message History / Attention list  
**File:** `components/messaging/message-history-list.tsx`

| Element | What owner sees | Prominence | Technical detail? | Action / support? |
|---------|-----------------|------------|-------------------|-------------------|
| Row preview + recipient | Name/preview | Default | No | Link via `messageDestinationHref` |
| Outbound status | `MessageTimelinePopover` → full `MessageStatusBadge` | Default on every row | On failure: explanation + next action always visible; “More details” if diagnostic | Next action may invite support (unknown) or retry/verify address |
| Inbound status | `MESSAGE_STATUS_META` text only | Secondary | No | No |

**Runtime (confirmed):** Attention rows showed  
`❌ Couldn't deliver` + full general/hard bounce explanation + next-action sentences concatenated in badge text.

---

### 4. Inbox / Conversation — expanded bubble  
**File:** `components/conversations/conversation-thread.tsx`

| Element | What owner sees | Prominence | Technical detail? | Action / support? |
|---------|-----------------|------------|-------------------|-------------------|
| Collapsed row | No delivery badge | Hidden | — | — |
| Expanded outbound | Same `MessageTimelinePopover` / badge | On bubble footer | Same as history for failures | |
| Failed styling | `ring-destructive` on bubble | High | — | |
| `RecoveryActions` | Retry / switch channel / task (failure only) | High when failed | No | Yes — actionable |

**Runtime (confirmed):** Client Conversation showed hard-bounce badge + recovery affordances; explanation included reputation language.

---

### 5. Message timeline popover (on-demand)  
**File:** `components/messaging/message-timeline-popover.tsx` + `lib/communication/timeline.ts`

| Element | What owner sees | Prominence | Technical detail? |
|---------|-----------------|------------|-------------------|
| Trigger | Entire status badge is the button | Secondary (click) | |
| Steps | Created / Sent / Delivered / Opened / Clicked / Replied / Couldn't deliver | On demand | Plain labels; **does not** list `delivery_delayed` as a step |

---

### 6. MessageStatusBadge (shared)  
**File:** `components/messaging/message-status-badge.tsx`  
**Resolve:** `lib/conversations/delivery-display.ts`

**Default visible for non-failures:** emoji + short label (Sent, Delivered, …).  
**Default visible for failures:**  
1. ❌ **Couldn't deliver** (semibold)  
2. Full `display.reason` (guidance explanation)  
3. Full `display.nextAction`  
4. Optional `<details>More details</details>` for `diagnosticSafe`

So failure **detail is not progressive** today — only optional diagnostic is behind disclosure.

---

### 7. Other

| Surface | Delivery status? |
|---------|------------------|
| Readiness / test-send copy | Distinguishes provider acceptance vs Delivered (`lib/communication/test-send.ts`) — setup context, not per-message history |
| Dashboard daily briefing | Not a per-email delivery surface (different “needs attention”) |
| Settings communications | Setup, not message lifecycle badges |

---

## Consistency

| Aspect | Assessment |
|--------|------------|
| Label vocabulary | **Consistent** — shared `MESSAGE_STATUS_META` |
| Failure explanation | **Mostly consistent** on badge paths; health **issue rows** show reason without badge structure |
| Same failure multi-surface | **Yes** — Health issues + Attention list + Inbox bubble (+ timeline) |
| Temporary vs permanent | Classified in guidance; both still use same ❌ **Couldn't deliver** label |
| Delayed | **Not** shown as customer status (appropriate quiet) |

---

## Confirmed vs not re-verified this pass

| Item | Class |
|------|--------|
| Badge always shows failure reason + next action | **Confirmed** (source + prior Sandbox runtime) |
| Attention / history use same popover | **Confirmed** (source + runtime) |
| Health issue rows use raw reason | **Confirmed** (source); runtime previously showed bounce prose |
| Timeline omits delivery_delayed | **Confirmed** (source) |
| Every venue’s Production UI | **Not verified** this audit |
