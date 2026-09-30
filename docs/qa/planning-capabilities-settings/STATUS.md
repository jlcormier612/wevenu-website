# Planning capabilities → Settings

**Status:** IMPLEMENTATION IN PROGRESS — NOT GREEN  
**Production:** untouched

## Forensic map (SETTING → DATA → CONSUMERS → EFFECT)

| Setting | Data source | Consumers | Customer-facing effect when OFF |
| --- | --- | --- | --- |
| Timeline | `venues.planning_timeline_enabled` | Event Readiness (`caps.timeline`); couple portal section `timeline`; playbook apply `filterTasksForVenueCapabilities` (timeline triggers/actions); incomplete portal tasks hidden | Timeline readiness row gone; portal Timeline hidden; no timeline tasks from Planning Templates |
| Floor Plan | `venues.planning_floor_plan_enabled` | Event Readiness floor plans; portal `floor_plans`; template floor_plan tasks | Floor Plans readiness/portal/task generation omitted |
| Seating | `venues.planning_seating_enabled` | Event Readiness seating; portal `seating`; seating_submitted tasks | Seating readiness/portal/task generation omitted |
| Preferred Vendors | `venues.planning_vendors_enabled` | Portal Preferred Vendors nav/section (`isPortalSectionEnabledByCapabilities`, `shouldOfferPreferredVendorsNavigation`); Guide deep-links; template `vendor_selected` / `vendor_library` tasks. **Not** an Event Readiness section today. | Preferred Vendors hidden from couple portal (historical vendor rows retained); no vendor-selection tasks from templates |

Persistence: `updateVenuePlanningCapabilities` → venue columns. UI action: `savePlanningCapabilitiesAction`.

## Product correction

- **Venue Settings (Leads & Booking → Planning tools):** what planning experiences this venue uses.
- **Planning Templates:** reusable checklists only — no venue-wide toggles.
- Copy explains business meaning; Preferred Vendors describes real Vendor Network portal pick/submit behavior.

## GREEN gate

- [x] Controls removed from `/library/playbooks`
- [x] Controls added to `/settings/leads` `#planning`
- [x] Automated IA + capability consumer tests
- [ ] Commit + Sandbox deploy + exact image verify
- [ ] Browser: Settings toggle/persist; Planning Templates clean; Vendor Network behavior
- [ ] Production untouched
