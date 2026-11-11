"use client";

import Image from "next/image";

import {
  CONCEPT_B_STEP_ASSETS,
  FEATURES_SPOTLIGHT_ASSETS,
  SPOTLIGHT_FLEXIBILITY,
  SPOTLIGHT_JOURNEY,
  SPOTLIGHT_PREPARED,
  type SpotlightConcept,
} from "@/lib/marketing/features-spotlights";

import "@/app/features-spotlights.css";

const SHOWROOM_SELECT_EVENT = "htc:features-showroom-select";

function exploreSalesCollection() {
  if (typeof window === "undefined") return;
  const collectionId = SPOTLIGHT_JOURNEY.ctaCollectionId;
  window.dispatchEvent(
    new CustomEvent(SHOWROOM_SELECT_EVENT, {
      detail: { collectionId, scroll: true },
    }),
  );
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => {
    const target = document.getElementById("features-showroom");
    if (!target) return;
    const header = document.querySelector("header.sticky");
    const headerOffset =
      header instanceof HTMLElement ? header.getBoundingClientRect().height + 12 : 112;
    const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: reduced ? "auto" : "smooth" });
  });
}

type FeaturesSpotlightsProps = {
  concept: SpotlightConcept;
};

/**
 * Phase 3B differentiator spotlights — isolated Features previews only.
 * Concept A: Editorial Hospitality (photography-led) · Concept B: Product-Led Editorial
 */
export function FeaturesSpotlights({ concept }: FeaturesSpotlightsProps) {
  return (
    <div
      className={
        concept === "a"
          ? "fs-spotlights fs-spotlights-a"
          : "fs-spotlights fs-spotlights-b"
      }
    >
      {concept === "a" ? <ConceptASpotlights /> : <ConceptBSpotlights />}
    </div>
  );
}

function ConceptASpotlights() {
  const a = FEATURES_SPOTLIGHT_ASSETS;

  return (
    <>
      {/* 01 — From first interest to booked */}
      <section
        className="fs-spot fs-spot-a1 fs-spot-journey"
        aria-labelledby="fs-spot-a1-heading"
      >
        <div className="fs-spot-inner fs-spot-journey-inner">
          <div className="fs-spot-copy">
            <p className="fs-spot-eyebrow">{SPOTLIGHT_JOURNEY.eyebrow}</p>
            <h2 id="fs-spot-a1-heading" className="fs-spot-headline">
              {SPOTLIGHT_JOURNEY.headline}
            </h2>
            {SPOTLIGHT_JOURNEY.body.map((paragraph, index) => (
              <p
                key={paragraph.slice(0, 32)}
                className={
                  index === 1 ? "fs-spot-body fs-spot-body-closer" : "fs-spot-body"
                }
              >
                {paragraph}
              </p>
            ))}
            <div className="fs-spot-journey-cta">
              <button
                type="button"
                className="fs-spot-cta"
                onClick={exploreSalesCollection}
              >
                {SPOTLIGHT_JOURNEY.ctaLabel}
              </button>
            </div>
          </div>

          <div
            className="fs-spot-journey-visual"
            role="group"
            aria-label="Hospitality photography for the journey from interest to booked"
          >
            <figure className="fs-spot-photo fs-spot-journey-primary">
              <div className="fs-spot-photo-frame is-journey-primary">
                <Image
                  src={a.journeyPrimary.src}
                  alt={a.journeyPrimary.alt}
                  width={1400}
                  height={933}
                  className="fs-spot-photo-img is-journey-primary"
                  sizes="(max-width: 899px) 100vw, 52vw"
                  priority={false}
                />
              </div>
            </figure>
            <figure className="fs-spot-photo fs-spot-journey-secondary">
              <div className="fs-spot-photo-frame is-journey-secondary">
                <Image
                  src={a.journeySecondary.src}
                  alt={a.journeySecondary.alt}
                  width={1024}
                  height={682}
                  className="fs-spot-photo-img is-journey-secondary"
                  sizes="(max-width: 899px) 72vw, 26vw"
                />
              </div>
            </figure>
          </div>
        </div>
      </section>

      {/* 02 — Thoughtfully prepared */}
      <section
        className="fs-spot fs-spot-a2 fs-spot-prepared"
        aria-labelledby="fs-spot-a2-heading"
      >
        <div className="fs-spot-inner fs-spot-prepared-inner">
          <div className="fs-spot-copy fs-spot-copy-wide">
            <p className="fs-spot-eyebrow">{SPOTLIGHT_PREPARED.eyebrow}</p>
            <h2 id="fs-spot-a2-heading" className="fs-spot-headline">
              {SPOTLIGHT_PREPARED.headline}
            </h2>
            {SPOTLIGHT_PREPARED.body.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="fs-spot-body">
                {paragraph}
              </p>
            ))}
          </div>

          <div
            className="fs-spot-prepared-visual"
            role="group"
            aria-label="Preparation leading to a personal celebration"
          >
            <figure className="fs-spot-photo fs-spot-prepared-primary">
              <div className="fs-spot-photo-frame is-prepared-primary">
                <Image
                  src={a.preparedPrimary.src}
                  alt={a.preparedPrimary.alt}
                  width={1400}
                  height={933}
                  className="fs-spot-photo-img is-prepared-primary"
                  sizes="(max-width: 899px) 100vw, 58vw"
                />
              </div>
              <figcaption className="fs-spot-photo-cap">
                <span className="fs-spot-photo-label">Prepared with care</span>
                <span className="fs-spot-photo-line">
                  Signature details, ready to personalize.
                </span>
              </figcaption>
            </figure>
            <figure className="fs-spot-photo fs-spot-prepared-secondary">
              <div className="fs-spot-photo-frame is-prepared-secondary">
                <Image
                  src={a.preparedSecondary.src}
                  alt={a.preparedSecondary.alt}
                  width={1400}
                  height={933}
                  className="fs-spot-photo-img is-prepared-secondary"
                  sizes="(max-width: 899px) 88vw, 34vw"
                />
              </div>
              <figcaption className="fs-spot-photo-cap">
                <span className="fs-spot-photo-label">Made for them</span>
                <span className="fs-spot-photo-line">
                  A celebration that feels entirely their own.
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* 03 — Made for the way you work */}
      <section
        className="fs-spot fs-spot-a3 fs-spot-flexibility"
        aria-labelledby="fs-spot-a3-heading"
      >
        <div className="fs-spot-inner fs-spot-flexibility-inner">
          <div className="fs-spot-copy fs-spot-copy-wide">
            <p className="fs-spot-eyebrow">{SPOTLIGHT_FLEXIBILITY.eyebrow}</p>
            <h2 id="fs-spot-a3-heading" className="fs-spot-headline">
              {SPOTLIGHT_FLEXIBILITY.headline}
            </h2>
            {SPOTLIGHT_FLEXIBILITY.body.map((paragraph, index) => (
              <p
                key={paragraph.slice(0, 32)}
                className={
                  index === 1 ? "fs-spot-body fs-spot-body-closer" : "fs-spot-body"
                }
              >
                {paragraph}
              </p>
            ))}
          </div>

          <div
            className="fs-spot-flexibility-visual"
            role="group"
            aria-label="Two venue experiences Hello to Cheers can support"
          >
            <figure className="fs-spot-photo fs-spot-flex-intimate">
              <div className="fs-spot-photo-frame is-flex-intimate">
                <Image
                  src={a.intimateCandlelit.src}
                  alt={a.intimateCandlelit.alt}
                  width={1400}
                  height={933}
                  className="fs-spot-photo-img is-intimate"
                  sizes="(max-width: 899px) 100vw, 42vw"
                />
              </div>
              <figcaption className="fs-spot-photo-cap">
                <span className="fs-spot-photo-label">
                  {SPOTLIGHT_FLEXIBILITY.intimate.label}
                </span>
                <span className="fs-spot-photo-line">
                  {SPOTLIGHT_FLEXIBILITY.intimate.caption}
                </span>
              </figcaption>
            </figure>
            <figure className="fs-spot-photo fs-spot-flex-estate">
              <div className="fs-spot-photo-frame is-flex-estate">
                <Image
                  src={a.multiSpaceVenue.src}
                  alt={a.multiSpaceVenue.alt}
                  width={1400}
                  height={933}
                  className="fs-spot-photo-img is-estate"
                  sizes="(max-width: 899px) 100vw, 48vw"
                />
              </div>
              <figcaption className="fs-spot-photo-cap">
                <span className="fs-spot-photo-label">
                  {SPOTLIGHT_FLEXIBILITY.multiSpace.label}
                </span>
                <span className="fs-spot-photo-line">
                  {SPOTLIGHT_FLEXIBILITY.multiSpace.caption}
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>
    </>
  );
}

function ConceptBSpotlights() {
  const a = FEATURES_SPOTLIGHT_ASSETS;

  return (
    <>
      <section
        className="fs-spot fs-spot-b1"
        aria-labelledby="fs-spot-b1-heading"
      >
        <div className="fs-spot-inner fs-spot-b1-inner">
          <div className="fs-spot-copy fs-spot-copy-wide">
            <p className="fs-spot-eyebrow">{SPOTLIGHT_FLEXIBILITY.eyebrow}</p>
            <h2 id="fs-spot-b1-heading" className="fs-spot-headline">
              {SPOTLIGHT_FLEXIBILITY.headline}
            </h2>
            {SPOTLIGHT_FLEXIBILITY.body.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="fs-spot-body">
                {paragraph}
              </p>
            ))}
            <p className="fs-spot-product-note">{SPOTLIGHT_FLEXIBILITY.productNote}</p>
          </div>

          <figure className="fs-spot-screen fs-spot-screen-hero">
            <div className="fs-spot-screen-frame is-hero">
              <Image
                src={a.setupHub.src}
                alt={a.setupHub.alt}
                width={1440}
                height={1100}
                className="fs-spot-screen-img"
                sizes="(max-width: 900px) 100vw, min(920px, 72vw)"
                priority={false}
              />
            </div>
            <figcaption className="fs-spot-screen-cap">
              Setup Hub — where your venue’s operating model takes shape
            </figcaption>
          </figure>

          <div className="fs-spot-b1-pair" role="group" aria-label="Two venue models">
            <figure className="fs-spot-photo is-secondary">
              <div className="fs-spot-photo-frame">
                <Image
                  src={a.intimateVenue.src}
                  alt={a.intimateVenue.alt}
                  width={1024}
                  height={538}
                  className="fs-spot-photo-img"
                  sizes="(max-width: 900px) 100vw, 34vw"
                />
              </div>
              <figcaption className="fs-spot-photo-cap">
                <span className="fs-spot-photo-label">
                  {SPOTLIGHT_FLEXIBILITY.intimate.label}
                </span>
                <span className="fs-spot-photo-line">
                  {SPOTLIGHT_FLEXIBILITY.intimate.caption}
                </span>
              </figcaption>
            </figure>

            <figure className="fs-spot-photo is-secondary">
              <div className="fs-spot-photo-frame">
                <Image
                  src={a.multiSpaceSecondary.src}
                  alt={a.multiSpaceSecondary.alt}
                  width={1200}
                  height={800}
                  className="fs-spot-photo-img"
                  sizes="(max-width: 900px) 100vw, 34vw"
                />
              </div>
              <figcaption className="fs-spot-photo-cap">
                <span className="fs-spot-photo-label">
                  {SPOTLIGHT_FLEXIBILITY.multiSpace.label}
                </span>
                <span className="fs-spot-photo-line">
                  {SPOTLIGHT_FLEXIBILITY.multiSpace.caption}
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section
        className="fs-spot fs-spot-b2"
        aria-labelledby="fs-spot-b2-heading"
      >
        <div className="fs-spot-inner fs-spot-b2-inner">
          <div className="fs-spot-copy fs-spot-copy-wide">
            <p className="fs-spot-eyebrow">{SPOTLIGHT_PREPARED.eyebrow}</p>
            <h2 id="fs-spot-b2-heading" className="fs-spot-headline">
              {SPOTLIGHT_PREPARED.headline}
            </h2>
            {SPOTLIGHT_PREPARED.body.map((paragraph) => (
              <p key={paragraph.slice(0, 32)} className="fs-spot-body">
                {paragraph}
              </p>
            ))}
          </div>

          <ol className="fs-spot-steps fs-spot-steps-b">
            {SPOTLIGHT_PREPARED.steps.map((step, index) => {
              const asset = CONCEPT_B_STEP_ASSETS[step.imageKey];
              const reverse = index % 2 === 1;
              return (
                <li
                  key={step.number}
                  className={
                    reverse ? "fs-spot-step-row is-reverse" : "fs-spot-step-row"
                  }
                >
                  <figure className="fs-spot-screen">
                    <div className="fs-spot-screen-frame is-immersive">
                      <Image
                        src={asset.src}
                        alt={asset.alt}
                        width={1280}
                        height={980}
                        className="fs-spot-screen-img"
                        sizes="(max-width: 900px) 100vw, 54vw"
                      />
                    </div>
                  </figure>
                  <div className="fs-spot-step-copy">
                    <p className="fs-spot-step-num">{step.number}</p>
                    <h3 className="fs-spot-step-title">{step.title}</h3>
                    <p className="fs-spot-step-body">{step.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </>
  );
}
