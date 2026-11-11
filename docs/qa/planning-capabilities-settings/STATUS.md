# Planning capabilities → Settings

**Status:** GREEN  
**Production:** untouched  
**Jennifer handoff:** READY (engineering GREEN; optional acceptance)

## Exact running Sandbox image

| Item | Value |
| --- | --- |
| ECS task (sole RUNNING) | `eef1ef7780404ee49908838912b0edf7` |
| Task definition | `htc-sandbox-venue-app:470` |
| Image tag | `e8b9eec95f5b899f37045d5572039e6745a92601` |
| Digest | `sha256:c25f23bd19e5c96da090f3309926c61e48c701204d270d54dabff777adc70972` |
| Health | `/api/health` → 200 |
| Deploy | [36658752504](https://github.com/jlcormier612/wevenu-website/actions/runs/36658752504) → success |
| Fix commit | `e8b9eec9` — Gate portal Home Timeline CTAs on planning Timeline capability |

## Forensic map (SETTING → DATA → CONSUMERS → EFFECT)

| Setting | Data source | Consumers | Customer-facing effect when OFF |
| --- | --- | --- | --- |
| Timeline | `venues.planning_timeline_enabled` | Event Readiness (`caps.timeline`); couple portal section + nav; **Home hero “View Timeline” + `TimelineCard`** via `isPortalSectionEnabledByCapabilities`; playbook apply `filterTasksForVenueCapabilities`; incomplete portal tasks hidden | Timeline readiness row gone; portal Timeline nav/section hidden; **Home Timeline CTAs gone**; no timeline tasks from Planning Templates |
| Floor Plan | `venues.planning_floor_plan_enabled` | Event Readiness floor plans; portal `floor_plans`; template floor_plan tasks | Floor Plans readiness/portal/task generation omitted |
| Seating | `venues.planning_seating_enabled` | Event Readiness seating; portal `seating`; seating_submitted tasks | Seating readiness/portal/task generation omitted |
| Preferred Vendors | `venues.planning_vendors_enabled` | Portal Preferred Vendors nav/section; Guide deep-links; template vendor tasks. **Not** Event Readiness. | Preferred Vendors hidden from couple portal; no vendor-selection tasks from templates |

Persistence: `updateVenuePlanningCapabilities` → venue columns. UI: Settings → Leads & Booking → Planning tools.

### Home Timeline leak (fixed in `e8b9eec9`)

Root cause: Overview hero “View Timeline” and `WorkingWithYourVenue`’s `TimelineCard` in `components/portal/portal-shell.tsx` were capability-blind. Both now gate on `isPortalSectionEnabledByCapabilities("timeline", …)`.

## Browser proof on exact image `e8b9eec9` (SelUse `ceb551d5` / portal `13a8940…`)

### Timeline OFF
- [x] Settings: Timeline OFF; Floor Plan / Seating / Preferred Vendors remain ON; save + reload persists
- [x] Portal Home: **no** hero View Timeline; **no** `🕒 Timeline` / TimelineCard
- [x] Portal nav: **no** Timeline; Floor Plan, Seating, Preferred vendors still present
- [x] Event Readiness: **no** Timeline section; Seating + Floor Plans still present

### Timeline ON (restored — Fancy left ON)
- [x] All four planning switches ON saved
- [x] Portal Home: View Timeline hero + TimelineCard (`Your Timeline is being built…`) return
- [x] Portal nav: `🕒 Timeline` returns
- [x] Event Readiness: Timeline section returns (`Not Started Timeline`)

### Automation
- [x] `npx tsx --test lib/playbooks/planning-capabilities-batch.test.ts` — 12/12 pass (includes Home Timeline OFF CTA regression)

## GREEN gate

- [x] Exact running image = `e8b9eec9`
- [x] Sole RUNNING task on that image (`:470`)
- [x] Health 200
- [x] Settings persist
- [x] Planning Templates remains clean (prior proof; not reopened)
- [x] Timeline OFF removes Home Timeline CTA
- [x] Timeline OFF removes Event Readiness Timeline
- [x] Timeline OFF removes portal Timeline
- [x] Timeline ON restores intended Timeline behavior
- [x] Floor Plan / Seating / Preferred Vendors unchanged by Timeline toggle
- [x] Preferred Vendors remains separate from Event Readiness
- [x] No GlobalError / page-load failure
- [x] Production untouched
- [x] Fancy Venue planning capabilities left **ON**

**Verdict: GREEN.** Workstream closed.
