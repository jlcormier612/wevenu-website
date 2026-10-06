# Launch Blocker #2 — Implementation Status

**STATUS:** 🔴 NOT GREEN  
**Date:** 2026-10-06  
**Production:** untouched  
**Sandbox app serving at last check:** `data-dpl-id=5c6ec487…` (pre-fix image)  
**Sandbox deploy queued:** https://github.com/jlcormier612/wevenu-website/actions/runs/37526923136 (`450ba20a`)

## Sandbox cleanup performed

Migration `20261413000000_repair_juniper_owner_identity_sandbox.sql`  
Apply: https://github.com/jlcormier612/wevenu-website/actions/runs/37526527262  
Result: `venues` UPDATE 0 (owner already reverted) + `venue_staff` UPDATE 1

| Target | After repair |
|---|---|
| Juniper `af2d6aa1…` `owner_user_id` | `6721694e…` (purchaser `jlcormier612@gmail.com`), not Fancy |
| Staff `f26f53a4…` (`jyagnesak@yahoo.com`) | `user_id` null, `accepted_at` null, `is_owner` false, `owner_invite_pending` true, new `invite_token` |
| Fancy `2fa73101…` Juniper membership | none |
| Fancy membership at Fancy | untouched |
| Purchaser Juniper admin+billing | untouched |
| Yahoo auth `bb2c2bf3…` | still has no Juniper membership; pending invite can now be accepted as that email |

This repair is Sandbox-row-targeted and is a no-op on any other environment.

## What is proven on Sandbox DB (live RPC)

Disposable identities only. All 18 required RPC cases passed, plus Juniper repair reads.

Browser E2E and serving-chain proof of `450ba20a` are **not** complete while the queued Sandbox deploy has not replaced `5c6ec487`.
