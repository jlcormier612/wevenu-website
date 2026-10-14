# Date hold HELD dark-mode contrast

**Status: IN PROGRESS**

| Field | Value |
|-------|--------|
| Target | Sandbox only |
| Prior serving | `c251be9fb29d02933ad5c662262a8828ed82d6b6` |

## Root cause

HELD label and calendar icon use `text-warning-foreground`. In `.dark`, `--warning-foreground` remains `var(--forest-sage)` (dark green) while the card/hold bar sit on forest/heritage sage — low contrast. Adjacent date already uses `text-foreground` (true white in dark).

## Fix

Scoped only on HELD + icon (compact and non-compact): keep `text-warning-foreground`, add `dark:text-foreground` (same pattern as Preferred badge). No global token change; bar surface/actions untouched.
