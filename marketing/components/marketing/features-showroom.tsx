"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import {
  FEATURES_SHOWROOM,
  getShowroomCollection,
  type ShowroomCollection,
  type ShowroomFeaturedCapability,
} from "@/lib/marketing/features-showroom";

export type ShowroomConcept = "linen" | "botanical";

type FeaturesShowroomProps = {
  concept: ShowroomConcept;
  /** Initial collection id from URL (?collection=) */
  initialCollectionId?: string;
};

function defaultFeaturedId(collection: ShowroomCollection): string | null {
  const matchingDefault = collection.featured.find(
    (item) => item.imageSrc && item.imageSrc === collection.imageSrc,
  );
  if (matchingDefault) return matchingDefault.id;
  const firstVisual = collection.featured.find((item) => item.imageSrc);
  return firstVisual?.id ?? null;
}

function resolveActiveVisual(
  collection: ShowroomCollection,
  featured: ShowroomFeaturedCapability | null,
) {
  if (featured?.imageSrc) {
    return {
      src: featured.imageSrc,
      alt: featured.imageAlt ?? collection.imageAlt,
      caption: featured.label,
      detail: featured.detail,
      fit: featured.imageFit ?? "cover",
      mode: "featured" as const,
    };
  }
  return {
    src: collection.imageSrc,
    alt: collection.imageAlt,
    caption: collection.category,
    detail: null as string | null,
    fit: "cover" as const,
    mode: "collection" as const,
  };
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Interactive Features Showroom — shared behavior for Concept A (linen) and B (botanical).
 * Phase 2B polish: customer-facing copy, synced featured/screenshot state, calm collection switching.
 */
export function FeaturesShowroom({ concept, initialCollectionId }: FeaturesShowroomProps) {
  const baseId = useId();
  const collections = FEATURES_SHOWROOM.collections;
  const initial = getShowroomCollection(initialCollectionId);
  const stageRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);

  const [activeId, setActiveId] = useState(initial.id);
  const [featuredId, setFeaturedId] = useState<string | null>(() =>
    defaultFeaturedId(initial),
  );
  const [inventoryOpen, setInventoryOpen] = useState(false);

  const collection = useMemo(
    () => getShowroomCollection(activeId),
    [activeId],
  );

  const activeIndex = collections.findIndex((c) => c.id === collection.id);

  const featured =
    collection.featured.find((f) => f.id === featuredId) ??
    collection.featured.find((f) => f.id === defaultFeaturedId(collection)) ??
    null;

  const visual = resolveActiveVisual(collection, featured);

  const ensureStageReadable = useCallback((opts?: { force?: boolean }) => {
    const stage = stageRef.current;
    if (!stage || typeof window === "undefined") return;

    const rect = stage.getBoundingClientRect();
    const headerOffset = 96;
    const fullyAbove = rect.bottom < headerOffset + 40;
    const mostlyBelow = rect.top > window.innerHeight * 0.72;
    const needsHelp = opts?.force || fullyAbove || mostlyBelow;
    if (!needsHelp) return;

    stage.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "nearest",
    });
  }, []);

  const selectCollection = useCallback(
    (id: string, opts?: { fromMobile?: boolean }) => {
      const next = getShowroomCollection(id);
      const wasExpanded = inventoryOpen;
      setActiveId(next.id);
      setFeaturedId(defaultFeaturedId(next));
      setInventoryOpen(false);

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("collection", next.id);
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
      }

      // Only nudge scroll when the visitor may be stranded (mobile change or after a tall inventory).
      requestAnimationFrame(() => {
        ensureStageReadable({ force: Boolean(opts?.fromMobile || wasExpanded) });
      });
    },
    [ensureStageReadable, inventoryOpen],
  );

  useEffect(() => {
    function onExternalSelect(event: Event) {
      const detail = (event as CustomEvent<{ collectionId?: string }>).detail;
      const id = detail?.collectionId;
      if (!id) return;
      selectCollection(id);
    }
    window.addEventListener("htc:features-showroom-select", onExternalSelect);
    return () => {
      window.removeEventListener("htc:features-showroom-select", onExternalSelect);
    };
  }, [selectCollection]);

  const selectFeatured = useCallback(
    (id: string) => {
      const item = collection.featured.find((f) => f.id === id);
      // Only activate SHOWING/visual swap when a real screenshot exists for this capability.
      if (!item?.imageSrc) return;
      setFeaturedId(id);
      requestAnimationFrame(() => {
        ensureStageReadable({ force: true });
      });
    },
    [collection.featured, ensureStageReadable],
  );

  function onNavKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = collections.length - 1;
    let next = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      next = index === last ? 0 : index + 1;
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      next = index === 0 ? last : index - 1;
    } else if (event.key === "Home") {
      event.preventDefault();
      next = 0;
    } else if (event.key === "End") {
      event.preventDefault();
      next = last;
    } else {
      return;
    }
    selectCollection(collections[next].id);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  }

  const rootClass =
    concept === "linen" ? "htc-showroom htc-showroom-linen" : "htc-showroom htc-showroom-botanical";

  return (
    <div className={rootClass}>
      <div className="fs-shell">
        {concept === "linen" ? (
          <header className="fs-intro" id="features-showroom">
            <div className="fs-intro-rule" aria-hidden />
            <p className="fs-intro-kicker">Platform showroom</p>
            <h2 className="fs-intro-title">Explore what Hello to Cheers can do</h2>
            <p className="fs-intro-lede">
              Browse seven collections of capabilities, each with a clear look at how the platform
              supports your venue.
            </p>
          </header>
        ) : null}

        {/* Mobile collection selector */}
        <div className="fs-mobile-nav">
          <label htmlFor={`${baseId}-select`} className="fs-mobile-label">
            Choose a collection
          </label>
          <select
            id={`${baseId}-select`}
            className="fs-mobile-select"
            value={collection.id}
            onChange={(event) =>
              selectCollection(event.target.value, { fromMobile: true })
            }
          >
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.category} — {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="fs-layout" ref={layoutRef}>
          {/* Desktop vertical nav */}
          <nav className="fs-nav" aria-label="Feature collections">
            <p className="fs-nav-kicker">Collections</p>
            <div
              className="fs-nav-list"
              role="tablist"
              aria-orientation="vertical"
              aria-label="Platform capability collections"
            >
              {collections.map((c, index) => {
                const selected = c.id === collection.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    id={`${baseId}-tab-${index}`}
                    aria-selected={selected}
                    aria-controls={`${baseId}-panel`}
                    tabIndex={selected ? 0 : -1}
                    className={selected ? "fs-nav-item is-active" : "fs-nav-item"}
                    onClick={() => selectCollection(c.id)}
                    onKeyDown={(event) => onNavKeyDown(event, index)}
                  >
                    <span className="fs-nav-index" aria-hidden>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="fs-nav-copy">
                      <span className="fs-nav-category">{c.category}</span>
                      <span className="fs-nav-title">{c.title}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Display */}
          <div
            className="fs-stage"
            ref={stageRef}
            role="tabpanel"
            id={`${baseId}-panel`}
            aria-labelledby={`${baseId}-tab-${activeIndex}`}
          >
            <header className="fs-header">
              <p className="fs-eyebrow">{collection.category}</p>
              <h2 className="fs-headline">
                {collection.headline ?? collection.title}
              </h2>
              <p className="fs-explanation">{collection.explanation}</p>
            </header>

            <div
              className={
                collection.featuredPresentation === "visual"
                  ? "fs-exhibit is-visual-gallery"
                  : "fs-exhibit"
              }
            >
              <figure className="fs-frame">
                <div className="fs-chrome" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <div className="fs-chrome-url">
                    app.sandbox.hellotocheers.com · {visual.caption}
                  </div>
                </div>
                <div
                  className={
                    visual.fit === "device"
                      ? "fs-shot is-device"
                      : visual.fit === "contain"
                        ? "fs-shot is-contain"
                        : "fs-shot is-cover"
                  }
                >
                  <Image
                    key={visual.src}
                    src={visual.src}
                    alt={visual.alt}
                    width={1280}
                    height={800}
                    className="fs-shot-img"
                    sizes="(max-width: 900px) 100vw, min(920px, 68vw)"
                    priority={activeIndex === 0}
                  />
                </div>
                <figcaption className="fs-caption">
                  {visual.mode === "featured" ? (
                    <>
                      <span className="fs-caption-label">Showing</span>
                      <span className="fs-caption-value">{visual.caption}</span>
                      {visual.detail ? (
                        <span className="fs-caption-detail">{visual.detail}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="fs-caption-value">{visual.caption}</span>
                  )}
                </figcaption>
              </figure>

              {collection.featuredPresentation === "visual" ? (
                <div className="fs-rail" role="group" aria-label="Featured screenshots">
                  <p className="fs-rail-label">Explore the journey</p>
                  <ul className="fs-rail-list">
                    {collection.featured
                      .filter((item) => item.imageSrc)
                      .map((item) => {
                        const isOn = featured?.id === item.id;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              className={
                                isOn ? "fs-rail-item is-active" : "fs-rail-item"
                              }
                              aria-pressed={isOn}
                              onClick={() => selectFeatured(item.id)}
                            >
                              <span className="fs-rail-thumb">
                                <Image
                                  src={item.imageSrc!}
                                  alt=""
                                  width={320}
                                  height={200}
                                  className={
                                    item.imageFit === "contain" || item.imageFit === "device"
                                      ? "fs-rail-thumb-img is-contain"
                                      : "fs-rail-thumb-img"
                                  }
                                  sizes="160px"
                                />
                              </span>
                              <span className="fs-rail-copy">
                                <span className="fs-rail-name">{item.label}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ) : null}
            </div>

            {collection.featuredPresentation === "visual" ? null : (
              <div className="fs-featured">
                <p className="fs-featured-label">Featured capabilities</p>
                <p className="fs-featured-hint">Select a feature to explore it more closely.</p>
                <ul className="fs-featured-list">
                  {collection.featured.map((item, index) => {
                    const isOn = featured?.id === item.id;
                    const hasVisual = Boolean(item.imageSrc);
                    const marker = (
                      <span className="fs-featured-marker" aria-hidden>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    );
                    const copy = (
                      <span className="fs-featured-copy">
                        <span className="fs-featured-name">{item.label}</span>
                        <span className="fs-featured-detail">{item.detail}</span>
                      </span>
                    );

                    if (!hasVisual) {
                      return (
                        <li key={item.id}>
                          <div className="fs-featured-item is-static">
                            {marker}
                            {copy}
                          </div>
                        </li>
                      );
                    }

                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={
                            isOn ? "fs-featured-item is-active" : "fs-featured-item has-visual"
                          }
                          aria-pressed={isOn}
                          onClick={() => selectFeatured(item.id)}
                        >
                          {marker}
                          {copy}
                          <span className="fs-featured-lens" aria-hidden>
                            {isOn && visual.mode === "featured" ? "Showing" : "View"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <p className="fs-benefit">{collection.benefit}</p>

            {collection.emailShowcase ? (
              <section
                className="fs-email-showcase"
                aria-labelledby={`${baseId}-email-showcase-heading`}
              >
                <header className="fs-email-showcase-intro">
                  <h3
                    id={`${baseId}-email-showcase-heading`}
                    className="fs-email-showcase-headline"
                  >
                    {collection.emailShowcase.headline}
                  </h3>
                  <p className="fs-email-showcase-lede">
                    {collection.emailShowcase.introduction}
                  </p>
                </header>
                <div className="fs-email-showcase-grid">
                  {collection.emailShowcase.examples.map((example, index) => (
                    <figure key={example.id} className="fs-email-example">
                      <p className="fs-email-example-kicker">
                        Example {String.fromCharCode(65 + index)} — {example.title}
                      </p>
                      <div className="fs-email-example-frame">
                        <Image
                          src={example.imageSrc}
                          alt={example.imageAlt}
                          width={900}
                          height={720}
                          className="fs-email-example-img"
                          sizes="(max-width: 900px) 100vw, min(440px, 42vw)"
                        />
                      </div>
                      <figcaption className="fs-email-example-caption">
                        {example.caption}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            ) : null}

            {collection.spotlight ? (
              <aside
                className="fs-collection-spotlight"
                aria-labelledby={`${baseId}-spotlight-heading`}
              >
                <div className="fs-collection-spotlight-copy">
                  <p className="fs-collection-spotlight-eyebrow">
                    {collection.spotlight.eyebrow}
                  </p>
                  <h3
                    id={`${baseId}-spotlight-heading`}
                    className="fs-collection-spotlight-headline"
                  >
                    {collection.spotlight.headline}
                  </h3>
                  <div className="fs-collection-spotlight-body">
                    {collection.spotlight.body
                      .split(/\n\n+/)
                      .map((paragraph) => paragraph.trim())
                      .filter(Boolean)
                      .map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                  </div>
                </div>
                <figure className="fs-collection-spotlight-figure">
                  <div className="fs-collection-spotlight-frame">
                    <Image
                      src={collection.spotlight.imageSrc}
                      alt={collection.spotlight.imageAlt}
                      width={1280}
                      height={900}
                      className="fs-collection-spotlight-img"
                      sizes="(max-width: 900px) 100vw, min(560px, 42vw)"
                    />
                  </div>
                </figure>
              </aside>
            ) : null}

            <div className="fs-inventory">
              <button
                type="button"
                className="fs-inventory-toggle"
                aria-expanded={inventoryOpen}
                aria-controls={`${baseId}-inventory`}
                onClick={() => setInventoryOpen((open) => !open)}
              >
                {inventoryOpen
                  ? "Hide the full collection ↑"
                  : "Explore the full collection ↓"}
              </button>
              <div
                id={`${baseId}-inventory`}
                className={inventoryOpen ? "fs-inventory-panel is-open" : "fs-inventory-panel"}
                hidden={!inventoryOpen}
              >
                <p className="fs-inventory-lede">Explore everything included.</p>
                <div className="fs-inventory-grid">
                  {collection.inventory.map((group) => (
                    <div key={group.heading} className="fs-inventory-group">
                      <h3 className="fs-inventory-heading">{group.heading}</h3>
                      <ul className="fs-inventory-items">
                        {group.items.map((entry) => (
                          <li key={entry}>{entry}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
