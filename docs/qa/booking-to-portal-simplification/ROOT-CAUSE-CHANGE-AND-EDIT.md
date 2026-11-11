# Root cause — Change for this event / Planning edit / badge naming

**Preflight:** HEAD `470e0d18`; serving product `0ff9098b`. Settings/Profiles frozen.

## Causes

1. **Change for this event** set `changing=step`, which revealed Set up / Skip — not an event editor. Profile-included areas must open the workspace, not re-decide inclusion.
2. **Badge** appended profile name (`Draft · Standard Wedding Setup`) on every card, conflating lifecycle status with profile identity. Template names belong in the summary / a dedicated label.
3. **Open Planning** reached the Planning management tab, which is the correct event-specific task editor, but draft Client Planning still offered a second Release CTA, and missing venue applications still showed the generic “No team checklist applied yet” empty state without applying the profile-selected template.
4. Inventory/Event Order Unavailable was fixed in `0ff9098b`; remaining work is Change/Open/edit consistency.

## Fix direction (downstream only)

- Change → navigate to event workspace (same editors as Open).
- Explicit “Don’t include for this event” for supported overrides (not Set up/Skip chooser).
- Badge = lifecycle only; template name from applied/configured template.
- Planning: prefer Overview release; preselect profile templates; recover venue/client when refs exist.
