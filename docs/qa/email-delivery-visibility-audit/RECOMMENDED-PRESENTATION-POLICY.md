# Recommended presentation policy

**Principle:** Quiet by default. Actionable when necessary. Detailed when useful.  
**Constraint:** Preserve delivery architecture, webhooks, stored diagnostics, Attention/count **semantics**. Change **presentation density and placement**, not truthfulness.

This is a recommendation only — **not** authorization to implement.

---

## Treatment legend

| Treatment | Meaning |
|-----------|---------|
| **Default visibility** | Show routinely without click |
| **Secondary visibility** | On demand (expand / popover / “Why?”) or quieter chrome |
| **Internal diagnostics** | Keep in DB/events/ops; not venue-default |
| **Actionable guidance** | Show only when evidence supports a venue action |

---

## Policy by status / event

| Status / event | Recommended treatment | Rationale | Risks / dependencies |
|----------------|----------------------|-----------|----------------------|
| Sending / Sent (`accepted`) | **Default** — short label | Normal progress; already calm | None |
| Delivered | **Default** — short label; keep count footnote that this is provider confirmation | Truthful without overclaiming inbox | Owners may still over-read “Delivered”; optional microcopy only if product wants |
| Opened / Clicked | **Default** short label on email where already shown | Engagement signal; not a warning | Rare in Sandbox; SMS already suppressed |
| Replied | **Default** short label | Clear positive | None |
| `email.delivery_delayed` | **Internal** (keep events); optional later **Secondary** “Still sending” only if product wants intermediate calm state | Must not look like permanent failure | UI does not show today — good default |
| Temporary bounce (`failed` + temporary category) | **Default:** short “Couldn't deliver” (or calmer “Not delivered yet” *only if* product accepts label tweak without changing status enum). **Actionable / Secondary:** explanation + “try again later / confirm address” | Evidence supports retry; full prose shouldn’t dominate every list row | Don’t rename status enum without copy review; counts stay on `failed` |
| Permanent bounce | **Default:** short failure label. **Actionable:** verify/update email (calm). Drop/hide “reputation” scare language from default | Address fix is the useful action | Keep full bounce payload internal |
| Invalid recipient (422) | **Default** short label + **Actionable** fix address | Clear venue action | Sandbox example.com noise |
| Quota / rate / configuration | **Internal diagnostics** + calm systemic Health if ratio triggers; avoid per-message “you broke email” | Venue cannot fix Resend quota | Ops/CloudWatch already; Health Action Required copy already covers systemic |
| Unknown failure | **Default** short label. **Secondary** honest “we couldn’t determine why.” Support invite only if **repeated** or Health systemic — not every unknown row | Quoted support path over-invites today | Classification must stay honest; don’t invent causes |
| Complaint / suppression | **Internal** + permission enforcement; surface only if blocking a send the owner tries | Rare; not per-history noise | None |
| Timeline (Created→…) | **Secondary** (keep click-to-open) | Useful when curious; already on demand | Don’t dump raw `email.*` types |
| “More details” diagnostic | **Secondary / Internal** — keep behind disclosure or support-only | Already partially progressive | Ensure secrets stay redacted |

---

## “Couldn't deliver” + unknown + support — assessment

Current stack (failures):

1. Label: **Couldn't deliver** (`MESSAGE_STATUS_META.failed`)  
2. Explanation: category-specific or unknown (“exact cause could not be determined…”)  
3. Next action: often support invite (`SUPPORT_NEXT`) for unknown / provider-error  

| Part | When justified | When anxiety-inducing |
|------|----------------|------------------------|
| Short “Couldn't deliver” | Any confirmed failure status | Alone is fine if not bold-red everywhere |
| Long bounce / provider prose **always visible** | Rarely needed in list default | **Unnecessarily prominent** on every Attention/history row and bubble |
| Temporary bounce guidance | When category is temporary | OK if secondary; alarming if same visual weight as outage |
| Hard bounce + reputation warning | Internal / secondary at most | **Anxiety** without helping most venues |
| “Contact HTC support + share message time” | Systemic Health, repeated unknown, config failure | **Not** justified for every unknown or every fixture bounce |

**Smallest presentation changes (if later approved):**

1. **Badge default = label only** (and failure emoji). Move `reason` + `nextAction` into timeline popover or a single “Why?” disclosure.  
2. Keep **RecoveryActions** on failed Inbox bubbles (already actionable).  
3. Health **issue rows**: show short label + link; put long reason behind secondary or omit if badge/popover will show it.  
4. Soften unknown next-action: support only when Health is Action Required or owner opens detail twice / repeats — product rule TBD.  
5. Strip or demote reputation scare sentences from default explanation (copy-only; keep event payload).  
6. **Do not** change Attention membership (`failed`/`undelivered`) or Sent/Delivered rollups to “simplify” UI.

---

## Surface-level presentation intents

| Surface | Keep | Quiet / move |
|---------|------|--------------|
| Sent / Delivered tiles | Counts + footnote | Don’t add failure prose |
| Attention tile | Count of true failures | Avoid implying all are venue fault; list can be calmer per-row |
| Attention / Recent rows | Short status + navigate to conversation | Full explanation/next-action → secondary |
| Inbox bubble | Short status; recovery tools on fail | Long explanation default-off |
| Timeline popover | Steps + (if opened) guidance | Right place for detail |
| Health widget | Excellent vs some failures vs systemic | Issue list: shorter; support on systemic only |

---

## Dependencies before implementation

1. Product sign-off on **label-only default** vs keeping one-line calm guidance always visible.  
2. Confirm guidance categories remain reliable (temporary vs permanent vs unknown) — already mostly available.  
3. Align Health issue rows with badge policy (today they bypass `MessageStatusBadge`).  
4. Decide whether temporary failures keep the same Attention count (recommended: **yes** — semantics unchanged; presentation only).  
5. Copy review for hard-bounce / reputation language.  
6. Sandbox fixture failure volume must not drive Production Health “Action Required” interpretation (separate ops concern).

---

## What not to do

- Do not delete webhook payloads, failure_reason storage, or timeline data.  
- Do not invent a second status model for “calm UI.”  
- Do not hide all failures — owners still need Attention when something actionable or systemic is wrong.  
- Do not claim Delivered = primary inbox.
