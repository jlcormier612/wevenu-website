# Offerings page copy correction — STATUS

**Verdict:** OPEN — awaiting Sandbox deploy + browser verify  
**Production:** untouched  

## Before → after

| Block | Before | After |
|---|---|---|
| Page description | Category org + “Catalog edits do not change…” | Approved services/packages/options + reuse across EO Templates |
| LibraryHowItWorks | Long included-lines / follow-ups / without duplicating / finalization | One **How Offerings work** explanation |
| LibraryDependencyNote | Repeated EO selection mechanics | Unique: stock link + Distinct from Available Inventory; EO + Inventory links kept |
| List intro paragraphs | Third/fourth repeat of purpose | **Removed** |

## Evidence (existing Event Orders)

`lib/library/template-catalog-integration.test.ts`: apply snapshots offering price; `eventPriceAfterTemplateCatalogChange(45, 99) === 45`. Claim about live event rewrite is **not** stated on this page; EO Templates page already documents snapshot apply.

## Tests / browser

```bash
npx tsx --test lib/offerings/offerings-page-copy.test.ts
EXPECTED_SHA=<sha> npx tsx docs/qa/offerings-page-copy-correction/verify-browser.mts
```
