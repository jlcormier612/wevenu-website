import Image from "next/image";

import {
  PRODUCT_OPENING_ASSETS as A,
  PRODUCT_PAGE,
} from "@/lib/marketing/product-page";

import "@/app/product-opening.css";

/**
 * Product page Sections 1–2 — venue hero + client/vendor connected experiences.
 * Client + vendor frames: exact user-provided Sandbox screenshots.
 * Journey remains below.
 */
export function ProductOpening() {
  const p = PRODUCT_PAGE;

  return (
    <div className="htc-product">
      {/* ── §1 Venue-first hero ── */}
      <section className="po-hero" aria-labelledby="product-opening-hero">
        <div className="po-wrap">
          <div className="po-hero-copy po-center">
            <p className="po-kicker">{p.openingHero.eyebrow}</p>
            <h1 id="product-opening-hero" className="po-title">
              {p.openingHero.headline}
            </h1>
            <p className="po-lede">{p.openingHero.support}</p>
          </div>

          <div className="po-hero-stage" aria-hidden={false}>
            <figure className="po-desktop-frame">
              <Image
                src={A.venueDashboardDesktop}
                alt="The Willow Grove venue dashboard in Hello to Cheers — business snapshot, today's focus, and upcoming events"
                width={2000}
                height={1250}
                priority
                sizes="(max-width: 640px) 100vw, min(1080px, 92vw)"
              />
            </figure>

            <div className="po-phone-frame" aria-hidden="true">
              <div className="po-phone-notch" />
              <div className="po-phone-screen">
                <Image
                  src={A.venueDashboardMobile}
                  alt=""
                  width={780}
                  height={1688}
                  sizes="220px"
                />
              </div>
            </div>
            <span className="sr-only">
              Mobile venue dashboard for The Willow Grove shown beside the desktop workspace
            </span>
          </div>
        </div>
      </section>

      {/* ── §2 Connected experiences ── */}
      <section className="po-connected" aria-labelledby="product-connected-heading">
        <div className="po-wrap-wide">
          <header className="po-connected-intro po-center">
            <p className="po-kicker">{p.connected.eyebrow}</p>
            <h2 id="product-connected-heading" className="po-title">
              {p.connected.headline}
            </h2>
            <p className="po-lede">{p.connected.support}</p>
          </header>

          <div className="po-showcase">
            {/* Client — primary */}
            <article className="po-block po-block-client" aria-labelledby="product-client-heading">
              <div className="po-block-copy">
                <p className="po-kicker">{p.clientShowcase.eyebrow}</p>
                <h3 id="product-client-heading" className="po-title">
                  {p.clientShowcase.headline}
                </h3>
                <p className="po-block-body">{p.clientShowcase.body}</p>
              </div>

              <div className="po-block-visual po-client-visual">
                <figure className="po-shot po-shot-primary po-shot-blush">
                  <Image
                    src={A.clientHomeHero}
                    alt="Olivia and James client Home in Hello to Cheers — personalized Willow Grove hero with countdown and planning actions"
                    width={1024}
                    height={619}
                    sizes="(max-width: 720px) 100vw, (max-width: 960px) 60vw, 680px"
                    priority
                  />
                </figure>
                <figure className="po-shot po-shot-planning">
                  <Image
                    src={A.clientPlanningCards}
                    alt="Client Home planning cards — Wedding Website, Guest List, Budget, Seating, Plans, and Our Story"
                    width={913}
                    height={298}
                    sizes="(max-width: 720px) 100vw, 380px"
                  />
                </figure>
              </div>
            </article>

            {/* Vendor — complementary */}
            <article className="po-block po-block-vendor" aria-labelledby="product-vendor-heading">
              <div className="po-block-copy">
                <p className="po-kicker">{p.vendorShowcase.eyebrow}</p>
                <h3 id="product-vendor-heading" className="po-title">
                  {p.vendorShowcase.headline}
                </h3>
                <p className="po-block-body">{p.vendorShowcase.body}</p>
              </div>

              <div className="po-block-visual po-vendor-visual">
                <figure className="po-shot po-shot-vendor-primary">
                  <Image
                    src={A.vendorFloraHomeWithNotification}
                    alt="Flora and Branch vendor Home with notifications open — Olivia and James selected for The Willow Grove"
                    width={1024}
                    height={558}
                    sizes="(max-width: 720px) 100vw, (max-width: 960px) 60vw, 680px"
                  />
                </figure>
                <figure className="po-shot po-shot-overview">
                  <Image
                    src={A.vendorHayesOverview}
                    alt="Olivia and James Hayes wedding event Overview for Flora and Branch — arrival, setup location, tasks, and day-of details"
                    width={848}
                    height={440}
                    sizes="(max-width: 720px) 100vw, (max-width: 960px) 60vw, 680px"
                  />
                </figure>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>
  );
}
