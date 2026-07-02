"use client";

/**
 * WebsiteStudio — Sprint 69
 *
 * "Couples stop filling out forms and start designing their wedding website."
 *
 * Three layers:
 *   1. Guided setup wizard — first-time users walk through Photo → Theme → Story → Preview
 *   2. Split layout (desktop) — sidebar editor left, live preview right
 *   3. Theme carousel — ← cycle themes → with instant preview update
 *
 * Mobile: full-screen editor with a "Preview" toggle tab.
 * Desktop: side-by-side studio with scaled live preview.
 */

import * as React from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, Monitor, Smartphone, X } from "lucide-react";
import { toast } from "sonner";

import type { CoupleWebsite, WebsiteContent, WebsiteSuggestions } from "@/lib/wedding-website/types";
import type { PortalContext } from "@/lib/portal/types";
import type { PublicWebsite } from "@/lib/wedding-website/types";

// ── Theme collection data ─────────────────────────────────────────────────────
// Each collection has a gradient (for the preview card), typography sample, and
// 3 named palettes (swatch color is the accent of that palette).

type StudioPalette = { name: string; accent: string; gradient: string; dark?: boolean };

const STUDIO_THEMES = [
  { value: "classic",   name: "Wildflower",   mood: "Garden romance",        font: "'Playfair Display', Georgia, serif",        italic: false,
    palettes: [
      { name: "Sage",        accent: "#97AC9E", gradient: "linear-gradient(160deg, #6A8A78 0%, #97AC9E 50%, #C8D5C8 100%)" },
      { name: "Mauve",       accent: "#B89AAC", gradient: "linear-gradient(160deg, #8A7080 0%, #B898AC 50%, #DCC8D4 100%)" },
      { name: "Terracotta",  accent: "#B49480", gradient: "linear-gradient(160deg, #907060 0%, #B49480 50%, #D4B8A0 100%)" },
    ] as StudioPalette[] },
  { value: "romance",   name: "Rosé",         mood: "Soft femininity",       font: "'Cormorant Garamond', Georgia, serif",      italic: true,
    palettes: [
      { name: "Blush",       accent: "#CCA8A0", gradient: "linear-gradient(160deg, #A07070 0%, #CCA8A0 50%, #EDD6CE 100%)" },
      { name: "Petal",       accent: "#CCA0B0", gradient: "linear-gradient(160deg, #A07088 0%, #CCA0B0 50%, #EDD0DC 100%)" },
      { name: "Powder",      accent: "#A0A8CC", gradient: "linear-gradient(160deg, #707090 0%, #A0A8CC 50%, #D0D4E8 100%)" },
    ] as StudioPalette[] },
  { value: "champagne", name: "Champagne",    mood: "Black-tie invitation",  font: "'Playfair Display', Georgia, serif",        italic: false,
    palettes: [
      { name: "Warm Stone",  accent: "#C4AE88", gradient: "linear-gradient(160deg, #7A6040 0%, #A08558 60%, #C4AE88 100%)" },
      { name: "Ecru",        accent: "#B4A888", gradient: "linear-gradient(160deg, #6A5A38 0%, #9A8860 60%, #B8A880 100%)" },
      { name: "Charcoal",    accent: "#989890", gradient: "linear-gradient(160deg, #3A3A38 0%, #686860 60%, #989890 100%)" },
    ] as StudioPalette[] },
  { value: "velvet",    name: "Velvet",       mood: "Editorial luxury",      font: "'Cormorant Garamond', Georgia, serif",      italic: false,
    palettes: [
      { name: "Burgundy",    accent: "#C9B89A", gradient: "linear-gradient(160deg, #1E1015 0%, #3A1820 60%, #5B3438 100%)", dark: true },
      { name: "Noir",        accent: "#C0B89A", gradient: "linear-gradient(160deg, #0A0A0A 0%, #1A1818 50%, #2A2020 100%)", dark: true },
      { name: "Plum",        accent: "#C0A8CC", gradient: "linear-gradient(160deg, #140A18 0%, #28183A 50%, #3A2048 100%)", dark: true },
    ] as StudioPalette[] },
  { value: "coastal",   name: "Coastal",      mood: "Nantucket, salt air",   font: "'Plus Jakarta Sans', system-ui, sans-serif", italic: false,
    palettes: [
      { name: "Navy",        accent: "#4A6278", gradient: "linear-gradient(160deg, #324E64 0%, #4A6278 50%, #C8DCE8 100%)" },
      { name: "Sea Glass",   accent: "#4A7868", gradient: "linear-gradient(160deg, #2A5848 0%, #4A7868 50%, #A0C8BC 100%)" },
      { name: "Sand",        accent: "#9A8068", gradient: "linear-gradient(160deg, #5A4A38 0%, #9A8068 60%, #C0AE98 100%)" },
    ] as StudioPalette[] },
  { value: "garden",    name: "Garden Party", mood: "English countryside",   font: "Georgia, serif",                           italic: false,
    palettes: [
      { name: "Eucalyptus",  accent: "#9DC4A8", gradient: "linear-gradient(160deg, #5A8A70 0%, #7AAE8C 50%, #B0CEBC 100%)" },
      { name: "Peony",       accent: "#D4A0AC", gradient: "linear-gradient(160deg, #B07088 0%, #D4A0AC 50%, #EECCD4 100%)" },
      { name: "Wisteria",    accent: "#A898C0", gradient: "linear-gradient(160deg, #685898 0%, #A898C0 50%, #CCC0D8 100%)" },
    ] as StudioPalette[] },
  { value: "minimal",   name: "Linen",        mood: "Letterpress, timeless", font: "Georgia, serif",                           italic: false,
    palettes: [
      { name: "Ivory",       accent: "#C8B898", gradient: "linear-gradient(160deg, #D8CFC2 0%, #EBE5DB 100%)" },
      { name: "Blush",       accent: "#D4B8B0", gradient: "linear-gradient(160deg, #D8C4C0 0%, #EBD8D5 100%)" },
      { name: "Slate",       accent: "#A8B0B8", gradient: "linear-gradient(160deg, #C0C8D0 0%, #D8DCE4 100%)" },
    ] as StudioPalette[] },
  { value: "modern",    name: "Midnight",     mood: "Atmospheric indigo",    font: "'DM Sans', system-ui, sans-serif",          italic: false,
    palettes: [
      { name: "Indigo",      accent: "#BFB8CE", gradient: "linear-gradient(160deg, #120F1A 0%, #1E1828 40%, #2E2545 100%)", dark: true },
      { name: "Onyx",        accent: "#C0B8A8", gradient: "linear-gradient(160deg, #0A0A0A 0%, #181818 50%, #252520 100%)", dark: true },
      { name: "Plum",        accent: "#C0A8CC", gradient: "linear-gradient(160deg, #120818 0%, #1E1030 40%, #2E1848 100%)", dark: true },
    ] as StudioPalette[] },
] as const;

type StudioTheme = typeof STUDIO_THEMES[number]["value"];

// ── Setup wizard ──────────────────────────────────────────────────────────────

type WizardStep = "welcome" | "photo" | "theme" | "story" | "preview";

const WIZARD_STEPS: WizardStep[] = ["welcome", "photo", "theme", "story", "preview"];

function WizardProgress({ step }: { step: WizardStep }) {
  const idx = WIZARD_STEPS.indexOf(step);
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {WIZARD_STEPS.filter(s => s !== "welcome").map((s, i) => (
        <div key={s} className={`h-1 rounded-full transition-all ${i <= idx - 1 ? "w-6" : "w-3"}`}
          style={{ background: i <= idx - 1 ? "#5D6F5D" : "#5D6F5D30" }} />
      ))}
    </div>
  );
}

function SetupWizard({
  step, setStep, onComplete,
  site, suggestions, token,
  onSaveSection, onSaveTheme, coupleName,
}: {
  step: WizardStep;
  setStep: (s: WizardStep) => void;
  onComplete: () => void;
  site: CoupleWebsite;
  suggestions: WebsiteSuggestions | null;
  token: string;
  onSaveSection: (key: string, value: object) => Promise<void>;
  onSaveTheme: (theme: StudioTheme, palette: string) => Promise<void>;
  coupleName: string;
}) {
  const [selectedPhoto, setSelectedPhoto] = React.useState(site.content?.home?.coverImageUrl ?? "");
  const [selectedTheme, setSelectedTheme] = React.useState<StudioTheme>((site.theme ?? "classic") as StudioTheme);
  const [selectedPalette, setSelectedPalette] = React.useState<string>(site.themePalette ?? "");
  const [storyText, setStoryText] = React.useState(site.content?.story?.text ?? "");
  const [saving, setSaving] = React.useState(false);

  const eng = suggestions?.engagementPhotos ?? [];

  async function advance(next: WizardStep | "done") {
    setSaving(true);
    try {
      if (step === "photo" && selectedPhoto) {
        await onSaveSection("home", {
          ...(site.content?.home ?? {}),
          title: site.content?.home?.title ?? suggestions?.coupleNames ?? coupleName,
          coverImageUrl: selectedPhoto,
        });
      }
      if (step === "theme") {
        const tc = STUDIO_THEMES.find(t => t.value === selectedTheme) ?? STUDIO_THEMES[0];
        const palette = selectedPalette || tc.palettes[0].name;
        await onSaveTheme(selectedTheme, palette);
      }
      if (step === "story" && storyText.trim()) {
        await onSaveSection("story", { title: "Our Story", text: storyText });
      }
    } finally { setSaving(false); }
    if (next === "done") onComplete();
    else setStep(next);
  }

  const tc = STUDIO_THEMES.find(t => t.value === selectedTheme) ?? STUDIO_THEMES[0];
  const tcPalette = (tc.palettes as StudioPalette[]).find(p => p.name === (selectedPalette || tc.palettes[0].name)) ?? tc.palettes[0];

  // ── Welcome ──
  if (step === "welcome") return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
      style={{ background: "linear-gradient(160deg, #5D6F5D 0%, #3A4D3A 60%, #C17F84 100%)" }}>
      <div className="max-w-md space-y-6">
        <div className="space-y-2">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-[0.3em]">Website Studio</p>
          <h1 className="text-4xl font-bold text-white leading-tight" style={{ fontFamily: "Georgia, serif" }}>
            Let's build your<br />wedding website.
          </h1>
        </div>
        {(suggestions?.story?.text || suggestions?.venue?.name || (eng.length > 0)) && (
          <div className="rounded-2xl bg-white/10 backdrop-blur p-4 space-y-2 text-left">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-[0.15em]">Already waiting for you</p>
            <div className="space-y-1.5">
              {suggestions?.coupleNames && <p className="text-white text-sm">✦ Your names: {suggestions.coupleNames}</p>}
              {suggestions?.venue?.name && <p className="text-white text-sm">📍 {suggestions.venue.name}</p>}
              {suggestions?.story?.text && <p className="text-white text-sm">💗 Your story</p>}
              {eng.length > 0 && <p className="text-white text-sm">📸 {eng.length} engagement photo{eng.length === 1 ? "" : "s"}</p>}
            </div>
          </div>
        )}
        <button type="button" onClick={() => setStep("photo")}
          className="w-full rounded-2xl py-4 text-base font-semibold bg-white text-[#3A4D3A] hover:bg-white/90 transition-colors">
          ✨ Let's get started
        </button>
        <button type="button" onClick={onComplete} className="text-white/50 text-sm hover:text-white/80 transition-colors">
          Skip setup — go straight to studio
        </button>
      </div>
    </div>
  );

  // ── Photo ──
  if (step === "photo") return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <WizardHeader step={step} onSkip={() => advance("theme")} />
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <p className="text-3xl">📸</p>
          <h2 className="text-2xl font-bold text-heading" style={{ fontFamily: "Georgia, serif" }}>Choose your favorite photo.</h2>
          <p className="text-sm text-muted-foreground">This will be the first thing guests see.</p>
        </div>

        {eng.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Your engagement photos</p>
            <div className="grid grid-cols-3 gap-2">
              {eng.slice(0, 9).map((p, i) => (
                <button key={p.id} type="button" onClick={() => setSelectedPhoto(p.url)}
                  className={`relative rounded-xl overflow-hidden transition-all hover:scale-[1.02] ${selectedPhoto === p.url ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  style={{ aspectRatio: "1/1" }}>
                  <img src={p.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  {selectedPhoto === p.url && (
                    <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                      <div className="h-7 w-7 rounded-full bg-card flex items-center justify-center">
                        <span className="text-primary text-sm font-bold">✓</span>
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {eng.length === 0 && (
          <div className="text-center py-10 space-y-2">
            <p className="text-4xl">🌿</p>
            <p className="text-sm text-muted-foreground">No engagement photos uploaded yet.</p>
            <p className="text-xs text-muted-foreground">You can add photos from your Profile, or skip this step and add them later.</p>
          </div>
        )}
      </div>
      <WizardFooter
        onBack={() => setStep("welcome")}
        onNext={() => advance("theme")}
        nextLabel={selectedPhoto ? "Use this photo →" : "Skip for now →"}
        saving={saving}
      />
    </div>
  );

  // ── Theme ──
  if (step === "theme") {
    const activeCollection = STUDIO_THEMES.find(t => t.value === selectedTheme) ?? STUDIO_THEMES[0];
    const activePaletteName = selectedPalette || activeCollection.palettes[0].name;
    const activePalette = activeCollection.palettes.find(p => p.name === activePaletteName) ?? activeCollection.palettes[0];
    return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <WizardHeader step={step} onSkip={() => advance("story")} />
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <p className="text-3xl">🎨</p>
          <h2 className="text-2xl font-bold text-heading" style={{ fontFamily: "Georgia, serif" }}>Choose your aesthetic.</h2>
          <p className="text-sm text-muted-foreground">Pick the feeling, then choose your palette.</p>
        </div>

        {/* Collection grid */}
        <div className="grid grid-cols-2 gap-3">
          {STUDIO_THEMES.map(theme => {
            const isSelected = selectedTheme === theme.value;
            const previewPalette = theme.palettes[0];
            return (
              <button key={theme.value} type="button"
                onClick={() => { setSelectedTheme(theme.value as StudioTheme); setSelectedPalette(""); }}
                className={`relative rounded-2xl overflow-hidden text-left transition-all hover:scale-[1.01] ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}>
                <div className="h-20 relative" style={{ background: previewPalette.gradient }}>
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
                    <p className="text-[9px] uppercase tracking-[0.2em] mb-0.5" style={{ color: previewPalette.dark ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.7)" }}>
                      {theme.mood}
                    </p>
                    <p className="text-sm font-semibold leading-tight"
                      style={{ fontFamily: theme.font, fontStyle: theme.italic ? "italic" : "normal", color: "white" }}>
                      {suggestions?.coupleNames ?? coupleName}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-white/90 flex items-center justify-center shadow">
                      <span className="text-[10px] text-[#5D6F5D] font-bold">✓</span>
                    </div>
                  )}
                </div>
                <div className="px-3 py-2.5 bg-white border-t border-black/5 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-heading">{theme.name}</p>
                  <div className="flex gap-1">
                    {theme.palettes.map(p => (
                      <div key={p.name} className="h-3 w-3 rounded-full border border-black/10"
                        style={{ background: p.accent }} />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Palette chips — appear when a collection is selected */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {activeCollection.name} palette
            </p>
            <div className="h-4 w-px bg-border" />
            <p className="text-xs text-muted-foreground">{activePaletteName}</p>
          </div>
          <div className="flex gap-3">
            {activeCollection.palettes.map(p => {
              const isActive = p.name === activePaletteName;
              return (
                <button key={p.name} type="button"
                  onClick={() => setSelectedPalette(p.name)}
                  className="flex flex-col items-center gap-1.5 group">
                  <div className={`h-10 w-10 rounded-full border-2 transition-all ${isActive ? "border-[#5D6F5D] scale-110 shadow-md" : "border-transparent hover:border-border"}`}
                    style={{ background: p.gradient }} />
                  <p className={`text-[10px] ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                    {p.name}
                  </p>
                </button>
              );
            })}
          </div>
          {/* Mini preview bar showing selected aesthetic */}
          <div className="h-8 rounded-xl overflow-hidden" style={{ background: activePalette.gradient }} />
        </div>
      </div>
      <WizardFooter
        onBack={() => setStep("photo")}
        onNext={() => advance("story")}
        nextLabel="This is us →"
        saving={saving}
      />
    </div>
    );
  }

  // ── Story ──
  if (step === "story") return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <WizardHeader step={step} onSkip={() => advance("preview")} />
      <div className="flex-1 overflow-y-auto px-6 py-8 max-w-lg mx-auto w-full space-y-6">
        <div className="text-center space-y-2">
          <p className="text-3xl">💗</p>
          <h2 className="text-2xl font-bold text-heading" style={{ fontFamily: "Georgia, serif" }}>Tell the world how you found each other.</h2>
          <p className="text-sm text-muted-foreground">Guests love reading this. Make it yours.</p>
        </div>

        {suggestions?.story?.text && !storyText && (
          <div className="rounded-xl border border-[#5D6F5D]/30 bg-[#5D6F5D]/5 p-4 space-y-3">
            <p className="text-xs font-semibold text-[#5D6F5D]">✦ From your profile — tap to use</p>
            <p className="text-sm text-foreground/70 leading-relaxed">{suggestions.story.text}</p>
            <button type="button" onClick={() => setStoryText(suggestions.story!.text)}
              className="text-sm font-semibold px-4 py-2 rounded-xl text-white w-full"
              style={{ background: "#5D6F5D" }}>
              Use this story
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">{storyText && suggestions?.story?.text ? "Customized story" : "Your story"}</p>
          <textarea
            value={storyText}
            onChange={e => setStoryText(e.target.value)}
            rows={6}
            placeholder="We met at a coffee shop in Nashville on a rainy Tuesday morning…"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
          <p className="text-[10px] text-muted-foreground text-right">{storyText.length} / 500</p>
        </div>
      </div>
      <WizardFooter
        onBack={() => setStep("theme")}
        onNext={() => advance("preview")}
        nextLabel={storyText.trim() ? "Love it →" : "Skip for now →"}
        saving={saving}
      />
    </div>
  );

  // ── Preview ──
  if (step === "preview") return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button type="button" onClick={() => setStep("story")} className="p-2 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-heading">Here's your website.</p>
          <WizardProgress step={step} />
        </div>
        <div className="w-9" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 space-y-6">
        {/* Mini website preview card */}
        <div className="w-full max-w-xs rounded-2xl overflow-hidden shadow-2xl border border-border">
          <div className="h-44 flex flex-col items-center justify-center text-center px-4"
            style={{ background: tcPalette.gradient }}>
            {selectedPhoto && (
              <div className="absolute inset-0 opacity-50"
                style={{ backgroundImage: `url(${selectedPhoto})`, backgroundSize: "cover", backgroundPosition: "center" }} />
            )}
            <div className="relative z-10 space-y-2">
              <p className="text-[9px] text-white/60 uppercase tracking-[0.25em]">Wedding</p>
              <p className="text-xl font-bold text-white" style={{ fontFamily: tc.font, fontStyle: tc.italic ? "italic" : "normal" }}>
                {suggestions?.coupleNames ?? coupleName}
              </p>
              {suggestions?.event?.eventDate && (
                <p className="text-xs text-white/70">
                  {new Date(suggestions.event.eventDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          </div>
          <div className="p-4 bg-white space-y-2">
            {storyText ? (
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{storyText}</p>
            ) : (
              <p className="text-xs text-gray-300 italic">Your story will appear here…</p>
            )}
          </div>
        </div>

        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-heading">
            {tc.name} · {suggestions?.coupleNames ?? coupleName}
          </p>
          <p className="text-xs text-muted-foreground">Looking beautiful. You can keep building in the studio.</p>
        </div>

        <div className="w-full max-w-xs space-y-2">
          <button type="button" onClick={() => advance("done")} disabled={saving}
            className="w-full rounded-2xl py-3.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "#5D6F5D" }}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "✨ Open Website Studio"}
          </button>
        </div>
      </div>
    </div>
  );

  return null;
}

function WizardHeader({ step, onSkip }: { step: WizardStep; onSkip: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <div className="w-16" />
      <WizardProgress step={step} />
      <button type="button" onClick={onSkip} className="text-xs text-muted-foreground hover:text-foreground w-16 text-right">
        Skip →
      </button>
    </div>
  );
}

function WizardFooter({ onBack, onNext, nextLabel, saving }: {
  onBack: () => void; onNext: () => void; nextLabel: string; saving: boolean;
}) {
  return (
    <div className="px-6 py-4 border-t border-border flex gap-3">
      <button type="button" onClick={onBack}
        className="flex items-center gap-1 px-4 py-3 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/40">
        <ChevronLeft className="h-4 w-4" /> Back
      </button>
      <button type="button" onClick={onNext} disabled={saving}
        className="flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: "#5D6F5D" }}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : nextLabel}
      </button>
    </div>
  );
}

// ── Theme carousel (desktop sidebar header) ───────────────────────────────────

function ThemeCarousel({ currentTheme, currentPalette, onChange }: {
  currentTheme: StudioTheme;
  currentPalette?: string;
  onChange: (theme: StudioTheme, palette: string) => void;
}) {
  const idx = STUDIO_THEMES.findIndex(t => t.value === currentTheme);
  const tc = STUDIO_THEMES[idx] ?? STUDIO_THEMES[0];
  const activePaletteName = currentPalette || tc.palettes[0].name;
  const activePalette = tc.palettes.find(p => p.name === activePaletteName) ?? tc.palettes[0];

  function prev() {
    const next = STUDIO_THEMES[(idx - 1 + STUDIO_THEMES.length) % STUDIO_THEMES.length];
    onChange(next.value as StudioTheme, next.palettes[0].name);
  }
  function next() {
    const nx = STUDIO_THEMES[(idx + 1) % STUDIO_THEMES.length];
    onChange(nx.value as StudioTheme, nx.palettes[0].name);
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-border">
      {/* Mini preview */}
      <div className="h-20 relative flex items-center justify-center"
        style={{ background: activePalette.gradient }}>
        <p className="text-base font-semibold text-white" style={{ fontFamily: tc.font, fontStyle: tc.italic ? "italic" : "normal" }}>
          Emily &amp; James
        </p>
      </div>
      {/* Collection controls */}
      <div className="flex items-center bg-card px-2 pt-2.5 pb-1">
        <button type="button" onClick={prev} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-semibold text-heading">{tc.name}</p>
          <p className="text-[10px] text-muted-foreground leading-tight px-1">{tc.mood}</p>
        </div>
        <button type="button" onClick={next} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {/* Palette dots */}
      <div className="flex items-center justify-center gap-2.5 pb-3 bg-card">
        {tc.palettes.map(p => (
          <button key={p.name} type="button"
            onClick={() => onChange(currentTheme, p.name)}
            title={p.name}
            className={`rounded-full border-2 transition-all ${p.name === activePaletteName ? "h-5 w-5 border-foreground scale-110" : "h-4 w-4 border-transparent hover:border-border"}`}
            style={{ background: p.accent }} />
        ))}
      </div>
    </div>
  );
}

// ── Main Studio component ─────────────────────────────────────────────────────

export function WebsiteStudio({
  token, initialSite, origin, initialGuests, context,
}: {
  token: string;
  initialSite: CoupleWebsite;
  origin: string;
  initialGuests?: { id: string; firstName: string; lastName: string | null; email: string | null; rsvpStatus: string; rsvpSentAt?: string | null }[];
  context: PortalContext;
}) {
  // Mirror the site + content for the live preview
  const [previewSite, setPreviewSite] = React.useState<CoupleWebsite>(initialSite);
  const [previewContent, setPreviewContent] = React.useState<WebsiteContent>(initialSite.content ?? {});

  // Wizard
  const [wizardStep, setWizardStep] = React.useState<WizardStep | null>(null);
  const [wizardDismissed, setWizardDismissed] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<WebsiteSuggestions | null>(null);

  // Studio UI state
  const [activeSection, setActiveSection] = React.useState<string | null>(null);
  const [focusSection, setFocusSection] = React.useState<string | null>(null);
  const [mobileView, setMobileView] = React.useState<"edit" | "preview">("edit");
  const [previewDevice, setPreviewDevice] = React.useState<"mobile" | "desktop">("desktop");
  const [savingTheme, setSavingTheme] = React.useState(false);

  const coupleName = [context.client.firstName, context.client.partnerFirstName].filter(Boolean).join(" & ");
  const completedSections = React.useMemo(
    () => ["home", "story", "event", "gallery", "schedule", "travel", "dress_code", "bridal_party", "things_to_do", "music", "registry", "faq"]
      .filter(k => {
        const c = previewContent as Record<string, unknown>;
        if (k === "home") return !!(c.home as { title?: string })?.title || !!(c.home as { coverImageUrl?: string })?.coverImageUrl;
        const v = c[k];
        if (Array.isArray(v)) return v.length > 0;
        if (v && typeof v === "object") return Object.values(v as object).some(x => x && (typeof x !== "object" || (Array.isArray(x) ? x.length > 0 : Object.keys(x).length > 0)));
        return !!v;
      }).length,
    [previewContent]
  );

  // Fetch suggestions + decide whether to show wizard
  React.useEffect(() => {
    fetch(`/api/portal/website/suggestions?token=${token}`)
      .then(r => r.json())
      .then((d: WebsiteSuggestions | null) => {
        setSuggestions(d);
        // Show wizard on first open if less than 2 sections filled
        if (!wizardDismissed && completedSections < 2 && !initialSite.isPublished) {
          setWizardStep("welcome");
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Build PublicWebsite shape for the live preview
  const livePreviewSite = React.useMemo((): PublicWebsite => ({
    siteId: previewSite.id,
    slug: previewSite.slug ?? "",
    theme: previewSite.theme,
    themePalette: previewSite.themePalette,
    accentColor: previewSite.accentColor,
    fontPairing: previewSite.fontPairing,
    sectionOrder: previewSite.sectionOrder,
    sectionsEnabled: previewSite.sectionsEnabled,
    content: previewContent,
    couple: {
      firstName: context.client.firstName,
      lastName: context.client.lastName ?? null,
      partnerFirstName: context.client.partnerFirstName ?? null,
      partnerLastName: context.client.partnerLastName ?? null,
    },
    event: context.event ? {
      id: context.event.id,
      name: context.event.name ?? "",
      eventDate: context.event.eventDate,
      eventType: context.event.eventType ?? null,
    } : null,
  }), [previewSite, previewContent, context]);

  async function handleSaveSection(key: string, value: object) {
    setPreviewContent(c => ({ ...c, [key]: value }));
  }

  async function handleAppearanceChanged(patch: Partial<CoupleWebsite & { fontPairing: string }>) {
    setPreviewSite(s => ({ ...s, ...patch }));
  }

  async function handleSaveTheme(theme: StudioTheme, palette: string) {
    setSavingTheme(true);
    try {
      await fetch("/api/portal/website", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, theme, themePalette: palette }),
      });
      setPreviewSite(s => ({ ...s, theme, themePalette: palette }));
    } finally { setSavingTheme(false); }
  }

  function handleSectionClick(key: string) {
    // Switch to edit tab on mobile, scroll section on desktop
    setMobileView("edit");
    setActiveSection(key);
    setFocusSection(key);
    // Reset focusSection after a tick so it can re-trigger if clicked again
    setTimeout(() => setFocusSection(null), 800);
  }

  const { WebsiteEditor } = require("@/components/portal/website-editor") as { WebsiteEditor: React.ComponentType<WebsiteEditorProps> };
  const { WeddingWebsite } = require("@/components/wedding-website/wedding-website") as { WeddingWebsite: React.ComponentType<WeddingWebsiteProps> };

  const showWizard = wizardStep !== null && !wizardDismissed;

  return (
    <>
      {/* ── Guided setup wizard ── */}
      {showWizard && wizardStep && (
        <SetupWizard
          step={wizardStep}
          setStep={setWizardStep}
          onComplete={() => { setWizardStep(null); setWizardDismissed(true); }}
          site={previewSite}
          suggestions={suggestions}
          token={token}
          onSaveSection={async (key, value) => {
            await fetch("/api/portal/website", {
              method: "POST", headers: { "content-type": "application/json" },
              body: JSON.stringify({ token, contentKey: key, contentValue: value }),
            });
            setPreviewContent(c => ({ ...c, [key]: value }));
            toast.success("Saved!");
          }}
          onSaveTheme={handleSaveTheme}
          coupleName={coupleName}
        />
      )}

      {/* ── Studio shell ── */}
      <div className="flex flex-col lg:flex-row h-full">

        {/* Mobile view toggle */}
        <div className="lg:hidden flex items-center gap-1 px-4 py-2 border-b border-border bg-card">
          <button type="button" onClick={() => setMobileView("edit")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${mobileView === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            ✏ Edit
          </button>
          <button type="button" onClick={() => setMobileView("preview")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${mobileView === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <Eye className="h-3.5 w-3.5" /> Preview
          </button>
        </div>

        {/* ── Sidebar (editor) ── */}
        <div className={`lg:w-[400px] lg:shrink-0 lg:border-r border-border lg:overflow-y-auto ${mobileView === "preview" ? "hidden lg:block" : "block"}`}>

          {/* Studio top bar */}
          <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">Website Studio</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {completedSections} section{completedSections !== 1 ? "s" : ""} added
                {previewSite.isPublished && " · 🟢 Live"}
              </p>
            </div>
            <button type="button"
              onClick={() => {
                if (wizardDismissed || wizardStep === null) {
                  setWizardStep("welcome");
                  setWizardDismissed(false);
                }
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-border hover:bg-muted/40 hidden lg:block">
              Setup guide
            </button>
          </div>

          {/* Theme carousel */}
          <div className="px-4 pt-4 pb-2">
            <ThemeCarousel
              currentTheme={(previewSite.theme ?? "classic") as StudioTheme}
              currentPalette={previewSite.themePalette}
              onChange={handleSaveTheme}
            />
            {savingTheme && (
              <p className="text-[10px] text-muted-foreground text-center mt-1 flex items-center justify-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Updating…
              </p>
            )}
          </div>

          {/* Editor (sections + full controls) */}
          <div className="px-4 pb-6">
            <WebsiteEditor
              token={token}
              initialSite={previewSite}
              origin={origin}
              initialGuests={initialGuests}
              onSectionSaved={handleSaveSection}
              onAppearanceChanged={handleAppearanceChanged}
              focusSection={focusSection}
              hideStatusHeader={false}
            />
          </div>
        </div>

        {/* ── Live preview panel (desktop only + mobile preview tab) ── */}
        <div className={`flex-1 bg-neutral-100 dark:bg-neutral-900 overflow-hidden flex flex-col ${mobileView === "edit" ? "hidden lg:flex" : "flex"}`}>

          {/* Preview toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/80 backdrop-blur shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live Preview</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPreviewDevice("mobile")}
                className={`p-1.5 rounded-lg transition-colors ${previewDevice === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <Smartphone className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => setPreviewDevice("desktop")}
                className={`p-1.5 rounded-lg transition-colors ${previewDevice === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                <Monitor className="h-3.5 w-3.5" />
              </button>
              {previewSite.slug && (
                <a href={`${origin}/w/${previewSite.slug}`} target="_blank" rel="noopener noreferrer"
                  className="ml-1 p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                  <Eye className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Scrollable preview */}
          {previewDevice === "desktop" ? (
            // Desktop: edge-to-edge, browser-chrome feel, no card frame
            <div className="flex-1 overflow-y-auto relative" style={{ background: "#F0EDE8" }}>
              {/* Fake browser chrome */}
              <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5 border-b border-black/10"
                style={{ background: "#E8E4DF" }}>
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full" style={{ background: "#FF5F57" }} />
                  <div className="h-3 w-3 rounded-full" style={{ background: "#FEBC2E" }} />
                  <div className="h-3 w-3 rounded-full" style={{ background: "#28C840" }} />
                </div>
                <div className="flex-1 mx-3 rounded-md px-3 py-1 text-[11px] text-center"
                  style={{ background: "#FAF8F5", color: "#888", fontFamily: "system-ui" }}>
                  {previewSite.slug ? `yourwedding.com/w/${previewSite.slug}` : "yourwedding.com"}
                </div>
              </div>
              {/* Full-width website preview */}
              <div style={{ background: "white" }}>
                <WeddingWebsite
                  site={livePreviewSite}
                  slug={previewSite.slug ?? "preview"}
                  editMode
                  activeSection={activeSection}
                  onSectionClick={handleSectionClick}
                />
              </div>
            </div>
          ) : (
            // Mobile: centered phone frame
            <div className="flex-1 overflow-y-auto py-6 px-3 flex justify-center" style={{ background: "#F0EDE8" }}>
              <div className="w-full max-w-[375px] shrink-0"
                style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderRadius: "40px", overflow: "hidden", border: "8px solid #1A1A1A", background: "white" }}>
                {/* Phone notch */}
                <div className="h-6 flex items-center justify-center" style={{ background: "#1A1A1A" }}>
                  <div className="h-1.5 w-16 rounded-full" style={{ background: "#3A3A3A" }} />
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>
                  <WeddingWebsite
                    site={livePreviewSite}
                    slug={previewSite.slug ?? "preview"}
                    editMode
                    activeSection={activeSection}
                    onSectionClick={handleSectionClick}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Click-to-edit hint */}
          <div className="shrink-0 text-center py-2 text-[10px] text-muted-foreground/60">
            Click any section to edit it
          </div>
        </div>

      </div>
    </>
  );
}

// Types for dynamic requires
type WebsiteEditorProps = {
  token: string;
  initialSite: CoupleWebsite;
  origin: string;
  initialGuests?: { id: string; firstName: string; lastName: string | null; email: string | null; rsvpStatus: string; rsvpSentAt?: string | null }[];
  onSectionSaved?: (key: string, value: object) => void;
  onAppearanceChanged?: (patch: Partial<CoupleWebsite & { fontPairing: string }>) => void;
  focusSection?: string | null;
  hideStatusHeader?: boolean;
};

type WeddingWebsiteProps = {
  site: PublicWebsite;
  slug: string;
  editMode?: boolean;
  activeSection?: string | null;
  onSectionClick?: (key: string) => void;
};
