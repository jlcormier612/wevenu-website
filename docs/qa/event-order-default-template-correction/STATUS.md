# Event Order default template correction — STATUS

**Verdict:** pending deploy + browser verification.

## Implementation

- Canonical masters `EO-D-01` / `EO-D-02` now ship included fixed lines + choice groups (`lib/event-order-templates/starters.ts`).
- Provision inserts groups/options; `upgradeUncustomizedLegacyFlatStarter` upgrades zero-group legacy flats only; customized templates skipped.
- `ensureStarterCommercialStructure` on Library ensure + template apply heal.
- Required-group validation: `validateChoicesAnswers` + portal submit route + `submit_client_choices` migration.

## Evidence

See `ROOT-CAUSE.md`, `BEFORE-AFTER.md`, unit tests, `verify-browser.mts`.

## Production

Untouched (Sandbox-only deploy + Sandbox migration).
