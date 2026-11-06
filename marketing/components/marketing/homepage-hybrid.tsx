import Image from "next/image";
import Link from "next/link";

import { HOME_ASSETS, HOME_COPY } from "@/lib/marketing/homepage-v3";

import "@/app/homepage-v3.css";

/**
 * Homepage from the approved manuscript.
 * Hero + connected journey through invitation.
 * Capabilities catalog removed from homepage (data retained for Features redesign).
 * FeatureExplorer component preserved (not rendered).
 */
export function HomepageHybrid() {
  const c = HOME_COPY;
  const a = HOME_ASSETS;

  return (
    <div className="htc-home">
      {/* 1. HERO — editorial photography + approved manuscript copy */}
      <section className="hero" aria-labelledby="home-hero-heading">
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="hero-eyebrow">{c.hero.eyebrow}</p>
            <h1 id="home-hero-heading">
              {c.hero.headlineLine1}
              <br />
              {c.hero.headlineLine2}
            </h1>
            <p className="hero-lede">{c.hero.lede}</p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href={c.hero.primaryCta.href}>
                {c.hero.primaryCta.label}
              </Link>
              <Link className="btn btn-secondary" href={c.hero.secondaryCta.href}>
                {c.hero.secondaryCta.label}
              </Link>
            </div>
          </div>

          <figure className="hero-photo">
            <Image
              src={a.heroHospitalityAiry}
              alt="Venue professional arranging florals and candles on a long reception table"
              fill
              priority
              sizes="(max-width: 768px) 100vw, min(1280px, 100vw)"
            />
          </figure>
        </div>
      </section>

      {/* 2. CONNECTED JOURNEY — editorial photography trio + five-stage path */}
      <section className="journey" id="journey" aria-labelledby="journey-heading">
        <div className="journey-inner">
          <header className="journey-intro">
            <p className="journey-eyebrow">{c.journey.kicker}</p>
            <h2 className="journey-headline" id="journey-heading">
              {c.journey.headline}
            </h2>
            <div className="journey-lede">
              <p>{c.journey.body}</p>
            </div>
          </header>

          <ul className="journey-moments" aria-label="Connected journey moments">
            {(
              [
                { asset: a.journeyFirstHello, ...c.journey.moments[0], position: "journey-pos-a" },
                { asset: a.journeyCollaboration, ...c.journey.moments[1], position: "journey-pos-b" },
                { asset: a.journeyFinalCheers, ...c.journey.moments[2], position: "journey-pos-c" },
              ] as const
            ).map((moment) => (
              <li key={moment.title} className="journey-moment">
                <figure className="journey-photo">
                  <Image
                    src={moment.asset}
                    alt={moment.alt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 900px) 33vw, 411px"
                    className={moment.position}
                  />
                </figure>
                <h3 className="journey-caption-title">{moment.title}</h3>
                <p className="journey-caption-body">{moment.caption}</p>
              </li>
            ))}
          </ul>

          <ol className="journey-stages" aria-label="Connected event journey">
            {c.journey.steps.map((step, index) => (
              <li key={step} className="journey-stage">
                <span className="journey-marker" aria-hidden>
                  {index + 1}
                </span>
                <span className="journey-stage-label">{step}</span>
              </li>
            ))}
          </ol>

          <p className="journey-closing">{c.journey.closing}</p>
        </div>
      </section>

      {/* 3. YOUR VENUE — editorial split: venue identity photography + approved copy */}
      <section className="personalize" id="your-venue" aria-labelledby="personalize-heading">
        <div className="personalize-inner">
          <figure className="personalize-photo">
            <Image
              src={a.venueYourWayEditorial}
              alt="The Willow Grove Venue presentation booklet styled with florals, linens, and venue photographs"
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 900px) 100vw, 614px"
              className="personalize-photo-img"
            />
          </figure>
          <div className="personalize-copy">
            <p className="personalize-eyebrow">{c.personalize.kicker}</p>
            <h2 className="personalize-headline" id="personalize-heading">
              {c.personalize.headline}
            </h2>
            <div className="personalize-body">
              <p>{c.personalize.lede}</p>
              <p>{c.personalize.body}</p>
              <p>{c.personalize.body2}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. OPERATIONS — panoramic venue + four equal operational pillars */}
      <section className="operations" id="operations" aria-labelledby="operations-heading">
        <div className="operations-inner">
          <header className="operations-intro">
            <p className="operations-eyebrow">{c.operations.kicker}</p>
            <h2 className="operations-headline" id="operations-heading">
              {c.operations.headline}
            </h2>
            <p className="operations-lede">{c.operations.lede}</p>
          </header>

          <figure className="operations-photo">
            <Image
              src={a.operationsVenueReady}
              alt="Bright, fully prepared reception venue with ivory linens, wood chairs, and soft florals"
              fill
              sizes="(max-width: 640px) 100vw, min(1280px, 100vw)"
              className="operations-photo-img"
            />
          </figure>

          <div className="operations-pillars">
            {c.operations.phases.map((phase, index) => (
              <article key={phase.title} className="operations-pillar">
                <span className="operations-pillar-n" aria-hidden>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="operations-pillar-title">{phase.title}</h3>
                <p className="operations-pillar-body">{phase.body}</p>
              </article>
            ))}
          </div>

          <div className="operations-bridge" id="features">
            <h3 className="operations-bridge-headline">{c.operations.featuresBridge.headline}</h3>
            <p className="operations-bridge-body">{c.operations.featuresBridge.body}</p>
            <Link className="btn btn-primary" href={c.operations.featuresBridge.cta.href}>
              {c.operations.featuresBridge.cta.label}
            </Link>
          </div>
        </div>
      </section>

      {/* 5. ECOSYSTEM — three audience editorial portraits */}
      <section className="ecosystem" id="ecosystem" aria-labelledby="ecosystem-heading">
        <div className="ecosystem-inner">
          <header className="ecosystem-intro">
            <p className="ecosystem-eyebrow">{c.ecosystem.kicker}</p>
            <h2 className="ecosystem-headline" id="ecosystem-heading">
              {c.ecosystem.headline}
            </h2>
            <p className="ecosystem-lede">{c.ecosystem.lede}</p>
          </header>

          <ul className="ecosystem-profiles" aria-label="Connected audience experiences">
            {c.ecosystem.panels.map((panel) => (
              <li key={panel.role} className="ecosystem-profile">
                <figure className="ecosystem-photo">
                  <Image
                    src={a[panel.img]}
                    alt={panel.imgAlt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 900px) 42vw, 408px"
                    className={panel.position}
                  />
                </figure>
                <div className="ecosystem-copy">
                  <p className="ecosystem-role">{panel.role}</p>
                  <h3 className="ecosystem-profile-title">{panel.title}</h3>
                  <p className="ecosystem-profile-body">{panel.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <hr className="ecosystem-divider" aria-hidden />
          <p className="ecosystem-closing">{c.ecosystem.closing}</p>
        </div>
      </section>

      {/* 6. GETTING STARTED — editorial split: copy left, workspace photography right */}
      <section
        className="getting-started"
        id="getting-started"
        aria-labelledby="getting-started-heading"
      >
        <div className="getting-started-inner">
          <div className="getting-started-copy">
            <p className="getting-started-eyebrow">{c.gettingStarted.kicker}</p>
            <h2 className="getting-started-headline" id="getting-started-heading">
              {c.gettingStarted.headline}
            </h2>
            <p className="getting-started-subhead">{c.gettingStarted.subhead}</p>
            <p className="getting-started-lede">{c.gettingStarted.lede}</p>

            <ul className="getting-started-benefits" aria-label="Getting started benefits">
              {c.gettingStarted.benefits.map((benefit) => (
                <li key={benefit.title} className="getting-started-benefit">
                  <h3 className="getting-started-benefit-title">{benefit.title}</h3>
                  <p className="getting-started-benefit-body">{benefit.body}</p>
                </li>
              ))}
            </ul>

            <div className="getting-started-cta">
              <Link className="btn btn-primary" href={c.gettingStarted.cta.href}>
                {c.gettingStarted.cta.label}
              </Link>
            </div>
          </div>

          <figure className="getting-started-photo">
            <Image
              src={a.gettingStartedEditorial}
              alt="Sunlit workspace with laptop, florals, notebook, and a sage-tied binder on a light wood desk"
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 900px) 100vw, 600px"
              className="getting-started-photo-img"
            />
          </figure>
        </div>
      </section>

      {/* 8. OUR FIRST FRIENDS — editorial split: story left, keepsake photography right */}
      <section className="first-friends" id="our-story" aria-labelledby="first-friends-heading">
        <div className="first-friends-inner">
          <div className="first-friends-copy">
            <p className="first-friends-eyebrow">{c.founder.kicker}</p>
            <h2 className="first-friends-headline" id="first-friends-heading">
              {c.founder.headline}
            </h2>
            <div className="first-friends-body">
              <p>{c.founder.body}</p>
              <p>{c.founder.body2}</p>
              <p>{c.founder.body3}</p>
            </div>
            <p className="first-friends-closing">{c.founder.closing}</p>
            <Link className="first-friends-link" href={c.founder.cta.href}>
              {c.founder.cta.label}
              <span aria-hidden> →</span>
            </Link>
          </div>

          <figure className="first-friends-photo">
            <figcaption className="first-friends-caption">Our First Friends</figcaption>
            <div className="first-friends-photo-frame">
              <Image
                src={a.ourFirstFriendsEditorial}
                alt="Sunlit flat lay of venue photographs, handwritten thank-you notes, a sage notebook, and soft florals"
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 900px) 100vw, 690px"
                className="first-friends-photo-img"
              />
            </div>
          </figure>
        </div>
      </section>

      {/* 9. INVITATION — centered final CTA */}
      <section className="invitation" id="get-started" aria-labelledby="invitation-heading">
        <div className="invitation-inner">
          <p className="invitation-eyebrow">{c.close.kicker}</p>
          <h2 className="invitation-headline" id="invitation-heading">
            {c.close.headline}
          </h2>
          <div className="invitation-body">
            <p>{c.close.lede}</p>
            <p>{c.close.body}</p>
          </div>
          <div className="invitation-cta">
            <Link className="btn btn-primary" href={c.close.primaryCta.href}>
              {c.close.primaryCta.label}
            </Link>
          </div>
          <p className="invitation-note">{c.close.note}</p>
        </div>
      </section>
    </div>
  );
}
