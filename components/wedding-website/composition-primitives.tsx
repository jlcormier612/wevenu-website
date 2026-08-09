"use client";

/**
 * Wedding Website Visual Expression Pass (2026-08-03).
 *
 * Shared composition primitives consumed only by
 * components/wedding-website/wedding-website.tsx — this is not a second
 * renderer, it is the same architectural layer as that file's own
 * SectionHeader/SectionDivider/GalleryGrid helpers, split out here because
 * of the added surface area. WeddingWebsite remains the single exported
 * renderer both Studio Live Preview and the public /w/[slug] route use.
 *
 * Architecture: Collection -> declarative composition recipe (the fields
 * below, all stored in collections.layout_config) -> these shared
 * primitives -> section renderer. `sectionComposition` selects which
 * primitive family a section is built from; the other recipe fields
 * parametrize that primitive, so two Collections sharing a family
 * (e.g. Coastal and Midnight both "editorial") still render recognizably
 * differently — see docs/wedding-website-visual-expression-completion-
 * report.md for the full per-Collection table this implements.
 *
 * Every color used here comes from the caller's `color`/`tc.*` tokens
 * (Color Story). Nothing in this file introduces a hardcoded color —
 * Collection controls composition only, never color, per the locked
 * product model.
 */
import * as React from "react";

// Coastal Premium Art-Direction Proof Pass (2026-08-03) — whole-page canvas/
// scale choreography. Closed vocabulary; a Collection assigns each section a
// canvas moment (what color field it sits on) and a visual weight (how much
// room it commands), so the page reads as a composed rhythm instead of one
// flat background repeated behind every section. Optional: a Collection
// without sectionRoles (every Collection but Coastal, for this pass) is
// completely unaffected — see SectionCanvas below.
/** `paper` = independent light editorial chamber under any Color Story (incl. dark). */
export type CanvasRole = "light" | "soft" | "strong" | "photographic" | "neutral" | "paper";
export type SectionScale = "feature" | "standard" | "interlude";
// Coastal Art-Direction Pass 2 (2026-08-03) — `pairWith` names the one other
// section key this section may compose into a shared passage with, only
// when both sides name each other AND are currently adjacent (see
// wedding-website.tsx's renderGroups). `treatment` is documentation-only
// here (the actual dispatch lives in wedding-website.tsx's per-case
// `tc.sectionRoles ? <NewPrimitive/> : <old/>` branches) — kept on the type
// so the DB recipe and the TS shape stay in sync.
export type SectionRole = { canvas: CanvasRole; scale: SectionScale; treatment?: string; pairWith?: string };

/** Ink/surface for canvas `"paper"` — never derived from dark Color Story tokens. */
export const PAPER_CHAMBER = {
  bg: "#F6F3EC",
  surface: "#FFFEFA",
  text: "#1C1824",
  textMuted: "#5C5668",
  border: "#DDD6C8",
} as const;

export type CompositionRecipe = {
  sectionComposition?: "editorial" | "flowing" | "framed" | "quiet";
  sectionRoles?: Partial<Record<string, SectionRole>>;
  contentWidth?: "narrow" | "standard" | "wide";
  itemAlign?: "center" | "left" | "alternating";
  alternate?: "none" | "background" | "position";
  featuredItem?: "none" | "first";
  sectionFrame?: "none" | "rule-top" | "rule-both" | "card";
  sectionBand?: "none" | "alternate" | "tinted";
  itemSeparator?: "divider" | "rule" | "gap" | "index";
  density?: "compact" | "cozy" | "spacious" | "airy";
  asymmetry?: "none" | "subtle" | "editorial";
  edgeTreatment?: "contained" | "wide" | "full-bleed" | "alternating";
  portraitShape?: "circle" | "square";
};

/** The minimal color/typography surface every primitive needs — a subset of
 * ThemeConfig, kept narrow so this file has no import cycle with the main
 * renderer. */
export type CompositionTheme = CompositionRecipe & {
  bg: string; surface: string; text: string; textMuted: string; border: string;
  headingFont: string; bodyFont: string; headingItalic: boolean;
  divider: "botanical" | "rule" | "dots" | "ornament" | "none" | "deco";
  cardRadius: string;
};

export type CompositionItem = {
  label?: React.ReactNode;
  heading: React.ReactNode;
  body?: React.ReactNode;
  meta?: React.ReactNode;
  href?: string;
};

const CONTENT_WIDTH: Record<NonNullable<CompositionRecipe["contentWidth"]>, string> = {
  narrow: "30rem", standard: "42rem", wide: "56rem",
};

const DENSITY_GAP: Record<NonNullable<CompositionRecipe["density"]>, string> = {
  compact: "1rem", cozy: "1.75rem", spacious: "2.5rem", airy: "3.5rem",
};

const ASYMMETRY_OFFSET: Record<NonNullable<CompositionRecipe["asymmetry"]>, string> = {
  none: "0", subtle: "1.25rem", editorial: "3rem",
};

function widthFor(recipe: CompositionRecipe): string {
  return CONTENT_WIDTH[recipe.contentWidth ?? "standard"];
}
function gapFor(recipe: CompositionRecipe): string {
  return DENSITY_GAP[recipe.density ?? "cozy"];
}

// Re-implemented locally (not imported from wedding-website.tsx, to avoid a
// circular import) — identical divider vocabulary/markup, driven by the
// Collection's own existing `divider` token. This does not add any new
// decorative element; it is the same divider system already in the product.
function ItemDivider({ style, color }: { style: CompositionTheme["divider"]; color: string }) {
  if (style === "none") return null;
  if (style === "rule") return <div className="h-px w-full" style={{ background: `${color}30` }} />;
  if (style === "dots") return (
    <div className="flex items-center justify-center gap-2">
      {[0, 1, 2].map(i => <div key={i} className="rounded-full" style={{ width: "3px", height: "3px", background: `${color}40` }} />)}
    </div>
  );
  if (style === "ornament") return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: `${color}25` }} />
      <span style={{ color: `${color}70`, fontSize: "12px" }}>♡</span>
      <div className="h-px flex-1" style={{ background: `${color}25` }} />
    </div>
  );
  if (style === "deco") return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: `${color}25` }} />
      <span className="text-[8px] tracking-[0.3em]" style={{ color: `${color}50` }}>✦</span>
      <div className="h-px flex-1" style={{ background: `${color}25` }} />
    </div>
  );
  return ( // botanical
    <div className="flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: `${color}18` }} />
      <span style={{ fontSize: "11px", color: `${color}55` }}>❧</span>
      <div className="h-px flex-1" style={{ background: `${color}18` }} />
    </div>
  );
}

function ItemSeparator({ recipe, tc, color }: { recipe: CompositionRecipe; tc: CompositionTheme; color: string }) {
  const sep = recipe.itemSeparator ?? "gap";
  if (sep === "divider") return <ItemDivider style={tc.divider} color={color} />;
  if (sep === "rule") return <div className="h-px w-full" style={{ background: `${color}20` }} />;
  return null; // "gap" and "index" render no separator line — spacing/index label does the work
}

// ---- Section-level wrapper: width, edge treatment, band, frame ----------

function sectionWrapperStyle(recipe: CompositionRecipe, tc: CompositionTheme, index = 0): React.CSSProperties {
  const style: React.CSSProperties = {};
  if (recipe.sectionBand === "tinted") {
    style.background = tc.surface;
    style.paddingTop = "3rem"; style.paddingBottom = "3rem";
  }
  return style;
}

function edgeWidthClass(edge: CompositionRecipe["edgeTreatment"], index: number): string {
  // WW-PREVIEW-01 — full-bleed/breakpoints resolve against the
  // `@container/wedding` established once in wedding-website.tsx, not the
  // outer browser viewport. See that file's root div for the full note.
  if (edge === "full-bleed") return "relative left-1/2 right-1/2 -mx-[50cqw] w-[100cqw] px-6 @min-[768px]/wedding:px-16";
  if (edge === "wide") return "-mx-4 @min-[768px]/wedding:-mx-8";
  if (edge === "alternating") return index % 2 === 0 ? "-mx-2 @min-[768px]/wedding:-mx-6" : "";
  return "";
}

// ---- Generic list composition — Event/Schedule/Travel/ThingsToDo/Music/Registry/FAQ ----

export function SectionComposition({
  recipe, tc, color, items,
}: {
  recipe: CompositionRecipe; tc: CompositionTheme; color: string; items: CompositionItem[];
}) {
  const family = recipe.sectionComposition ?? "framed";
  if (family === "editorial") return <EditorialList recipe={recipe} tc={tc} color={color} items={items} />;
  if (family === "flowing") return <FlowingList recipe={recipe} tc={tc} color={color} items={items} />;
  if (family === "quiet") return <QuietList recipe={recipe} tc={tc} color={color} items={items} />;
  return <FramedList recipe={recipe} tc={tc} color={color} items={items} />;
}

function ItemBody({ item, tc, color }: { item: CompositionItem; tc: CompositionTheme; color: string }) {
  const content = (
    <>
      {item.label && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1.5" style={{ color: `${color}75` }}>{item.label}</p>
      )}
      <p style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal", color: tc.text, fontSize: "1.05rem" }}>{item.heading}</p>
      {item.body && <p className="text-sm mt-1 leading-relaxed" style={{ color: tc.textMuted }}>{item.body}</p>}
      {item.meta && <p className="text-xs mt-1 opacity-55" style={{ color: tc.textMuted }}>{item.meta}</p>}
    </>
  );
  return item.href
    ? <a href={item.href} target="_blank" rel="noopener noreferrer" className="block hover:opacity-80 transition-opacity">{content}</a>
    : content;
}

function FramedList({ recipe, tc, color, items }: { recipe: CompositionRecipe; tc: CompositionTheme; color: string; items: CompositionItem[] }) {
  const featured = recipe.featuredItem === "first";
  const alternate = recipe.alternate === "background";
  const showCard = recipe.sectionFrame === "card";
  return (
    <div className="grid gap-4 @min-[640px]/wedding:grid-cols-2" style={{ gap: gapFor(recipe), maxWidth: widthFor(recipe), marginInline: recipe.itemAlign === "center" ? "auto" : undefined }}>
      {items.map((item, i) => (
        <div key={i}
          className={featured && i === 0 ? "@min-[640px]/wedding:col-span-2" : undefined}
          style={{
            padding: "1.5rem",
            textAlign: recipe.itemAlign === "left" ? "left" : "center",
            background: alternate && i % 2 === 1 ? tc.bg : (showCard ? tc.surface : "transparent"),
            border: showCard ? `1px solid ${color}22` : "none",
            borderRadius: showCard ? tc.cardRadius : 0,
          }}>
          <ItemBody item={item} tc={tc} color={color} />
        </div>
      ))}
    </div>
  );
}

function EditorialList({ recipe, tc, color, items }: { recipe: CompositionRecipe; tc: CompositionTheme; color: string; items: CompositionItem[] }) {
  const offset = ASYMMETRY_OFFSET[recipe.asymmetry ?? "none"];
  const useIndex = recipe.itemSeparator === "index";
  return (
    <div style={{ ...sectionWrapperStyle(recipe, tc), maxWidth: widthFor(recipe), marginInline: "auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: gapFor(recipe) }}>
        {items.map((item, i) => {
          const flip = recipe.itemAlign === "alternating" && i % 2 === 1;
          const shift = recipe.alternate === "position" ? (i % 2 === 0 ? offset : "0") : "0";
          return (
            <div key={i}>
              {i > 0 && <ItemSeparator recipe={recipe} tc={tc} color={color} />}
              <div className="pt-5 @min-[768px]/wedding:flex @min-[768px]/wedding:items-baseline @min-[768px]/wedding:gap-8"
                style={{ flexDirection: flip ? "row-reverse" : "row", marginLeft: !flip ? shift : undefined, marginRight: flip ? shift : undefined }}>
                <div className="shrink-0 @min-[768px]/wedding:w-32">
                  {useIndex ? (
                    <span className="text-xs font-mono opacity-40" style={{ color: tc.textMuted }}>{String(i + 1).padStart(2, "0")}</span>
                  ) : item.label ? (
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: `${color}80` }}>{item.label}</p>
                  ) : null}
                </div>
                <div className="flex-1" style={{ textAlign: recipe.itemAlign === "left" || recipe.itemAlign === "alternating" ? "left" : "center" }}>
                  <p style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal", color: tc.text, fontSize: "1.1rem" }}>
                    {item.href ? <a href={item.href} target="_blank" rel="noopener noreferrer" style={{ color: tc.text }}>{item.heading}</a> : item.heading}
                  </p>
                  {item.body && <p className="text-sm mt-1.5 leading-relaxed" style={{ color: tc.textMuted }}>{item.body}</p>}
                  {item.meta && <p className="text-xs mt-1 opacity-55" style={{ color: tc.textMuted }}>{item.meta}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlowingList({ recipe, tc, color, items }: { recipe: CompositionRecipe; tc: CompositionTheme; color: string; items: CompositionItem[] }) {
  const offset = ASYMMETRY_OFFSET[recipe.asymmetry ?? "none"];
  const bracket = recipe.sectionFrame === "rule-top" || recipe.sectionFrame === "rule-both";
  return (
    <div style={{ maxWidth: widthFor(recipe), marginInline: "auto" }}>
      {bracket && <div className="h-px w-16 mx-auto mb-8" style={{ background: `${color}35` }} />}
      <div style={{ display: "flex", flexDirection: "column", gap: gapFor(recipe) }}>
        {items.map((item, i) => {
          const shift = recipe.alternate === "position" ? (i % 2 === 0 ? offset : `-${offset}`) : "0";
          return (
            <div key={i} style={{ marginLeft: recipe.itemAlign !== "center" ? shift : undefined }}>
              {i > 0 && <ItemSeparator recipe={recipe} tc={tc} color={color} />}
              <div className="pt-5" style={{ textAlign: recipe.itemAlign === "left" ? "left" : "center" }}>
                <ItemBody item={item} tc={tc} color={color} />
              </div>
            </div>
          );
        })}
      </div>
      {recipe.sectionFrame === "rule-both" && <div className="h-px w-16 mx-auto mt-8" style={{ background: `${color}35` }} />}
    </div>
  );
}

function QuietList({ recipe, tc, color, items }: { recipe: CompositionRecipe; tc: CompositionTheme; color: string; items: CompositionItem[] }) {
  return (
    <div style={{ maxWidth: widthFor(recipe) }}>
      <div style={{ display: "flex", flexDirection: "column", gap: gapFor(recipe) }}>
        {items.map((item, i) => (
          <div key={i}>
            {i > 0 && <div className="h-px w-full mb-0" style={{ background: `${color}18` }} />}
            <div className="pt-5 flex gap-4 items-baseline">
              <span className="text-[10px] font-mono opacity-35 shrink-0" style={{ color: tc.textMuted }}>{String(i + 1).padStart(2, "0")}</span>
              <div className="flex-1 text-left">
                <p style={{ fontFamily: tc.bodyFont, color: tc.text, fontSize: "0.95rem", fontWeight: 500 }}>
                  {item.href ? <a href={item.href} target="_blank" rel="noopener noreferrer" style={{ color: tc.text }}>{item.heading}</a> : item.heading}
                </p>
                {item.body && <p className="text-sm mt-1 leading-relaxed" style={{ color: tc.textMuted }}>{item.body}</p>}
                {item.meta && <p className="text-xs mt-1 opacity-50" style={{ color: tc.textMuted }}>{item.meta}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Single-block composition — Dress Code ------------------------------

export function ContentBlock({
  recipe, tc, color, children,
}: {
  recipe: CompositionRecipe; tc: CompositionTheme; color: string; children: React.ReactNode;
}) {
  const family = recipe.sectionComposition ?? "framed";
  const align: "center" | "left" = family === "editorial" || family === "quiet" ? (recipe.itemAlign === "center" ? "center" : "left") : "center";
  const framed = family === "framed" && recipe.sectionFrame === "card";
  return (
    <div
      className={align === "center" ? "mx-auto text-center" : "text-left"}
      style={{
        maxWidth: widthFor(recipe),
        marginInline: align === "center" ? "auto" : (family === "quiet" ? 0 : undefined),
        padding: framed ? "2rem" : 0,
        background: framed ? tc.surface : "transparent",
        border: framed ? `1px solid ${color}22` : "none",
        borderRadius: framed ? tc.cardRadius : 0,
      }}
    >
      {children}
    </div>
  );
}

// ---- Wedding Party --------------------------------------------------------
// Deliberately does not consult Photo Style — portrait shape/arrangement is
// a Collection composition decision, never a photographic-treatment one.

export type PartyMember = { name: string; role: string; note?: string; photoUrl?: string };

export function WeddingPartyComposition({
  recipe, tc, color, members,
}: {
  recipe: CompositionRecipe; tc: CompositionTheme; color: string; members: PartyMember[];
}) {
  const shape = recipe.portraitShape ?? "circle";
  const alternate = recipe.alternate === "position";
  const offset = ASYMMETRY_OFFSET[recipe.asymmetry ?? "none"];
  const cols = members.length <= 2 ? "grid-cols-2" : "grid-cols-2 @min-[640px]/wedding:grid-cols-3";

  return (
    <div className={`grid ${cols}`} style={{ gap: gapFor(recipe), maxWidth: widthFor(recipe), marginInline: "auto" }}>
      {members.map((m, i) => {
        const shift = alternate ? (i % 2 === 0 ? offset : "0") : "0";
        const size = shape === "square" ? "84px" : "80px";
        return (
          <div key={i} className="text-center space-y-2" style={{ marginTop: shift !== "0" ? shift : undefined }}>
            {m.photoUrl ? (
              <div className="overflow-hidden mx-auto" style={{
                width: size, height: size,
                borderRadius: shape === "circle" ? "50%" : tc.cardRadius,
                border: `2px solid ${color}30`,
              }}>
                <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="mx-auto flex items-center justify-center" style={{
                width: size, height: size,
                borderRadius: shape === "circle" ? "50%" : tc.cardRadius,
                background: `${color}15`, border: `2px solid ${color}25`, color, fontSize: "1.4rem",
              }}>
                {m.name.charAt(0)}
              </div>
            )}
            <div>
              <p className="font-medium text-sm" style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal", color: tc.text }}>{m.name}</p>
              <p className="text-[11px] opacity-55" style={{ color: tc.textMuted }}>{m.role}</p>
              {m.note && <p className="text-[11px] opacity-40 mt-0.5 leading-tight" style={{ color: tc.textMuted }}>{m.note}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Canvas / scale choreography ------------------------------------------
// Coastal Premium Art-Direction Proof Pass (2026-08-03).

const SCALE_MARGIN: Record<SectionScale, string> = {
  feature: "7rem", standard: "4.5rem", interlude: "2rem",
};

/** Relative-luminance contrast pick — readable text on an arbitrary Color
 * Story hex, since Color Story must work with any palette, never a
 * hardcoded one. */
export function contrastText(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1a1a1a" : "#ffffff";
}

/**
 * Shared focal-position strategy for the couple's own hero/engagement
 * photograph (Visual Acceptance Corrections, 2026-08-08).
 *
 * A flat `background-position: 50% 50%` crops evenly off the top and
 * bottom of a photo whenever its container is wider (relative to its
 * height) than the source image — which every full-bleed Hero, Collection
 * card, and Photo Style card here is. Engagement/portrait photography
 * routinely puts the subjects' heads close to the top of the frame, not
 * dead center, so an even top/bottom crop slices into hair and heads
 * first — confirmed against the fixture photo, whose heads start only a
 * few percent down from the top edge.
 *
 * This biases the vertical anchor toward the top of the source instead,
 * so any cropping a container forces comes off the bottom (dress,
 * bouquet, background) rather than the couple's heads. One constant,
 * reused everywhere a context wants to show "the couple" recognizably —
 * the real Hero (wedding-website.tsx) and the Collection/Photo Style
 * mini-previews (collection-preview.tsx) — never a per-card tweak.
 *
 * There is no per-photo focal-point field in the data model yet; this is
 * the smallest mechanism that gets every preview context to a sensible,
 * shared default without inventing that larger feature.
 */
export const PORTRAIT_FACE_FOCAL = "50% 8%";

/**
 * Wraps one section in its assigned canvas moment + visual weight.
 *
 * `role` is undefined for every Collection except Coastal in this pass —
 * in that case this renders children completely unchanged (no wrapper, no
 * margin change), so every other Collection's page is byte-for-byte the
 * same as before. "strong"/"soft" get a real full-bleed color field behind
 * the section; "light"/"neutral"/"photographic" only ever contribute the
 * scale-driven vertical rhythm, never a color change — restraint is the
 * point, not every section is a showcase.
 *
 * Whole-Page Visual Rhythm Pass (2026-08-05) — margin is applied as
 * marginTop only, never marginBlock. The page renders these as `flex
 * flex-col` siblings (wedding-website.tsx), and flex children never
 * collapse adjacent margins the way normal block flow does — a feature
 * section's own 7rem bottom margin was stacking with the next section's
 * own top margin, producing a doubled, un-anchored gap between every pair
 * of sections (confirmed empirically: ~224px between Event and Gallery,
 * ~184px between Gallery and Schedule, both landing in the middle of a
 * flat, same-color field with nothing to visually explain the gap). A
 * single top margin, sized off the section that's about to begin, is the
 * same rhythm intent without the accidental doubling.
 *
 * "neutral" canvas is a soft card surface built from the couple's actual
 * Neutral role (`colors.border`, the same field PairedPassage's divider
 * already uses), softened toward `colors.surface` (a stable near-white
 * anchor never touched by the six custom-color overrides) — NOT toward
 * `colors.bg`. Design System Correction (2026-08-08): the original formula
 * was 82% `colors.bg` / 18% `colors.border` — dominated by Background, the
 * opposite of what "neutral" should mean. For any palette where Neutral and
 * Background happen to be close in value (true of most pale, ivory-forward
 * wedding palettes, including every one of the 12 curated stories), that
 * made the "neutral" card nearly invisible — indistinguishable from the
 * flat page canvas — so three consecutive sections (a neutral pair, Music,
 * another neutral pair) all read as one undifferentiated wash of
 * Background, which is exactly the bug this correction fixes. Leaning on
 * Neutral itself, blended toward a stable white-ish anchor instead of the
 * page's own color, guarantees the card reads as a distinct surface
 * regardless of how close the couple picked Neutral and Background.
 * Deliberately NOT full-bleed (no `w-screen`/`vw`) — unlike "soft"/"strong"
 * this stays inside the normal content column, both because a quiet tint
 * shouldn't compete with a real color-field moment, and because the
 * `vw`-based full-bleed technique is the confirmed cause of WW-PREVIEW-01
 * (separately tracked) — giving two more sections that same full-bleed
 * treatment would only spread it.
 */
export function SectionCanvas({
  role, sparse, colors, children,
}: {
  role?: SectionRole;
  /** True when this section's actual content is too sparse for its
   * assigned scale (e.g. one Things To Do item) — collapses to interlude
   * spacing so a thin section doesn't sit inside a huge empty band. */
  sparse?: boolean;
  colors: { surface: string; secondary: string; accent: string; bg?: string; border?: string };
  children: React.ReactNode;
}) {
  if (!role) return <>{children}</>;

  const scale: SectionScale = sparse && role.scale !== "feature" ? "interlude" : role.scale;
  const margin = SCALE_MARGIN[scale];

  // Collection Composition Phase B (STOP-1) — independent light editorial
  // chamber. Soft/strong/neutral stay Color-Story-derived; `paper` paints a
  // fixed light field so a cinematic/dark hero Collection (Midnight) can
  // carry a light magazine story without inventing a second renderer.
  if (role.canvas === "paper") {
    return (
      <div style={{ marginTop: margin }}>
        <div className="relative left-1/2 right-1/2 -mx-[50cqw] w-[100cqw]" style={{ background: PAPER_CHAMBER.bg }}>
          <div className="max-w-5xl mx-auto px-6" style={{ paddingBlock: scale === "feature" ? "4.5rem" : "3.25rem" }}>
            {children}
          </div>
        </div>
      </div>
    );
  }

  const isColorField = role.canvas === "soft" || role.canvas === "strong";

  if (!isColorField) {
    const tint = role.canvas === "neutral" && colors.border
      ? `color-mix(in srgb, ${colors.border} 62%, ${colors.surface} 38%)`
      : undefined;
    if (!tint) return <div style={{ marginTop: margin }}>{children}</div>;
    // A defined edge (the Neutral role's other listed job: "borders") so
    // the card reads as a distinct surface even for palettes where Neutral
    // and Background are both pale and close in value — the fill tint
    // alone can be too subtle to rely on there, the edge never is.
    return (
      <div style={{
        marginTop: margin, background: tint, borderRadius: "1.5rem", padding: "2.5rem 2rem",
        border: `1px solid color-mix(in srgb, ${colors.border} 55%, transparent)`,
      }}>
        {children}
      </div>
    );
  }

  // Visual Composition Pass (2026-08-12) — "soft" and "strong" were grouped
  // together as `isColorField` for the full-bleed WIDTH treatment, but only
  // "strong" ever got an actual color: "soft" fell through to the exact
  // same flat `colors.surface` as a plain section, so a Collection's "soft"
  // moments (e.g. Garden Party's Event Details) rendered as indistinguishable
  // white space — full-bleed in structure only, not in the "intentional
  // tonal surface" the role is meant to read as. "soft" now washes toward
  // Secondary at a gentle strength — present and legible as a deliberate
  // surface, clearly quieter than "strong"'s full fill, which stays
  // reserved for genuine high-emphasis moments (RSVP/CTA).
  const background = role.canvas === "strong"
    ? (colors.secondary || colors.accent)
    : role.canvas === "soft"
      ? `color-mix(in srgb, ${colors.secondary || colors.accent} 32%, ${colors.surface} 68%)`
      : colors.surface;
  return (
    <div style={{ marginTop: margin }}>
      {/* WW-PREVIEW-01 — `cqw`/`100cqw` resolve against the `@container/
          wedding` established once on WeddingWebsite's own root div, not
          the outer browser viewport, so "full-bleed" means full width of
          the rendered website itself in every context (public, Studio
          desktop preview pane, Studio's simulated phone frame). */}
      <div className="relative left-1/2 right-1/2 -mx-[50cqw] w-[100cqw]" style={{ background }}>
        <div className="max-w-5xl mx-auto px-6" style={{ paddingBlock: "4rem" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ---- Page-level editorial primitives ---------------------------------------
// Coastal Art-Direction Pass 2 (2026-08-03). These compose whole sections
// (not just list items) — the answer to "the page reads as twelve stacked
// CMS bands." Each is a generic, reusable primitive keyed off
// `sectionRoles[key].treatment` (see lib/wedding-website/types.ts) — nothing
// here is Emma & Jordan/Sweet-Daisy-specific; every prop is real data or a
// graceful absence.

// ── Timeline — Schedule as a wedding-day journey, not a database list ──────
// `labelColor` (Step 11 — the whole Color Story as a design system, not
// just primary/secondary/another background) gives the palette's own
// `accent` a real, distinct job — small time labels — separate from
// `color` (primary), which stays the marker/rule/dominant accent.
export function ScheduleTimeline({ tc, color, labelColor, items }: { tc: CompositionTheme; color: string; labelColor?: string; items: CompositionItem[] }) {
  const lc = labelColor ?? color;
  return (
    <div style={{ maxWidth: widthFor(tc), marginInline: "auto" }}>
      <div className="relative" style={{ paddingLeft: "1.75rem" }}>
        <div className="absolute top-1 bottom-1" style={{ left: "3px", width: "1px", background: `${color}30` }} />
        {items.map((item, i) => (
          <div key={i} className="relative" style={{ paddingBottom: i === items.length - 1 ? 0 : gapFor(tc) }}>
            <div className="absolute rounded-full" style={{ left: "-1.75rem", top: "0.4rem", width: "7px", height: "7px", background: color }} />
            {item.label && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: `${lc}95` }}>{item.label}</p>
            )}
            <p style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal", color: tc.text, fontSize: "1.05rem", marginTop: "0.15rem" }}>
              {item.heading}
            </p>
            {item.body && <p className="text-sm mt-1 leading-relaxed" style={{ color: tc.textMuted }}>{item.body}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Schedule Date Moment — the desktop composition's right field. Purely
// decorative editorial typography derived from the page's own authoritative
// event date (never a second date source, never hand-entered) — it fills
// the wide desktop canvas beside the timeline with restrained hierarchy,
// not another card or image. Day number stays deliberately lower-contrast
// than the timeline's own text so it reads as atmosphere, not competing
// content. Caller omits this entirely when no date exists — this component
// never fabricates one.
export function ScheduleDateMoment({
  tc, color, day, month, year, sparse,
}: {
  tc: CompositionTheme; color: string; day: string; month: string; year: string;
  /** A 1-2 item schedule reads as sparse — the day number scales down with
   * it, same threshold SectionCanvas already uses, so a short schedule
   * never gets stretched taller just to match a decorative block that
   * assumed a fuller timeline. */
  sparse?: boolean;
}) {
  return (
    <div className="text-center @min-[1024px]/wedding:text-left">
      <p style={{
        fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal",
        fontSize: sparse ? "clamp(3rem, 6cqw, 4.5rem)" : "clamp(5rem, 9cqw, 8.5rem)", lineHeight: 0.9,
        color: `${tc.text}25`,
      }}>
        {day}
      </p>
      <p style={{
        fontFamily: tc.bodyFont, color, fontSize: "0.95rem", fontWeight: 600,
        letterSpacing: "0.3em", textTransform: "uppercase", marginTop: "0.5rem",
      }}>
        {month}
      </p>
      <p style={{
        fontFamily: tc.bodyFont, color: tc.textMuted, fontSize: "0.8rem",
        letterSpacing: "0.15em", marginTop: "0.25rem",
      }}>
        {year}
      </p>
    </div>
  );
}

// ── Editorial Opening — Our Story as the page's emotional opening spread ──
// Asymmetric: a narrow heading column beside a measured-width prose column,
// with an optional couple photograph never forced when none exists.
//
// Text-only mode (Our Story Image Ownership fix) is its own deliberate
// composition, not "the same grid with the image column deleted": the
// heading column gets Coastal's own short accent bar (the same motif
// `headerStyle: "coastal"` uses elsewhere) so it still reads as Coastal
// with no photo present, and the text column is intentionally narrower
// than the leftover space — a comfortable reading measure plus an
// asymmetric right margin, the same "confident negative space" move the
// Magazine gallery's 1-photo layout already uses, rather than stretching
// prose edge-to-edge into a generic content block.
export function EditorialOpening({
  tc, color, labelColor, eyebrow, heading, text, photoUrl,
}: {
  tc: CompositionTheme; color: string; labelColor?: string; eyebrow?: string; heading: React.ReactNode; text: string; photoUrl?: string | null;
}) {
  const lc = labelColor ?? color;
  return (
    <div className="grid grid-cols-1 @min-[768px]/wedding:grid-cols-12 gap-8 @min-[768px]/wedding:gap-12 @min-[768px]/wedding:items-start">
      <div className="@min-[768px]/wedding:col-span-4">
        {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.25em] mb-3" style={{ color: `${lc}95` }}>{eyebrow}</p>}
        {!photoUrl && <div style={{ height: "3px", width: "28px", background: color, marginBottom: "14px", borderRadius: "2px" }} />}
        <h2 style={{
          fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal",
          color: tc.text, fontSize: "clamp(1.7rem, 3.4cqw, 2.4rem)", lineHeight: 1.15,
        }}>
          {heading}
        </h2>
      </div>
      <div className={photoUrl ? "@min-[768px]/wedding:col-span-5" : "@min-[768px]/wedding:col-span-6"}>
        <p style={{ fontFamily: tc.bodyFont, color: tc.textMuted, fontSize: "1rem", lineHeight: 1.9 }}>{text}</p>
      </div>
      {photoUrl && (
        <div className="@min-[768px]/wedding:col-span-3">
          <div className="overflow-hidden" style={{ borderRadius: tc.cardRadius, aspectRatio: "3 / 4" }}>
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Paired Passage — two independent sections sharing one visual scene ────
// Purely presentational: `left`/`right` are each section's own already-
// rendered content (each still individually wrapped in its own
// SectionWrapper by the caller for edit-mode/scroll-reveal) — this only
// arranges them side by side. Data/editing stay fully independent; this
// composes ONLY when the caller has already confirmed both sides are
// present and adjacent in the couple's own section order.
const PAIR_SPAN: Record<number, string> = {
  4: "@min-[768px]/wedding:col-span-4", 5: "@min-[768px]/wedding:col-span-5", 6: "@min-[768px]/wedding:col-span-6",
  7: "@min-[768px]/wedding:col-span-7", 8: "@min-[768px]/wedding:col-span-8",
};

export function PairedPassage({
  left, right, leftSpan = 5, dividerColor,
}: {
  left: React.ReactNode; right: React.ReactNode; leftSpan?: 4 | 5 | 6 | 7 | 8; dividerColor: string;
}) {
  const rightSpan = (11 - leftSpan) as 4 | 5 | 6 | 7 | 8;
  return (
    <div className="grid grid-cols-1 @min-[768px]/wedding:grid-cols-12 gap-10 @min-[768px]/wedding:gap-8 @min-[768px]/wedding:items-start">
      <div className={PAIR_SPAN[leftSpan]}>{left}</div>
      <div className="hidden @min-[768px]/wedding:block @min-[768px]/wedding:col-span-1">
        {/* Step 11 — Color Story's `neutral` (-> border) role, otherwise
            unused anywhere in the renderer, gets its natural job: a rule. */}
        <div className="h-full w-px mx-auto" style={{ background: dividerColor }} />
      </div>
      <div className={PAIR_SPAN[rightSpan]}>{right}</div>
    </div>
  );
}

// ── Destination Feature — Things To Do, count-aware (Things To Do
// Sparse/Dense fix). Composes purely from name/category/description/
// address/url, never inventing content, no imagery, no ratings/reviews/
// prices/badges/maps embeds — only what the couple actually supplied.
// One shared entry renderer (`DestinationEntry`), scaled and arranged
// differently per count so the section always reads as intentionally
// designed rather than "however many cards happened to fit."
export type DestinationItem = {
  name: string; categoryLabel?: string; description?: string; address?: string; url?: string;
};

function DestinationEntry({
  tc, color, item, headingSize,
}: {
  tc: CompositionTheme; color: string; item: DestinationItem; headingSize: string;
}) {
  return (
    <div>
      {item.categoryLabel && (
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2" style={{ color: `${color}90` }}>{item.categoryLabel}</p>
      )}
      <p style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal", color: tc.text, fontSize: headingSize, lineHeight: 1.2 }}>
        {item.name}
      </p>
      {item.description && <p className="text-sm mt-2 leading-relaxed" style={{ color: tc.textMuted }}>{item.description}</p>}
      {(item.address || item.url) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          {/* Existing safe convention (see vendor-handbook-view.tsx) — a plain
              Google Maps search-query link, no new map integration. */}
          {item.address && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(item.address)}`} target="_blank" rel="noopener noreferrer"
              className="text-xs hover:underline" style={{ color: tc.textMuted }}>
              {item.address}
            </a>
          )}
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="text-xs font-medium hover:underline" style={{ color }}>
              Visit website ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function DestinationFeature({
  tc, color, items,
}: {
  tc: CompositionTheme; color: string; items: DestinationItem[];
}) {
  const n = items.length;

  // Exactly one — a featured destination, not a small centered card. Full
  // visual scale; the caller (wedding-website.tsx) already pairs this with
  // the section's own intro in a two-field composition on desktop.
  if (n === 1) {
    return <DestinationEntry tc={tc} color={color} item={items[0]} headingSize="clamp(1.6rem, 3.2cqw, 2.3rem)" />;
  }

  // Exactly two — a balanced pairing of comparable weight, reusing the same
  // paired-passage primitive (and its color-mix divider, an existing
  // Coastal border/accent role) Dress Code + Wedding Party already use.
  if (n === 2) {
    return (
      <PairedPassage
        dividerColor={`color-mix(in srgb, ${tc.border} 55%, ${tc.text} 45%)`}
        leftSpan={6}
        left={<DestinationEntry tc={tc} color={color} item={items[0]} headingSize="1.3rem" />}
        right={<DestinationEntry tc={tc} color={color} item={items[1]} headingSize="1.3rem" />}
      />
    );
  }

  // Exactly three — an intentional asymmetric composition: one recommendation
  // gets slightly more scale, two supporting recommendations balance it
  // (visual rhythm, not a ranking — same weight of copy/detail either way).
  if (n === 3) {
    return (
      <div className="grid grid-cols-1 @min-[1024px]/wedding:grid-cols-12 gap-8 @min-[1024px]/wedding:gap-12">
        <div className="@min-[1024px]/wedding:col-span-7">
          <DestinationEntry tc={tc} color={color} item={items[0]} headingSize="clamp(1.4rem, 2.6cqw, 1.75rem)" />
        </div>
        <div className="@min-[1024px]/wedding:col-span-5 space-y-7">
          <DestinationEntry tc={tc} color={color} item={items[1]} headingSize="1.2rem" />
          <div className="h-px" style={{ background: tc.border }} />
          <DestinationEntry tc={tc} color={color} item={items[2]} headingSize="1.2rem" />
        </div>
      </div>
    );
  }

  // Four or more — a scannable two-column list. Restrained rules between
  // rows (an existing border role, not card chrome) instead of boxes. Even
  // counts fill every row exactly. An odd count's final, unpaired
  // recommendation spans both columns as an intentional closing row —
  // same heading size, same treatment as every other entry, never
  // promoted to a feature — rather than sitting alone in the left column
  // with a visibly empty cell beside it.
  const isOdd = n % 2 === 1;
  return (
    <div className="grid grid-cols-1 @min-[768px]/wedding:grid-cols-2 gap-x-10 gap-y-8">
      {items.map((item, i) => {
        const isClosingRow = isOdd && i === n - 1;
        return (
          <div key={i}
            className={isClosingRow ? "@min-[768px]/wedding:col-span-2" : undefined}
            style={i >= 2 ? { borderTop: `1px solid ${tc.border}`, paddingTop: "1.5rem" } : undefined}>
            <DestinationEntry tc={tc} color={color} item={item} headingSize="1.15rem" />
          </div>
        );
      })}
    </div>
  );
}

// ── Compact Interlude — Music: a small romantic moment, never a section
// band on its own scale, and never a dashboard/card grid. Music-only (its
// one caller) — count-aware (the model caps at 4: ceremony/cocktail/
// reception/lastDance, so "4-6" in spirit means "up to the 4 that can ever
// exist"), always centered, always the same lighter voice regardless of
// how many moments a couple filled in. Legibility fix: the old moment-label
// eyebrow and footnote each stacked a Tailwind opacity utility ON TOP of
// tc.textMuted (which is already a deliberately toned-down color) — that
// compounding is what made them hard to read; both now use existing
// Color Story roles at their own tuned strength, no extra fade layered on.
function MusicEntry({ tc, lc, item, size }: { tc: CompositionTheme; lc: string; item: CompositionItem; size: string }) {
  return (
    <div>
      {item.label && <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2" style={{ color: `${lc}95` }}>{item.label}</p>}
      <p style={{ fontFamily: tc.headingFont, fontStyle: "italic", color: tc.text, fontSize: size, lineHeight: 1.3 }}>{item.heading}</p>
    </div>
  );
}

export function CompactInterlude({
  tc, color, labelColor, label, items, footnote,
}: {
  tc: CompositionTheme; color: string; labelColor?: string; label?: string; items: CompositionItem[]; footnote?: string;
}) {
  const lc = labelColor ?? color;
  const n = items.length;

  // One moment — carries the section alone, full romantic presence, no
  // multi-column grid around a single item.
  let body: React.ReactNode = null;
  if (n === 1) {
    body = (
      <div className="max-w-md mx-auto">
        <MusicEntry tc={tc} lc={lc} item={items[0]} size="clamp(1.5rem, 3cqw, 2rem)" />
      </div>
    );
  } else if (n === 2) {
    // Balanced pairing — the same primitive (and existing color-mix
    // divider role) Things To Do's 2-item state and Dress Code + Wedding
    // Party already use. No boxed cards.
    body = (
      <PairedPassage
        dividerColor={`color-mix(in srgb, ${tc.border} 55%, ${tc.text} 45%)`}
        leftSpan={6}
        left={<div className="text-center"><MusicEntry tc={tc} lc={lc} item={items[0]} size="1.3rem" /></div>}
        right={<div className="text-center"><MusicEntry tc={tc} lc={lc} item={items[1]} size="1.3rem" /></div>}
      />
    );
  } else if (n >= 3) {
    // Three or four (the model's real ceiling) — an equal-weight row/grid,
    // deliberately NOT the hero-plus-supporting pattern Things To Do uses:
    // no moment should read as more important than another. Column count
    // matches n exactly (3 or 4), so this can never leave an empty cell.
    body = (
      <div className={`grid grid-cols-1 ${n === 3 ? "@min-[640px]/wedding:grid-cols-3" : "@min-[640px]/wedding:grid-cols-2"} gap-x-10 gap-y-8 max-w-2xl mx-auto`}>
        {items.map((item, i) => (
          <div key={i} className="text-center">
            <MusicEntry tc={tc} lc={lc} item={item} size="1.2rem" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="text-center">
      {label && <p className="text-[10px] font-semibold uppercase tracking-[0.25em] mb-6" style={{ color: `${lc}95` }}>{label}</p>}
      {body}
      {footnote && <p className="text-xs mt-6" style={{ color: tc.textMuted }}>{footnote}</p>}
    </div>
  );
}

export { edgeWidthClass, widthFor, gapFor };
