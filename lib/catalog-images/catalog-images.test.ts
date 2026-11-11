import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  effectiveOfferingImageUrl,
  inventoryItemImageBasePath,
  offeringImageBasePath,
} from "@/lib/catalog-images/types";
import { validateCatalogImageFile } from "@/lib/catalog-images/validate";
import { choicesOptionDraftFromOffering } from "@/lib/client-choices-templates/option-catalog";
import { selectionDefinitionFromEventOrderTemplate } from "@/lib/event-order-templates/selection-definition";
import type { EventOrderTemplateWithDetails } from "@/lib/event-order-templates/types";
import type { OfferingWithCategory } from "@/lib/offerings/types";

describe("catalog image validation", () => {
  it("accepts allowed MIME under size limit", () => {
    const ok = validateCatalogImageFile({ type: "image/jpeg", size: 1024 });
    assert.equal(ok.ok, true);
  });

  it("rejects disallowed MIME and oversized files", () => {
    assert.equal(validateCatalogImageFile({ type: "application/pdf", size: 10 }).ok, false);
    assert.equal(
      validateCatalogImageFile({ type: "image/png", size: 6 * 1024 * 1024 }).ok,
      false,
    );
  });
});

describe("effectiveOfferingImageUrl", () => {
  it("prefers dedicated offering image over inventory fallback", () => {
    assert.equal(
      effectiveOfferingImageUrl({
        imageUrl: "https://example.com/offering.jpg",
        inventoryImageUrl: "https://example.com/inv.jpg",
      }),
      "https://example.com/offering.jpg",
    );
  });

  it("falls back to inventory image when offering has none", () => {
    assert.equal(
      effectiveOfferingImageUrl({
        imageUrl: null,
        inventoryImageUrl: "https://example.com/inv.jpg",
      }),
      "https://example.com/inv.jpg",
    );
  });

  it("returns null when neither image exists", () => {
    assert.equal(effectiveOfferingImageUrl({ imageUrl: "  ", inventoryImageUrl: null }), null);
  });
});

describe("storage path conventions", () => {
  it("keeps venue id as first path segment for policy isolation", () => {
    const venue = "venue-aaa";
    assert.equal(inventoryItemImageBasePath(venue, "item-1").startsWith(`${venue}/`), true);
    assert.equal(offeringImageBasePath(venue, "off-1").startsWith(`${venue}/`), true);
    assert.match(offeringImageBasePath(venue, "off-1"), /\/offerings\//);
  });
});

describe("catalogImageUrlBelongsToVenue", () => {
  it("allows null and same-venue public URLs", async () => {
    const { catalogImageUrlBelongsToVenue } = await import("@/lib/catalog-images/types");
    const venue = "aaaa-bbbb";
    assert.equal(catalogImageUrlBelongsToVenue(null, venue), true);
    assert.equal(
      catalogImageUrlBelongsToVenue(
        `https://x.supabase.co/storage/v1/object/public/inventory/${venue}/item/image.jpg`,
        venue,
      ),
      true,
    );
  });

  it("rejects cross-venue object URLs", async () => {
    const { catalogImageUrlBelongsToVenue } = await import("@/lib/catalog-images/types");
    assert.equal(
      catalogImageUrlBelongsToVenue(
        "https://x.supabase.co/storage/v1/object/public/inventory/other-venue/item/image.jpg",
        "aaaa-bbbb",
      ),
      false,
    );
  });
});

describe("choices draft + freeze snapshot", () => {
  const offering = {
    id: "off-1",
    venueId: "v",
    categoryId: null,
    parentOfferingId: null,
    parentOfferingIds: [],
    name: "Plated Dinner",
    description: null,
    unit: null,
    defaultUnitPrice: 85,
    inventoryItemId: "inv-1",
    imageUrl: null,
    inventoryImageUrl: "https://cdn.example/inv.png",
    isArchived: false,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    categoryName: null,
  } satisfies OfferingWithCategory;

  it("drafts effective image from inventory fallback", () => {
    const draft = choicesOptionDraftFromOffering(offering);
    assert.equal(draft.imageUrl, "https://cdn.example/inv.png");
  });

  it("freezes template option imageUrl into ChoicesDefinition", () => {
    const template = {
      id: "t",
      venueId: "v",
      name: "Pkg",
      description: null,
      sourceMasterKey: null,
      isArchived: false,
      createdAt: "",
      updatedAt: "",
      sections: [],
      lines: [],
      groups: [
        {
          id: "g1",
          templateId: "t",
          venueId: "v",
          sectionId: null,
          name: "Dinner",
          instructions: null,
          selectionMode: "single" as const,
          minSelect: 1,
          maxSelect: 1,
          allowQuantity: false,
          dependsOnOptionIds: [],
          sortOrder: 0,
          createdAt: "",
          updatedAt: "",
        },
      ],
      options: [
        {
          id: "o1",
          templateId: "t",
          venueId: "v",
          groupId: "g1",
          offeringId: "off-1",
          label: "Plated Dinner",
          description: null,
          isIncluded: false,
          unitPrice: 85,
          isDefault: false,
          imageUrl: "https://cdn.example/frozen.png",
          sortOrder: 0,
          createdAt: "",
          updatedAt: "",
        },
      ],
    } satisfies EventOrderTemplateWithDetails;
    const def = selectionDefinitionFromEventOrderTemplate(template);
    assert.equal(def.options[0]?.imageUrl, "https://cdn.example/frozen.png");
  });
});

describe("inventory storage isolation migration", () => {
  it("scopes inventory write/delete policies to venue path prefix", () => {
    const mig = readFileSync(
      resolve("supabase/migrations/20261425900000_offering_images_inventory_storage_isolation.sql"),
      "utf8",
    );
    assert.match(mig, /inventory_storage_insert/);
    assert.match(mig, /current_user_venue_id\(\)::text/);
    assert.match(mig, /add column if not exists image_url text/);
    assert.match(mig, /event_order_template_options/);
    assert.match(mig, /for select to authenticated, anon/);
  });
});
