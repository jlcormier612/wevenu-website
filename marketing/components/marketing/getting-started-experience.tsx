import Image from "next/image";
import Link from "next/link";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { SignatureClosingCta } from "@/components/marketing/signature-closing-cta";
import {
  GETTING_STARTED_ASSETS as A,
  GETTING_STARTED_PAGE,
} from "@/lib/marketing/getting-started-page";

import "@/app/getting-started.css";

/**
 * Getting Started — five-section sales-conversion page.
 * Narrative order aligns with Setup Hub milestones:
 * configure (Make It Yours) → Bring Your Business → Practice → close.
 * Section interiors stay as approved; only chapter order changes.
 */
export function GettingStartedExperience() {
  const page = GETTING_STARTED_PAGE;

  return (
    <div className="gs-page">
      {/* 1. Hero */}
      <section className="gs-hero" aria-labelledby="gs-hero-heading">
        <div className="gs-wrap">
          <div className="gs-hero-grid">
            <div className="gs-hero-copy">
              <p className="gs-eyebrow">{page.hero.eyebrow}</p>
              <h1 id="gs-hero-heading" className="gs-headline">
                {page.hero.headline}
              </h1>
              <p className="gs-support">{page.hero.support}</p>
              <p className="gs-body">{page.hero.body}</p>
              <div className="gs-cta-row">
                <MarketingCta
                  href={page.hero.primaryCta.href}
                  label={page.hero.primaryCta.label}
                  variant="primary"
                />
                <MarketingCta
                  href={page.hero.secondaryCta.href}
                  label={page.hero.secondaryCta.label}
                  variant="secondary"
                  className="gs-hero-secondary"
                />
              </div>
            </div>

            <figure className="gs-hero-photo">
              <Image
                src={A.hero}
                alt={page.hero.imageAlt}
                width={1024}
                height={682}
                priority
                sizes="(max-width: 899px) 100vw, 52vw"
              />
            </figure>
          </div>
        </div>
      </section>

      {/* 2. Make It Yours (configure / operating environment — before import) */}
      <section className="gs-miy" id="make-it-yours" aria-labelledby="gs-miy-heading">
        <div className="gs-wrap">
          <div className="gs-miy-grid">
            <div className="gs-miy-copy">
              <p className="gs-eyebrow">{page.makeItYours.eyebrow}</p>
              <h2 id="gs-miy-heading" className="gs-headline">
                {page.makeItYours.headline}
              </h2>
              <p className="gs-body">{page.makeItYours.body}</p>
              <div className="gs-miy-secondary">
                <p className="gs-miy-secondary-title">{page.makeItYours.secondary}</p>
                <p className="gs-body">{page.makeItYours.secondaryBody}</p>
              </div>
              <p className="gs-body gs-miy-closing">{page.makeItYours.closing}</p>
            </div>

            <figure className="gs-shot gs-miy-shot">
              <div className="gs-shot-frame">
                <Image
                  src={A.setupHub}
                  alt={page.makeItYours.setupAlt}
                  width={984}
                  height={768}
                  sizes="(max-width: 899px) 100vw, 55vw"
                />
              </div>
            </figure>
          </div>
        </div>
      </section>

      {/* 3. Bring Your Business (import chapter — after configuration story) */}
      <section
        className="gs-byb"
        id={page.bringYourBusiness.id}
        aria-labelledby="gs-byb-heading"
      >
        <div className="gs-wrap">
          <header className="gs-byb-intro">
            <p className="gs-eyebrow">{page.bringYourBusiness.eyebrow}</p>
            <h2 id="gs-byb-heading" className="gs-headline">
              {page.bringYourBusiness.headline}
            </h2>
            <p className="gs-body">{page.bringYourBusiness.intro}</p>
          </header>

          <ul className="gs-byb-groups">
            {page.bringYourBusiness.groups.map((group) => (
              <li key={group.title} className="gs-byb-card">
                <h3 className="gs-byb-group-title">{group.title}</h3>
                <p className="gs-byb-group-body">{group.body}</p>
              </li>
            ))}
          </ul>

          <div className="gs-byb-emphasis">
            <p className="gs-byb-emphasis-title">
              <span className="gs-byb-emphasis-line">
                {page.bringYourBusiness.emphasis[0]}
              </span>{" "}
              <span className="gs-byb-emphasis-line">
                {page.bringYourBusiness.emphasis[1]}
              </span>
            </p>
            <p className="gs-body">{page.bringYourBusiness.emphasisBody}</p>
          </div>

          <div className="gs-byb-showcase">
            <figure className="gs-shot gs-byb-shot-a">
              <span className="gs-shot-label">{page.bringYourBusiness.shotALabel}</span>
              <div className="gs-shot-frame">
                <Image
                  src={A.importEntry}
                  alt={page.bringYourBusiness.shotAAlt}
                  width={1024}
                  height={451}
                  sizes="(max-width: 899px) 100vw, 88vw"
                />
              </div>
            </figure>
            <figure className="gs-shot gs-byb-shot-b">
              <span className="gs-shot-label">{page.bringYourBusiness.shotBLabel}</span>
              <div className="gs-shot-frame">
                <Image
                  src={A.connectedWorkspace}
                  alt={page.bringYourBusiness.shotBAlt}
                  width={1440}
                  height={1100}
                  sizes="(max-width: 899px) 100vw, 88vw"
                />
              </div>
            </figure>
            <p className="gs-byb-reassure">
              <span className="gs-byb-reassure-line">
                {page.bringYourBusiness.reassurance[0]}
              </span>{" "}
              <span className="gs-byb-reassure-line">
                {page.bringYourBusiness.reassurance[1]}
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* 4. Practice Run */}
      <section className="gs-practice" aria-labelledby="gs-practice-heading">
        <div className="gs-wrap-wide">
          <header className="gs-practice-intro">
            <p className="gs-eyebrow">{page.practiceRun.eyebrow}</p>
            <h2 id="gs-practice-heading" className="gs-headline">
              {page.practiceRun.headline}
            </h2>
            <p className="gs-body">{page.practiceRun.body}</p>
            <p className="gs-body">{page.practiceRun.secondary}</p>
            <p className="gs-practice-emphasis">{page.practiceRun.emphasis}</p>
            <p className="gs-practice-reassure">{page.practiceRun.reassurance}</p>
          </header>

          <div className="gs-practice-pair">
            <figure className="gs-shot gs-practice-venue">
              <span className="gs-shot-label">{page.practiceRun.venueLabel}</span>
              <div className="gs-shot-frame gs-practice-frame">
                <Image
                  src={A.practiceVenue}
                  alt={page.practiceRun.venueAlt}
                  width={1280}
                  height={820}
                  sizes="(max-width: 899px) 100vw, 46vw"
                />
              </div>
            </figure>
            <div className="gs-practice-cue" aria-hidden="true">
              →
            </div>
            <figure className="gs-shot gs-practice-client">
              <span className="gs-shot-label">{page.practiceRun.clientLabel}</span>
              <div className="gs-shot-frame gs-practice-frame">
                <Image
                  src={A.practiceClient}
                  alt={page.practiceRun.clientAlt}
                  width={1280}
                  height={820}
                  sizes="(max-width: 899px) 100vw, 46vw"
                />
              </div>
            </figure>
          </div>
        </div>
      </section>

      {/* 5. Closing CTA */}
      <SignatureClosingCta
        headingId="gs-closing-heading"
        className="gs-closing"
        eyebrow={page.closing.eyebrow}
        headline={page.closing.headline}
        body={page.closing.body}
        bodyVariant="lines"
        surface="botanical"
        actions={[
          {
            href: page.closing.primaryCta.href,
            label: page.closing.primaryCta.label,
            variant: "primary",
          },
          {
            href: page.closing.secondaryCta.href,
            label: page.closing.secondaryCta.label,
            variant: "secondary",
          },
        ]}
        note={
          <>
            {page.closing.noteBefore}
            <Link href={page.closing.noteHref} className="underline underline-offset-4">
              {page.closing.noteLinkLabel}
            </Link>
            {page.closing.noteAfter}
          </>
        }
      />
    </div>
  );
}
