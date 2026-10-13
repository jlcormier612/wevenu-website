# Availability settings language — copy corrections

**Status: GREEN**

**Copy commit:** `841b2706`  
**Serving tip (includes copy + IAM template):** `ffbe34c7`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/38478298669 **success**

## Browser (Fancy owner, `/settings/availability`)

Evidence: `browser-results.json`, `availability-settings-1280.png`

| Check | Result |
|-------|--------|
| No “simple venue” | PASS |
| Hosts-one-event-at-a-time capacity hint | PASS |
| Capacity ≠ public inquiries | PASS |
| Points to confirmed-event control | PASS |
| Staff limits do not override public preference | PASS |

Behavior unchanged (prior 60/60 unit suites). Production untouched.
