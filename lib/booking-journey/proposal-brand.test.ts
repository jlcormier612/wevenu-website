import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProposalArtifact } from "@/components/booking-journey/proposal-artifact";
import { MultiOptionProposalView } from "@/components/booking-journey/multi-option-proposal-view";
import { proposalBrand } from "@/lib/booking-journey/proposal-view";

const LOGO = "https://cdn.example.com/venue-logo.png";

describe("proposal brand is live venue columns, including logo", () => {
  it("keeps a logo URL and treats blank as null", () => {
    const withLogo = proposalBrand({
      primaryColor: "#111111",
      logoUrl: `  ${LOGO}  `,
    });
    assert.equal(withLogo.logoUrl, LOGO);
    assert.equal(withLogo.primaryColor, "#111111");

    const missing = proposalBrand({ logoUrl: "   " });
    assert.equal(missing.logoUrl, null);
    assert.equal(missing.primaryColor, "#5D6F5D");

    const absent = proposalBrand({});
    assert.equal(absent.logoUrl, null);
  });

  it("preview venueBrand and customer enrichBrand both pass logo_url into proposalBrand", () => {
    const load = readFileSync(resolve("lib/booking-journey/load.ts"), "utf8");
    const offer = readFileSync(resolve("lib/booking-journey/offer.ts"), "utf8");
    assert.match(load, /logoUrl: venue\?\.logoUrl/);
    assert.match(offer, /logo_url, updated_at/);
    assert.match(offer, /versionedVenueAssetUrl\(venue\.logo_url, venue\.updated_at\)/);
    assert.doesNotMatch(load, /branding_snapshot|brandingSnapshot/);
    assert.doesNotMatch(offer, /branding_snapshot|brandingSnapshot/);
  });

  it("sending a proposal does not write a branding snapshot", () => {
    const repository = readFileSync(resolve("lib/commercial-proposals/repository.ts"), "utf8");
    const insert = repository.slice(
      repository.indexOf("export async function insertProposal"),
      repository.indexOf("export async function insertProposalOption"),
    );
    assert.match(insert, /deposit_amount/);
    assert.doesNotMatch(insert, /logo_url|branding_snapshot|primary_color/);
  });
});

describe("shared proposal renderers paint the live logo", () => {
  const brand = proposalBrand({ logoUrl: LOGO, primaryColor: "#123456" });

  it("MultiOptionProposalView shows the logo in preview, review, and accepted", () => {
    const base = {
      venueName: "Jen's Fancy Venue",
      offerMessage: null,
      totalAmount: 15000,
      brand,
      options: [
        {
          id: "pkg",
          offerRole: "primary" as const,
          name: "Essential",
          description: null,
          unitPrice: 15000,
          includedItems: [],
          sortOrder: 0,
        },
      ],
    };

    for (const mode of ["preview", "live"] as const) {
      const html = renderToStaticMarkup(
        createElement(MultiOptionProposalView, {
          offer: { ...base, status: "sent", choices: [] },
          mode,
        }),
      );
      assert.match(html, new RegExp(`src="${LOGO}"`));
      assert.match(html, /Jen&#x27;s Fancy Venue|Jen's Fancy Venue/);
    }

    const accepted = renderToStaticMarkup(
      createElement(MultiOptionProposalView, {
        offer: {
          ...base,
          status: "approved",
          totalAmount: 15000,
          choices: [
            {
              optionId: "pkg",
              quantity: 1,
              unitPrice: 15000,
              lineTotal: 15000,
              name: "Essential",
              offerRole: "primary" as const,
            },
          ],
        },
        mode: "live",
      }),
    );
    assert.match(accepted, new RegExp(`src="${LOGO}"`));
    assert.match(accepted, /data-testid="proposal-venue-logo"/);
    assert.match(accepted, /h-14 w-14/);
    assert.match(accepted, /You approved this selection/);
  });

  it("omits the image when logoUrl is null", () => {
    const html = renderToStaticMarkup(
      createElement(MultiOptionProposalView, {
        offer: {
          venueName: "Jen's Fancy Venue",
          offerMessage: null,
          status: "sent",
          choices: [],
          totalAmount: 0,
          brand: proposalBrand({ logoUrl: null }),
          options: [],
        },
        mode: "live",
      }),
    );
    assert.doesNotMatch(html, /<img/);
    assert.doesNotMatch(html, /data-testid="proposal-venue-logo"/);
    assert.match(html, /Jen&#x27;s Fancy Venue|Jen's Fancy Venue/);
  });

  it("ProposalArtifact accepted state still paints the live logo", () => {
    const html = renderToStaticMarkup(
      createElement(ProposalArtifact, {
        context: "couple",
        proposal: {
          name: "Essential",
          venueName: "Jen's Fancy Venue",
          totalAmount: 15000,
          depositAmount: 0,
          remainingAmount: 15000,
          includedItems: [],
          status: "accepted",
          offerMessage: null,
          brand,
        },
      }),
    );
    assert.match(html, new RegExp(`src="${LOGO}"`));
    assert.match(html, /data-testid="proposal-venue-logo"/);
    assert.match(html, /h-14 w-14/);
    assert.match(html, /You&#x27;ve accepted this package|You've accepted this package/);
  });

  it("ProposalArtifact uses the same logo contract", () => {
    const html = renderToStaticMarkup(
      createElement(ProposalArtifact, {
        context: "couple",
        proposal: {
          name: "Essential",
          venueName: "Jen's Fancy Venue",
          totalAmount: 15000,
          depositAmount: 0,
          remainingAmount: 15000,
          includedItems: [],
          status: "offered",
          offerMessage: null,
          brand,
        },
      }),
    );
    assert.match(html, new RegExp(`src="${LOGO}"`));

    const bare = renderToStaticMarkup(
      createElement(ProposalArtifact, {
        context: "venue-preview",
        proposal: {
          name: "Essential",
          venueName: "Jen's Fancy Venue",
          totalAmount: 15000,
          depositAmount: 0,
          remainingAmount: 15000,
          includedItems: [],
          status: "offered",
          offerMessage: null,
          brand: proposalBrand({}),
        },
      }),
    );
    assert.doesNotMatch(bare, /<img/);
  });
});
