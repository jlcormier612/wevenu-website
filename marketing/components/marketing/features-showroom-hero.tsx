"use client";

import Image from "next/image";

import { FEATURES_HERO } from "@/lib/marketing/features-showroom";

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const HEADLINE_TAIL = "the eye.";

function FeaturesHeroHeadline({ text }: { text: string }) {
  if (!text.endsWith(HEADLINE_TAIL)) {
    return <>{text}</>;
  }
  const head = text.slice(0, -HEADLINE_TAIL.length).trimEnd();
  return (
    <>
      {head}{" "}
      <span className="fs-features-hero-headline-tail">{HEADLINE_TAIL}</span>
    </>
  );
}

/**
 * Phase 3A Features editorial split hero.
 * Isolated preview only — does not replace live /features.
 */
export function FeaturesShowroomHero() {
  const hero = FEATURES_HERO;

  function onExplore() {
    const target = document.getElementById(hero.showroomAnchorId);
    if (!target) return;
    target.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }

  return (
    <section className="fs-features-hero" aria-labelledby="features-hero-heading">
      <div className="fs-features-hero-inner">
        <div className="fs-features-hero-copy">
          <p className="fs-features-hero-eyebrow">{hero.eyebrow}</p>
          <h1 id="features-hero-heading" className="fs-features-hero-headline">
            <FeaturesHeroHeadline text={hero.headline} />
          </h1>
          <p className="fs-features-hero-body">{hero.body}</p>
          <button
            type="button"
            className="fs-features-hero-explore"
            onClick={onExplore}
          >
            <span>{hero.exploreLabel}</span>
            <span className="fs-features-hero-explore-arrow" aria-hidden>
              ↓
            </span>
          </button>
        </div>

        <figure className="fs-features-hero-visual">
          <div className="fs-features-hero-frame">
            <Image
              src={hero.imageSrc}
              alt={hero.imageAlt}
              width={1024}
              height={576}
              className="fs-features-hero-img"
              sizes="(max-width: 900px) 100vw, min(640px, 48vw)"
              priority
            />
          </div>
        </figure>
      </div>

      <div className="fs-features-hero-bridge" aria-hidden>
        <span className="fs-features-hero-bridge-rule" />
      </div>
    </section>
  );
}
