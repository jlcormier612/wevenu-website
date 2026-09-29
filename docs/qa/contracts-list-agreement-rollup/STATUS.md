# Contracts list — agreement/workflow rollup

## Status

IMPLEMENTATION committed. Sandbox proof pending running ECS image.

Production untouched. Rebecca Sunshine & Brian Friendly records not mutated.

## Product rule

List rows are current agreement tips from explicit `contracts.amends_contract_id` only.

Do not infer family from client, title, template, event, relationship, or content.

## Rebecca / Brian fixture audit (read-only)

Not disposable as a blind delete. QA-like names, but the latest contract is the booking spine.

| Record | Id | Notes |
|---|---|---|
| Client | `8b7c6720-79ec-441a-b905-21c5620a507b` | Rebecca Sunshine / Brian Friendly |
| Lead | `a7d75c3e-6e3d-4e88-aa31-00f6fc9552b6` | website inquiry |
| Contracts | `8df17edd`, `5a5f8117`, `0ef3f64d`, `9884ea27` | all `amends_contract_id = null` |
| Selection | `57a32231-03b2-458b-9db5-806312bdb9f0` | accepted Full Service Wedding $25,000 → contract `9884ea27` |
| Invoice | `d56ed889-3e45-4960-9bfc-25b30371c298` | sent $25,000 |
| Schedule | `90c4bab5-ab6e-4311-a2a1-212f1c3c4443` | 4 line items, one overdue |

No Hunter record. No event. No event order.

Coherent later cleanup would remove the whole fixture together. Not this change.

## Controlled lineage already in Sandbox

Jane Smith: `7bec631d` (signed) → `91be3510` (draft, amends V1).
