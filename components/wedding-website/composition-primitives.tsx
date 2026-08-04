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
export type CanvasRole = "light" | "soft" | "strong" | "photographic" | "neutral";
export type SectionScale = "feature" | "standard" | "interlude";
// Coastal Art-Direction Pass 2 (2026-08-03) — `pairWith` names the one other
// section key this section may compose into a shared passage with, only
// when both sides name each other AND are currently adjacent (see
// wedding-website.tsx's renderGroups). `treatment` is documentation-only
// here (the actual dispatch lives in wedding-website.tsx's per-case
// `tc.sectionRoles ? <NewPrimitive/> : <old/>` branches) — kept on the type
// so the DB recipe and the TS shape stay in sync.
export type SectionRole = { canvas: CanvasRole; scale: SectionScale; treatment?: string; pairWith?: string };

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
  if (edge === "full-bleed") return "relative left-1/2 right-1/2 -mx-[50vw] w-screen px-6 md:px-16";
  if (edge === "wide") return "-mx-4 md:-mx-8";
  if (edge === "alternating") return index % 2 === 0 ? "-mx-2 md:-mx-6" : "";
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
    <div className="grid gap-4 sm:grid-cols-2" style={{ gap: gapFor(recipe), maxWidth: widthFor(recipe), marginInline: recipe.itemAlign === "center" ? "auto" : undefined }}>
      {items.map((item, i) => (
        <div key={i}
          className={featured && i === 0 ? "sm:col-span-2" : undefined}
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
              <div className="pt-5 md:flex md:items-baseline md:gap-8"
                style={{ flexDirection: flip ? "row-reverse" : "row", marginLeft: !flip ? shift : undefined, marginRight: flip ? shift : undefined }}>
                <div className="shrink-0 md:w-32">
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
  const cols = members.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3";

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
 * Wraps one section in its assigned canvas moment + visual weight.
 *
 * `role` is undefined for every Collection except Coastal in this pass —
 * in that case this renders children completely unchanged (no wrapper, no
 * margin change), so every other Collection's page is byte-for-byte the
 * same as before. "strong"/"soft" get a real full-bleed color field behind
 * the section; "light"/"neutral"/"photographic" only ever contribute the
 * scale-driven vertical rhythm, never a color change — restraint is the
 * point, not every section is a showcase.
 */
export function SectionCanvas({
  role, sparse, colors, children,
}: {
  role?: SectionRole;
  /** True when this section's actual content is too sparse for its
   * assigned scale (e.g. one Things To Do item) — collapses to interlude
   * spacing so a thin section doesn't sit inside a huge empty band. */
  sparse?: boolean;
  colors: { surface: string; secondary: string; accent: string };
  children: React.ReactNode;
}) {
  if (!role) return <>{children}</>;

  const scale: SectionScale = sparse && role.scale !== "feature" ? "interlude" : role.scale;
  const margin = SCALE_MARGIN[scale];
  const isColorField = role.canvas === "soft" || role.canvas === "strong";

  if (!isColorField) {
    return <div style={{ marginBlock: margin }}>{children}</div>;
  }

  const background = role.canvas === "strong" ? (colors.secondary || colors.accent) : colors.surface;
  return (
    <div style={{ marginBlock: margin }}>
      <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen" style={{ background }}>
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

// ── Editorial Opening — Our Story as the page's emotional opening spread ──
// Asymmetric: a narrow heading column beside a measured-width prose column,
// with an optional couple photograph never forced when none exists.
export function EditorialOpening({
  tc, color, labelColor, eyebrow, heading, text, photoUrl,
}: {
  tc: CompositionTheme; color: string; labelColor?: string; eyebrow?: string; heading: React.ReactNode; text: string; photoUrl?: string | null;
}) {
  const lc = labelColor ?? color;
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 md:items-start">
      <div className={photoUrl ? "md:col-span-4" : "md:col-span-4"}>
        {eyebrow && <p className="text-[10px] font-semibold uppercase tracking-[0.25em] mb-3" style={{ color: `${lc}95` }}>{eyebrow}</p>}
        <h2 style={{
          fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal",
          color: tc.text, fontSize: "clamp(1.7rem, 3.4vw, 2.4rem)", lineHeight: 1.15,
        }}>
          {heading}
        </h2>
      </div>
      <div className={photoUrl ? "md:col-span-5" : "md:col-span-8"}>
        <p style={{ fontFamily: tc.bodyFont, color: tc.textMuted, fontSize: "1rem", lineHeight: 1.9 }}>{text}</p>
      </div>
      {photoUrl && (
        <div className="md:col-span-3">
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
  4: "md:col-span-4", 5: "md:col-span-5", 6: "md:col-span-6", 7: "md:col-span-7", 8: "md:col-span-8",
};

export function PairedPassage({
  left, right, leftSpan = 5, dividerColor,
}: {
  left: React.ReactNode; right: React.ReactNode; leftSpan?: 4 | 5 | 6 | 7 | 8; dividerColor: string;
}) {
  const rightSpan = (11 - leftSpan) as 4 | 5 | 6 | 7 | 8;
  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 md:items-start">
      <div className={PAIR_SPAN[leftSpan]}>{left}</div>
      <div className="hidden md:block md:col-span-1">
        {/* Step 11 — Color Story's `neutral` (-> border) role, otherwise
            unused anywhere in the renderer, gets its natural job: a rule. */}
        <div className="h-full w-px mx-auto" style={{ background: dividerColor }} />
      </div>
      <div className={PAIR_SPAN[rightSpan]}>{right}</div>
    </div>
  );
}

// ── Destination Feature — Things To Do as a small guest moment, not a
// nearly-empty database section. No imagery field exists on things_to_do
// items today (see completion report "known limitations") — this composes
// purely from name/description/address/link, never inventing content. ────
export function DestinationFeature({
  tc, color, items,
}: {
  tc: CompositionTheme; color: string; items: CompositionItem[];
}) {
  if (items.length === 1) {
    const item = items[0];
    return (
      <div className="max-w-lg mx-auto text-center">
        {item.label && <div className="text-2xl mb-3">{item.label}</div>}
        <p style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal", color: tc.text, fontSize: "1.35rem" }}>
          {item.href ? <a href={item.href} target="_blank" rel="noopener noreferrer" style={{ color: tc.text }}>{item.heading}</a> : item.heading}
        </p>
        {item.body && <p className="text-sm mt-2 leading-relaxed" style={{ color: tc.textMuted }}>{item.body}</p>}
        {item.meta && <p className="text-xs mt-2 opacity-55" style={{ color: tc.textMuted }}>{item.meta}</p>}
      </div>
    );
  }
  return (
    <div className="grid gap-8 sm:grid-cols-2" style={{ maxWidth: widthFor(tc), marginInline: "auto" }}>
      {items.map((item, i) => (
        <div key={i} className="text-left">
          {item.label && <div className="text-xl mb-2">{item.label}</div>}
          <p style={{ fontFamily: tc.headingFont, fontStyle: tc.headingItalic ? "italic" : "normal", color: tc.text, fontSize: "1.05rem" }}>
            {item.href ? <a href={item.href} target="_blank" rel="noopener noreferrer" style={{ color: tc.text }}>{item.heading}</a> : item.heading}
          </p>
          {item.body && <p className="text-sm mt-1 leading-relaxed" style={{ color: tc.textMuted }}>{item.body}</p>}
          {item.meta && <p className="text-xs mt-1 opacity-55" style={{ color: tc.textMuted }}>{item.meta}</p>}
        </div>
      ))}
    </div>
  );
}

// ── Compact Interlude — Music: a small romantic moment, never a section
// band on its own scale. ─────────────────────────────────────────────────
export function CompactInterlude({
  tc, color, labelColor, label, items, footnote,
}: {
  tc: CompositionTheme; color: string; labelColor?: string; label?: string; items: CompositionItem[]; footnote?: string;
}) {
  const lc = labelColor ?? color;
  return (
    <div className="max-w-md mx-auto text-center">
      {label && <p className="text-[10px] font-semibold uppercase tracking-[0.25em] mb-4" style={{ color: `${lc}95` }}>{label}</p>}
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i}>
            {item.label && <p className="text-[11px] uppercase tracking-wide opacity-55" style={{ color: tc.textMuted }}>{item.label}</p>}
            <p style={{ fontFamily: tc.headingFont, fontStyle: "italic", color: tc.text, fontSize: "1.05rem" }}>{item.heading}</p>
          </div>
        ))}
      </div>
      {footnote && <p className="text-xs opacity-40 mt-4" style={{ color: tc.textMuted }}>{footnote}</p>}
    </div>
  );
}

export { edgeWidthClass, widthFor, gapFor };
