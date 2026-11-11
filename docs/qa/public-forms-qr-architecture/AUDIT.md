# Public Forms + QR Experiences — Architecture / Forensic Audit

**Mode:** Read-only. **NO CODE. NO MIGRATIONS. NO FIXTURES. NO DEPLOY.**  
**Date:** 2026-09-26  
**Production / Sandbox runtime:** untouched by this pass  
**Verdict:** Architecture clear enough to design; **not** implementation-ready without an authorized build pass.

---

## Executive finding

Hello to Cheers already has a strong **public lead-capture form stack** and a separate **QR distribution stack**. They are correctly layered today as:

```
QR campaign (distribution)
  → redirect + ?qr={campaignId}
    → single venue inquiry form OR tour booking OR wedding site OR external URL
      → Lead Intake pipeline → Lead / Relationship
```

What is missing is a **multi-instance Public Form object**.

Today there is **exactly one inquiry form configuration per venue** (`venues.embed_key` + venue-level field/question settings). QR codes can only point at that one form (or tour / website / external). A venue cannot create a purpose-specific “Wedding Expo” form with its own title, description, and question set while reusing branding and lead integrity.

**Do not** build a QR-specific form engine.  
**Do** generalize the existing inquiry/public form framework into **Public Form**, with QR as one distributor.

Questionnaire templates / couple questionnaires are a **different domain** (post-booking planning). Do not reuse that engine for lead capture.

---

## 1. Current inquiry / public form architecture

### What exists

| Layer | Location | Role |
|---|---|---|
| Public URL | `/form/{embed_key}` → `app/form/[key]/page.tsx` | One public page per venue |
| Config load | `get_public_inquiry_form(p_embed_key)` RPC + `lib/inquiry-form/service.ts` | Branding, fields, questions, tour flags, GA4, SMS prefs |
| UI | `components/form/inquiry-form.tsx` | Dual mode: Request Info / Schedule Tour |
| Validation | `lib/inquiry-form/validation.ts` | Standard + custom questions |
| Submit | `POST /api/public/inquire` | Info path |
| Tour submit | `POST /api/tours/book` (+ protection checkout path) | Tour path |
| Staff builder | Settings → Leads / Website Forms → `InquiryFormConfigSection` | Field visibility, accepted event types, custom questions, communication prefs |
| Question store | `inquiry_form_questions` | **Scoped to `venue_id` only** (one question bank for the venue) |

### Form definition model (today)

Not a first-class form row. Configuration is **venue-scoped columns + child questions**:

- `venues.embed_key` — public token (one per venue)
- `venues.inquiry_form_fields` — jsonb visibility for standard fields (`phone`, `partner`, `guest_count`, `estimated_budget`, `preferred_event_date`, `event_details`)
- `venues.inquiry_event_date_mode` — `choose_available` | `request_preferred`
- `venues.accepted_inquiry_event_types`
- `venues.inquiry_communication_settings`
- `inquiry_form_questions` — custom questions (`short_answer`, `long_answer`, `single_select`, `multiple_select`)

Always-required identity fields are **hardcoded in the UI + API**, not configurable:

- First name, last name, email, **event type**

There is **no** internal name / public title / public description entity beyond the hard-coded chrome:

- Header: venue logo + venue name + literal **“Inquiry Form”**
- No per-campaign copy

### Submission behavior

1. Client builds `source_data` (UTM, referrer, landing page, `custom_answers`, optional `qr_campaign_id`)
2. `ingestLead()` (`lib/lead-intake/pipeline.ts`) — normalize → validate → attempt log → rate limit / Turnstile escalation → create callback → sequence enrollment → owner assignment → duplicate review
3. Create callback calls `create_public_lead(...)` RPC → DB `ingest_lead(..., 'website', ...)`
4. Lead source key: **`website`** (even when arrived via QR)
5. Confirmation email to inquirer + notification email to venue (if `FROM_EMAIL` / venue email configured)
6. SMS consent applied separately via `applyInquiryCommunicationCapture` — **phone ≠ SMS consent**

Custom answers are **not first-class columns**; they live in `leads.source_data.custom_answers`.

### Spam / security (already present)

- Honeypot (`__hp` / `website_url`)
- Rate limiting (`lead-intake/rate-limit`)
- Turnstile escalation near rate limit
- Anon RPCs by embed key
- Venue isolation via embed key → venue id
- RLS on staff-facing question rows

### Branding (already reusable)

- Venue logo, primary/secondary/accent/neutral colors from venue record
- `lib/theme/public-form-surface.ts` light-surface lock for public forms
- Favicon / brand helpers in `lib/venue-brand/`
- No per-form branding config today — **correct inheritance model already**

---

## 2. Current QR code architecture

### Model

`qr_campaigns` (many per venue):

| Column | Meaning |
|---|---|
| `name` | Venue-facing campaign name |
| `code` | Public token → `/qr/{code}` |
| `destination_type` | enum: `inquiry_form` \| `tour_booking` \| `wedding_website` \| `external_url` |
| `destination_url` | Used for wedding website + external URL |
| `status` | `active` \| `archived` |
| `source_master_key` | Starter-library provenance |

`qr_scans` — append-only scan log (UA, referrer).

### Resolve path

`GET /qr/{code}` → `resolve_qr_scan` (records scan) → redirect:

| Destination | Redirect target |
|---|---|
| `inquiry_form` | `/form/{venue.embed_key}?qr={campaignId}` |
| `tour_booking` | tour public path `?qr={campaignId}` |
| `wedding_website` / `external_url` | stored URL + `?qr=` |

Inquiry/tour destination URLs are resolved **live** from venue keys (not baked into the campaign) — good.

### Analytics

`get_qr_campaign_analytics`:

- **scans** = count(`qr_scans`)
- **conversions** = count(leads where `source_data->>'qr_campaign_id' = campaign.id`)

UI: Library → QR Campaigns (`components/qr-campaigns/qr-campaign-list.tsx`).

### Design intent vs runtime

Original design (`docs/qr-lead-capture-design.md`) proposed a `lead_sources` row `qr_code` for display when QR→inquiry. **Runtime still writes `source: "website"`** and relies on `source_data.qr_campaign_id` for campaign identity. That is workable; campaign identity is preserved. Display labeling can be improved later without a parallel lead model.

### Critical QR limitation

QR destinations are a **closed enum of page types**, not “point at Form X.”

There is **no** `public_form_id` (or equivalent) on `qr_campaigns`.

Multiple QR → same form is already natural for today’s single inquiry form (many campaigns can all choose `inquiry_form`). Multiple QR → **different custom forms** is impossible until forms are multi-instance.

---

## 3. Current lead / contact creation path

Canonical path for public inquiry:

```
Source adapter (/api/public/inquire)
  → ingestLead (TS pipeline)
    → create_public_lead (SQL)
      → ingest_lead (SQL) — relationship resolution + lead insert
```

Preserved invariants (must keep for Public Forms):

- Creates **Lead + Relationship** when appropriate
- Returning relationship detection (`isReturningRelationship`)
- Does **not** create Event / Contract / Invoice / Payment plan
- Duplicate reviews for external intake
- Message-sequence trigger on `lead_created` (when automation allowed)
- Frozen `acquisition_source` / operational `source` distinction already exists in reporting foundation

Tour booking is a sibling adapter (`book_tour` / protected tour) that also calls `ingest_lead` and can stash `qr_campaign_id`.

---

## 4. Current source attribution model

| Mechanism | Status |
|---|---|
| `leads.source` / `lead_sources` | Catalogued keys (`website`, tour, Meta, import, …) |
| `leads.source_data` jsonb | Flexible bag: `form_key`, `inquiry_mode`, `custom_answers`, UTM, referrer, landing_page, **`qr_campaign_id`**, GA4 anon id |
| QR conversions | Join on `source_data.qr_campaign_id` |
| Reporting attribution helpers | `lib/attribution/*`, `lib/metrics/deeper-attribution.ts` |

**Gap for purpose-built forms:** nothing like `public_form_id` / `public_form_name` is written today — because only one form exists. QR campaign name is the only “campaign label,” and only when `?qr=` survives into submit.

---

## 5. Current branding system

Reusable as-is for Public Forms:

- Venue brand columns on `venues`
- `PublicInquiryVenue` projection
- `publicFormSurfaceStyle` / light theme lock
- Public favicon helpers

Venues should **not** reconfigure branding per form. Override branding is optional future scope, not required for v1.

---

## 6. Current public URL / token system

| Token | Cardinality | Use |
|---|---|---|
| `venues.embed_key` | 1 per venue | Inquiry form |
| `venues.tour_embed_key` | 0–1 per venue | Tour booking |
| `qr_campaigns.code` | many per venue | QR redirector |
| Questionnaire access keys | many | Couple planning (out of scope) |

Pattern already proven for **many public tokens per venue**: QR codes, vendor invitations, couple websites. Public Forms should follow that pattern (dedicated table + public key), **not** overload `embed_key`.

---

## 7. Current form builder capabilities

Staff inquiry builder already supports:

- Standard field visibility (required / optional / hidden)
- Accepted event types
- Custom questions with types + required + options + order (replace-all save)
- Communication preference / SMS permission request toggles
- Preview via public link
- Owner/Manager gate

Missing for Public Form product:

- Multiple forms per venue
- Internal name vs public title vs description
- Publish / archive lifecycle per form
- Form-level question sets (questions today are global to venue)
- Ability to hide/relax inquiry-specific hard requirements (e.g. event type) for expo-style capture **without** corrupting inquiry semantics
- Create-from-QR or choose-existing-form in QR builder

---

## 8. Current scan tracking

Already sufficient for v1 reporting foundation:

- Scan events with campaign_id
- Lead conversion via `qr_campaign_id` in `source_data`
- UI shows scans + leads created

Do **not** build a full analytics dashboard in first implementation. Do **preserve**:

- QR campaign id on submit
- Public form id/name on submit
- Optional campaign/event label fields

---

## 9. Existing reusable components / services (keep)

| Asset | Reuse how |
|---|---|
| `ingestLead` + `create_public_lead` / generalized create RPC | Lead integrity |
| `InquiryForm` UI + branding surface | Render engine (parameterized) |
| Question type/validation model | Field framework |
| `InquiryFormConfigSection` patterns | Builder UX |
| QR campaigns + resolve + analytics | Distribution |
| SMS consent helpers | Explicit consent only |
| Rate limit / Turnstile / honeypot | Public security |
| `source_data` attribution bag | Form + QR identity |

**Do not reuse** couple questionnaire templates as the lead-capture form engine — wrong lifecycle, wrong audience, wrong submission semantics.

---

## 10. Exact gaps preventing purpose-built public forms

1. **Single form per venue** — no multi-form table / public key.
2. **Questions tied to venue**, not to a form instance.
3. **Hard-coded public chrome** (“Inquiry Form”) — no public title/description.
4. **QR destination enum** has no “custom public form” / form FK.
5. **Inquiry semantics baked into one page** (event type required, dual tour mode) — not always right for expo/open-house capture.
6. **No `public_form_id` in `source_data`** — attribution can’t answer “which form” separately from “which QR.”
7. **Staff IA** — Settings configures “the” inquiry form; Library has QR campaigns; no “Marketing / Public Forms” object surface.
8. Design doc’s `qr_code` lead_source display path was never fully productized (secondary; campaign id already works).

---

## 11. Recommended domain model

### Principle

```
PublicForm (experience + fields + submission policy)
  ↓ public URL
QR Campaign / other distribution (optional many-to-one)
  ↓ submit
Lead Intake (unchanged canonical lifecycle)
```

### Recommended shape (conceptual — not an implementation mandate)

**A. `public_forms` (new first-class object)**

- `id`, `venue_id`
- `internal_name`
- `public_title`, `public_description`
- `status` (`draft` | `active` | `archived`)
- `public_key` (unique token → `/f/{key}` or `/form/{key}` strategy TBD)
- `kind` / `template_role`: e.g. `general_inquiry` | `custom_lead_capture` (extensible)
- Field config jsonb (standard field visibility — reuse inquiry vocabulary where applicable)
- Submission policy flags (e.g. require event type? offer tour mode? show SMS consent UI?)
- Timestamps

**B. `public_form_questions`**

- Same shape as `inquiry_form_questions`, but **`public_form_id` FK** (not only venue_id)
- Reuse question types exactly

**C. Legacy inquiry as specialized Public Form**

Preferred long-term:

- Migrate the current venue inquiry config into one system Public Form with `kind = general_inquiry` (or `is_default_inquiry = true`)
- Keep `/form/{embed_key}` working as a stable alias to that form
- Preserve tour dual-mode behavior only on that specialized form (or via policy flags)

Safer short-term alternative (Wave 1):

- Leave existing inquiry form untouched as the default
- Add `public_forms` only for **additional** custom forms
- QR gains destination `public_form` + `public_form_id`
- Later unify inquiry into the same table

**Recommendation:** Wave 1 = additive custom Public Forms + QR destination; Wave 2 = promote legacy inquiry into the same table without breaking URLs. Do **not** force a big-bang replace of inquiry on day one.

**D. `qr_campaigns` extension**

- Add nullable `public_form_id`
- Extend `destination_type` with `public_form` (or treat `inquiry_form` as “default inquiry public form” and `public_form` as explicit FK)
- Keep existing destinations working
- Multiple QR → same `public_form_id` is naturally supported (no extra schema)

**E. Submissions**

Prefer **not** inventing a parallel `public_form_submissions` lead store.

- Continue creating Leads via intake
- Persist answers + provenance in `source_data` (and optionally a thin submission audit table later if needed for immutable answer history)
- Suggested `source_data` keys:
  - `public_form_id`
  - `public_form_internal_name` / `public_form_public_title`
  - `qr_campaign_id` (existing)
  - `qr_campaign_name` (optional denormalized label for reporting)
  - `custom_answers` (existing shape)

**F. Lead source key**

Keep using existing `website` (or add `public_form` to `lead_sources` if product wants a distinct display bucket). Do **not** create a parallel lead type. QR identity stays in `source_data`.

---

## 12. Recommended UI flow

### Public Forms (Library or Lead Capture)

1. Create Public Form  
2. Internal name / public title / description  
3. Configure standard fields + custom questions (reuse builder patterns)  
4. Preview (venue branding automatic)  
5. Publish → copy public URL  
6. Optional: “Create QR for this form”

### QR builder (extend existing)

Destination radios:

- Custom public form → pick existing / create new  
- Existing inquiry form (legacy / default)  
- Tour booking  
- Couple wedding website  
- External URL  

Preserve archive/reactivate + scan/conversion counts.

### Do not

- Force new form creation for every QR  
- Embed form definition inside the QR row  
- Invent silent SMS automation from phone fields  

---

## 13. Recommended migration strategy

| Wave | Scope |
|---|---|
| **Wave 0 (this audit)** | Architecture only — done |
| **Wave 1** | Additive `public_forms` + questions; public render/submit path reusing intake; QR `public_form` destination; attribution keys; staff CRUD + QR picker |
| **Wave 2** | Promote default inquiry into Public Form table; alias `embed_key`; retire venue-only question table |
| **Wave 3** | Templates (Wedding Expo, Open House starters), richer analytics (form×QR funnel), optional multi-channel distribution |

No production cut required for Wave 1 if additive and feature-gated.

---

## 14. Files likely to change (when authorized)

**Domain / DB**

- New migration(s) for `public_forms`, `public_form_questions`, QR FK/enum
- Possibly extend `create_public_lead` or add `create_public_form_lead` adapter that still calls `ingest_lead`

**Services**

- New `lib/public-forms/*` (or generalize `lib/inquiry-form/*`)
- `lib/qr-campaigns/types.ts`, `service.ts`
- `app/qr/[code]/route.ts`

**Public UI**

- New public route for form key (or parameterized `/form/...`)
- Generalize `components/form/inquiry-form.tsx` (or thin wrapper)

**Staff UI**

- Library Public Forms list/editor
- `components/qr-campaigns/qr-campaign-list.tsx`
- Settings inquiry section remains for default inquiry until Wave 2

**Tests**

- See §15

---

## 15. Tests required (when authorized)

1. Public form CRUD + publish/archive isolation by venue  
2. Public render uses venue branding; no staff-only leakage  
3. Submit creates Lead via intake; no Event/Contract/Invoice  
4. Custom answers + `public_form_id` + `qr_campaign_id` land in `source_data`  
5. Staff-only / wrong-venue form key → 404 / reject  
6. QR → custom form redirect preserves `?qr=`  
7. Multiple QR campaigns → same form; conversion counts per QR  
8. Existing inquiry form + QR inquiry_form destination regression  
9. Tour / wedding website / external QR destinations unchanged  
10. Phone present without SMS checkbox → no SMS consent  
11. Spam honeypot / rate limit still apply  
12. Event-type policy: inquiry form still requires accepted types; custom form policy respected  
13. Home/reporting attribution does not invent booking conversion  

---

## 16. Security / legal considerations

- Keep anon access via public key + SECURITY DEFINER RPCs only  
- Preserve honeypot, rate limit, Turnstile escalation  
- Do not weaken RLS on staff form definitions  
- **Phone ≠ SMS consent** — reuse `requestSmsPermission` UI + `applyInquiryCommunicationCapture`; add a consent source constant for public forms if needed (do not invent new meaning)  
- Confirmation emails: reuse existing pattern; no silent SMS/email beyond already-supported configured paths  
- Legal footer / venue contact: inherit inquiry form practices  

---

## 17. Risks

| Risk | Mitigation |
|---|---|
| Collapsing custom forms into the single inquiry config | Makes expo forms overwrite general inquiry — reject |
| Treating questionnaires as public lead forms | Wrong lifecycle — reject |
| Embedding form JSON inside QR rows | Blocks multi-QR → one form — reject |
| Requiring event type on all public forms | Bad for some expo captures — make policy per form |
| Changing `leads.source` semantics carelessly | Prefer additive `source_data`; keep intake catalog |
| Big-bang migrate inquiry on Wave 1 | Prefer additive Wave 1 |
| Silently enabling SMS from phone | Explicit consent only |
| Parallel submission table becoming a second CRM | Lead remains canonical |

---

## 18. Can existing inquiry forms safely become a specialized Public Form?

**Yes — as a later specialization, not as a destructive rewrite.**

- Inquiry today is already a Public Form experience with extra policies (event type, date mode, optional tour mode, SMS prefs).
- Safest path: **introduce Public Form for custom captures first**, keep `/form/{embed_key}` inquiry working unchanged, then migrate inquiry into the same table with a `general_inquiry` kind / default flag and URL alias.
- Forcing every Public Form to behave exactly like inquiry (tour selector + required event type) would **corrupt** expo/open-house UX.
- Forcing inquiry to lose those policies would **break** existing lead-capture and tour dual-path product.

So: **same engine, different policy profiles** — not one identical UX for all forms.

---

## Direct answers to product questions

| Question | Answer |
|---|---|
| Separate QR form system? | **No** |
| Second form engine? | **No** |
| Duplicate inquiry architecture? | **No — generalize it** |
| QR vs Public Form? | **Different objects; QR distributes** |
| Multiple QR per form? | **Schema should allow; Wave 1 naturally supports via FK** |
| Inherit branding? | **Yes — already how inquiry works** |
| Submission = lead capture only? | **Yes — reuse intake; no booking side effects** |
| Use questionnaire framework? | **No for lead capture** |

---

## Recommended next step after authorization

Implement **Wave 1 only**:

1. Additive Public Form model + public URL + submit-through-intake  
2. QR destination `public_form` + form picker  
3. Attribution keys for form + QR  
4. Focused tests + Sandbox proof  

Do **not** start with analytics dashboards, starter template packs, or inquiry big-bang migration.

---

## STOP

Audit complete. Awaiting implementation authorization before any code, migrations, fixtures, or deploys.
