import Image from "next/image";

import { MarketingCta } from "@/components/marketing/marketing-cta";
import { OUR_STORY, OUR_STORY_ASSETS } from "@/lib/marketing/our-story";

import "@/app/our-story.css";

/**
 * Our Story — founder narrative editorial.
 * Scoped styles in our-story.css; does not alter Homepage or Product.
 */
export function OurStoryExperience() {
  const page = OUR_STORY;
  const assets = OUR_STORY_ASSETS;

  return (
    <div className="htc-story">
      {/* ── Opening ── */}
      <section className="os-opening" aria-labelledby="our-story-opening">
        <div className="os-wrap-wide os-opening-grid">
          <div className="os-opening-copy">
            <p className="os-kicker">{page.opening.eyebrow}</p>
            <h1 id="our-story-opening" className="os-title">
              {page.opening.headline}
            </h1>
            <div className="os-opening-lines">
              {page.opening.lines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          <figure className="os-frame os-opening-visual">
            <Image
              src={assets.opening}
              alt="Three venue professionals laughing together while arranging a reception table with florals and candles — an illustrative editorial photograph"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 56vw"
              className="object-cover object-[center_35%]"
            />
          </figure>
        </div>
      </section>

      {/* ── Chapter 1 — Listening ── */}
      <section
        id="listening"
        className="os-chapter os-chapter-white"
        aria-labelledby="story-listening"
      >
        <div className="os-wrap">
          <div className="os-split">
            <figure className="os-frame os-listening-visual">
              <Image
                src={assets.listening}
                alt="Two women sharing a joyful moment at a laptop during a collaborative venue conversation — an illustrative editorial photograph, not an actual customer portrait"
                fill
                sizes="(max-width: 900px) 100vw, 44vw"
                className="object-cover object-center"
              />
            </figure>
            <div>
              <header className="os-chapter-head">
                <p className="os-kicker">{page.listening.eyebrow}</p>
                <h2 id="story-listening" className="os-title">
                  {page.listening.headline}
                </h2>
              </header>
              <div className="os-prose">
                {page.listening.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <blockquote className="os-pull">
                <p>“{page.listening.pullQuote}”</p>
              </blockquote>
              <div className="os-prose">
                {page.listening.afterQuote.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Chapter 2 — Our first friends ── */}
      <section
        id="our-first-friends"
        className="os-chapter os-chapter-linen scroll-mt-28"
        aria-labelledby="story-first-friends"
      >
        <div className="os-wrap">
          <div className="os-split os-split-reverse">
            <div>
              <header className="os-chapter-head">
                <p className="os-kicker">{page.firstFriends.eyebrow}</p>
                <h2 id="story-first-friends" className="os-title">
                  {page.firstFriends.headline}
                </h2>
              </header>
              <div className="os-prose">
                {page.firstFriends.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
            <figure className="os-frame os-friends-visual">
              <Image
                src={assets.firstFriends}
                alt="Intimate keepsakes on a sunlit wooden table — handwritten notes, an open journal, a gold pen, coffee, and a candle — illustrative editorial memories"
                fill
                sizes="(max-width: 900px) 100vw, 44vw"
                className="object-cover object-center"
              />
            </figure>
          </div>
        </div>
      </section>

      {/* ── Chapter 3 — Encouragement ── */}
      <section
        id="encouragement"
        className="os-chapter os-chapter-ivory"
        aria-labelledby="story-encouragement"
      >
        <div className="os-wrap">
          <div className="os-split">
            <div>
              <header className="os-chapter-head">
                <p className="os-kicker">{page.encouragement.eyebrow}</p>
                <h2 id="story-encouragement" className="os-title">
                  {page.encouragement.headline}
                </h2>
              </header>
              <div className="os-prose">
                {page.encouragement.beforeMoment.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <p className="os-italic">{page.encouragement.italicThought}</p>
                {page.encouragement.afterThought.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <p className="os-ron-quote">“{page.encouragement.ronQuote}”</p>
                {page.encouragement.afterRon.map((paragraph) => (
                  <p key={paragraph} className="os-laugh-line">
                    {paragraph}
                  </p>
                ))}
              </div>
              <div className="os-until">
                <p>{page.encouragement.untilMoment}</p>
              </div>
              <div className="os-prose">
                {page.encouragement.afterUntil.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <p className="os-italic">{page.encouragement.italicVision}</p>
                {page.encouragement.afterVisionLead.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <p>
                  {page.encouragement.tryPhraseBefore}
                  <em className="os-italic">{page.encouragement.tryPhraseItalic}</em>
                  {page.encouragement.tryPhraseAfter}
                </p>
                <p>{page.encouragement.closing}</p>
              </div>
            </div>
            <figure className="os-frame os-encourage-visual">
              <Image
                src={assets.encouragement}
                alt="A notebook titled Next Chapter on a sunlit desk with a coffee mug and laptop — checklist for Venue, Clients, Vendors, Automation, and Experience"
                fill
                sizes="(max-width: 900px) 100vw, 44vw"
                className="object-cover object-center"
              />
            </figure>
          </div>
        </div>
      </section>

      {/* ── Chapter 4 — Turning point (botanical → light) ── */}
      <section
        id="turning-point"
        className="os-turning"
        aria-labelledby="story-turning-point"
      >
        <div className="os-turning-botanical">
          <div className="os-wrap-wide">
            <figure className="os-frame os-turning-visual">
              <Image
                src={assets.turningPoint}
                alt="Sunlit garden courtyard viewed through an architectural doorway — a hopeful, forward-looking hospitality landscape"
                fill
                sizes="100vw"
                className="object-cover object-center"
              />
            </figure>
            <header className="os-chapter-head">
              <p className="os-kicker">{page.turningPoint.eyebrow}</p>
              <h2 id="story-turning-point" className="os-title">
                {page.turningPoint.headline}
              </h2>
            </header>
            <div className="os-prose os-prose-on-dark">
              {page.turningPoint.lead.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            <div className="os-questions" role="list">
              {page.turningPoint.questions.map((question) => (
                <p key={question} className="os-question" role="listitem">
                  {question}
                </p>
              ))}
            </div>
          </div>
        </div>
        <div className="os-turning-light">
          <div className="os-wrap os-turning-light-grid">
            <div>
              <h3 className="os-turning-conclusion-title">
                {page.turningPoint.conclusionHeadline}
              </h3>
              <div className="os-prose">
                {page.turningPoint.afterQuestions.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
            <figure className="os-frame os-behind-scenes-visual">
              <Image
                src={assets.behindTheScenes}
                alt="A venue professional in a sage apron carefully placing a name card on a linen napkin at a candlelit reception table — illustrative editorial photograph"
                fill
                sizes="(max-width: 900px) 100vw, 40vw"
                className="object-cover object-[center_20%]"
              />
            </figure>
          </div>
        </div>
      </section>

      {/* ── Chapter 5 — Jennifer ── */}
      <section
        id="jennifer"
        className="os-chapter os-chapter-white"
        aria-labelledby="story-jennifer"
      >
        <div className="os-wrap">
          <div className="os-jennifer-grid">
            <figure className="os-frame os-frame-portrait os-jennifer-portrait">
              <Image
                src={assets.jenniferPortrait}
                alt="Jennifer Cormier, founder of Hello to Cheers, seated in a sage-green sweater with soft ivory surroundings and eucalyptus"
                fill
                sizes="(max-width: 900px) 90vw, 420px"
                className="object-cover"
                priority
              />
            </figure>
            <div>
              <header className="os-chapter-head">
                <p className="os-kicker">{page.jennifer.eyebrow}</p>
                <h2 id="story-jennifer" className="os-title">
                  {page.jennifer.headline}
                </h2>
              </header>
              <div className="os-prose">
                {page.jennifer.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="os-signature">
                <p className="os-signature-name">{page.jennifer.signatureName}</p>
                <p className="os-signature-title">{page.jennifer.signatureTitle}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Chapter 6 — Invitation ── */}
      <section
        id="welcome"
        className="os-invite"
        aria-labelledby="story-invitation"
      >
        <div className="os-wrap">
          <figure className="os-frame os-invite-visual">
            <Image
              src={assets.invitation}
              alt="Golden-hour garden reception table with white florals, candles, and string lights — a warm invitation to what lies ahead"
              fill
              sizes="(max-width: 900px) 100vw, 920px"
              className="object-cover object-center"
            />
          </figure>
          <header className="os-chapter-head">
            <p className="os-kicker">{page.invitation.eyebrow}</p>
            <h2 id="story-invitation" className="os-title">
              {page.invitation.headline}
            </h2>
          </header>
          <div className="os-prose">
            {page.invitation.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <div className="os-cta-row">
            <MarketingCta
              href={page.invitation.primaryCta.href}
              label={page.invitation.primaryCta.label}
              variant="primary"
            />
            <MarketingCta
              href={page.invitation.secondaryCta.href}
              label={page.invitation.secondaryCta.label}
              variant="secondary"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
