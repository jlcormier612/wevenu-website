import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/**
 * Contract Builder create mode used to crash the page with React #185
 * (maximum update depth) because `signers = []` and inline `?? []` /
 * `: []` produced new references every render, retriggering a setState effect.
 */
describe("ContractBuilder create-mode render stability", () => {
  const src = readFileSync(
    resolve("components/contracts/contract-builder.tsx"),
    "utf8",
  );

  it("uses module-level stable empty arrays instead of default-param []", () => {
    assert.match(src, /const EMPTY_SIGNERS/);
    assert.match(src, /const EMPTY_CONTACTS/);
    assert.match(src, /const EMPTY_CANDIDATES/);
    assert.doesNotMatch(src, /signers\s*=\s*\[\]/);
    assert.match(src, /signersProp \?\? EMPTY_SIGNERS/);
    assert.match(src, /contactsByClientId\[clientId\] \?\? EMPTY_CONTACTS/);
    assert.match(src, /: EMPTY_CANDIDATES/);
  });

  it("guards signer reset setState against no-op updates", () => {
    assert.match(src, /setSelectedSignerIds\(\(prev\) => \(prev\.length === 0 \? prev : \[\]\)\)/);
    assert.match(src, /setSignersInitialized\(\(prev\) => \(prev \? false : prev\)\)/);
  });

  it("exposes a destination-named escape path to Contracts", () => {
    assert.match(src, /CollectionBackLink/);
    assert.match(src, /href="\/contracts"/);
    assert.match(src, /label="Contracts"/);
  });
});

describe("Template/catalog collection escape paths", () => {
  it("provides CollectionBackLink for Available Inventory editors", () => {
    const src = readFileSync(resolve("components/inventory/inventory-item-form.tsx"), "utf8");
    assert.match(src, /CollectionBackLink/);
    assert.match(src, /href="\/library\/inventory"/);
    assert.match(src, /label="Available Inventory"/);
    assert.match(src, /confirmLeave/);
  });

  it("provides CollectionBackLink for Packages editors", () => {
    const src = readFileSync(resolve("components/packages/package-form.tsx"), "utf8");
    assert.match(src, /CollectionBackLink/);
    assert.match(src, /href="\/packages"/);
    assert.match(src, /label="Packages"/);
    assert.match(src, /confirmLeave/);
  });

  it("keeps Event Order Template detail back to its collection", () => {
    const src = readFileSync(
      resolve("components/event-order-templates/event-order-template-detail.tsx"),
      "utf8",
    );
    assert.match(src, /backHref="\/library\/event-order-templates"/);
    assert.match(src, /backLabel="Event Order Templates"/);
  });

  it("keeps Inventory Template detail back to its collection", () => {
    const src = readFileSync(
      resolve("components/event-inventory/inventory-template-detail.tsx"),
      "utf8",
    );
    assert.match(src, /backHref="\/library\/inventory-templates"/);
    assert.match(src, /backLabel="Inventory Templates"/);
  });

  it("names Offerings escape inside the offering editor sheet", () => {
    const src = readFileSync(
      resolve("components/offerings/offerings-library-section.tsx"),
      "utf8",
    );
    assert.match(
      src,
      /onClick=\{\(\) => onOpenChange\(false\)\}[\s\S]{0,120}Offerings/,
    );
  });

  it("requires destination-named libraryLabel on preview chrome", () => {
    const chrome = readFileSync(
      resolve("components/library/library-preview-chrome.tsx"),
      "utf8",
    );
    assert.match(chrome, /libraryLabel: string/);
    assert.match(chrome, /ArrowLeft/);

    const eo = readFileSync(
      resolve("app/(app)/library/event-order-templates/[id]/preview/page.tsx"),
      "utf8",
    );
    assert.match(eo, /libraryLabel="Event Order Templates"/);

    const inv = readFileSync(
      resolve("app/(app)/library/inventory-templates/[id]/preview/page.tsx"),
      "utf8",
    );
    assert.match(inv, /libraryLabel="Inventory Templates"/);

    const pkg = readFileSync(resolve("app/(app)/packages/[id]/preview/page.tsx"), "utf8");
    assert.match(pkg, /libraryLabel="Packages"/);
  });
});

describe("venue-app deployment id remains wired for skew protection", () => {
  it("keeps Next deploymentId on NEXT_DEPLOYMENT_ID", () => {
    const config = readFileSync(resolve("next.config.ts"), "utf8");
    assert.match(config, /deploymentId:\s*process\.env\.NEXT_DEPLOYMENT_ID/);
  });
});
