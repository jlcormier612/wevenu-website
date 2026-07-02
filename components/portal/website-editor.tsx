"use client";

/**
 * WebsiteEditor — Wedding Website Studio.
 *
 * "Choose a beautiful theme. Upload photos. Add your story.
 *  Preview the experience exactly as guests will see it. Fall in love with it. Publish it."
 *
 * Sprint 68: Theme Studio foundation — 8 named themes with distinct visual personalities,
 * studio-first entry, gallery, dress code, bridal party, things to do, music, section ordering.
 */

import * as React from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronUp, Copy, ExternalLink, Image, Loader2, Mail, Palette, Plus, Smartphone, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { ColorPickerTrigger } from "@/components/ui/color-picker";
import type { CoupleWebsite, WebsiteContent, WebsiteTheme, FontPairing, WebsiteSuggestions } from "@/lib/wedding-website/types";

// ── Theme library — 8 collections × 3 palettes ───────────────────────────────

type EditorPalette = { name: string; accent: string; gradient: string; dark?: boolean };

type ThemeCard = {
  value: WebsiteTheme;
  name: string;
  mood: string;
  headingFont: string;
  headingItalic: boolean;
  palettes: EditorPalette[];
};

const THEME_LIBRARY: ThemeCard[] = [
  { value: "classic",   name: "Wildflower",   mood: "Garden romance",        headingFont: "'Playfair Display', Georgia, serif",        headingItalic: false,
    palettes: [
      { name: "Sage",       accent: "#97AC9E", gradient: "linear-gradient(160deg, #6A8A78 0%, #97AC9E 50%, #C8D5C8 100%)" },
      { name: "Mauve",      accent: "#B89AAC", gradient: "linear-gradient(160deg, #8A7080 0%, #B898AC 50%, #DCC8D4 100%)" },
      { name: "Terracotta", accent: "#B49480", gradient: "linear-gradient(160deg, #907060 0%, #B49480 50%, #D4B8A0 100%)" },
    ] },
  { value: "modern",    name: "Midnight",     mood: "Atmospheric indigo",    headingFont: "'DM Sans', system-ui, sans-serif",           headingItalic: false,
    palettes: [
      { name: "Indigo",  accent: "#BFB8CE", gradient: "linear-gradient(160deg, #120F1A 0%, #1E1828 40%, #2E2545 100%)", dark: true },
      { name: "Onyx",    accent: "#C0B8A8", gradient: "linear-gradient(160deg, #0A0A0A 0%, #181818 50%, #252520 100%)", dark: true },
      { name: "Plum",    accent: "#C0A8CC", gradient: "linear-gradient(160deg, #120818 0%, #1E1030 40%, #2E1848 100%)", dark: true },
    ] },
  { value: "garden",    name: "Garden Party", mood: "English countryside",   headingFont: "Georgia, serif",                             headingItalic: false,
    palettes: [
      { name: "Eucalyptus", accent: "#9DC4A8", gradient: "linear-gradient(160deg, #5A8A70 0%, #7AAE8C 50%, #B0CEBC 100%)" },
      { name: "Peony",      accent: "#D4A0AC", gradient: "linear-gradient(160deg, #B07088 0%, #D4A0AC 50%, #EECCD4 100%)" },
      { name: "Wisteria",   accent: "#A898C0", gradient: "linear-gradient(160deg, #685898 0%, #A898C0 50%, #CCC0D8 100%)" },
    ] },
  { value: "minimal",   name: "Linen",        mood: "Letterpress, timeless", headingFont: "Georgia, serif",                             headingItalic: false,
    palettes: [
      { name: "Ivory", accent: "#C8B898", gradient: "linear-gradient(160deg, #D8CFC2 0%, #EBE5DB 100%)" },
      { name: "Blush", accent: "#D4B8B0", gradient: "linear-gradient(160deg, #D8C4C0 0%, #EBD8D5 100%)" },
      { name: "Slate", accent: "#A8B0B8", gradient: "linear-gradient(160deg, #C0C8D0 0%, #D8DCE4 100%)" },
    ] },
  { value: "romance",   name: "Rosé",         mood: "Soft femininity",       headingFont: "'Cormorant Garamond', Georgia, serif",       headingItalic: true,
    palettes: [
      { name: "Blush",  accent: "#CCA8A0", gradient: "linear-gradient(160deg, #A07070 0%, #CCA8A0 50%, #EDD6CE 100%)" },
      { name: "Petal",  accent: "#CCA0B0", gradient: "linear-gradient(160deg, #A07088 0%, #CCA0B0 50%, #EDD0DC 100%)" },
      { name: "Powder", accent: "#A0A8CC", gradient: "linear-gradient(160deg, #707090 0%, #A0A8CC 50%, #D0D4E8 100%)" },
    ] },
  { value: "coastal",   name: "Coastal",      mood: "Nantucket, salt air",   headingFont: "'Plus Jakarta Sans', system-ui, sans-serif", headingItalic: false,
    palettes: [
      { name: "Navy",      accent: "#4A6278", gradient: "linear-gradient(160deg, #324E64 0%, #4A6278 50%, #C8DCE8 100%)" },
      { name: "Sea Glass", accent: "#4A7868", gradient: "linear-gradient(160deg, #2A5848 0%, #4A7868 50%, #A0C8BC 100%)" },
      { name: "Sand",      accent: "#9A8068", gradient: "linear-gradient(160deg, #5A4A38 0%, #9A8068 60%, #C0AE98 100%)" },
    ] },
  { value: "champagne", name: "Champagne",    mood: "Black-tie invitation",  headingFont: "'Playfair Display', Georgia, serif",         headingItalic: false,
    palettes: [
      { name: "Warm Stone", accent: "#C4AE88", gradient: "linear-gradient(160deg, #7A6040 0%, #A08558 60%, #C4AE88 100%)" },
      { name: "Ecru",       accent: "#B4A888", gradient: "linear-gradient(160deg, #6A5A38 0%, #9A8860 60%, #B8A880 100%)" },
      { name: "Charcoal",   accent: "#989890", gradient: "linear-gradient(160deg, #3A3A38 0%, #686860 60%, #989890 100%)" },
    ] },
  { value: "velvet",    name: "Velvet",       mood: "Editorial luxury",      headingFont: "'Cormorant Garamond', Georgia, serif",       headingItalic: false,
    palettes: [
      { name: "Burgundy", accent: "#C9B89A", gradient: "linear-gradient(160deg, #1E1015 0%, #3A1820 60%, #5B3438 100%)", dark: true },
      { name: "Noir",     accent: "#C0B89A", gradient: "linear-gradient(160deg, #0A0A0A 0%, #1A1818 50%, #2A2020 100%)", dark: true },
      { name: "Plum",     accent: "#C0A8CC", gradient: "linear-gradient(160deg, #140A18 0%, #28183A 50%, #3A2048 100%)", dark: true },
    ] },
];

// ── Font pairings ─────────────────────────────────────────────────────────────

const FONT_PAIRINGS: { value: FontPairing; name: string; label: string; sample: string; css: string }[] = [
  { value: "classic_serif",  name: "Classic",   label: "Playfair Display",         sample: "Emily & James", css: "Georgia, serif" },
  { value: "modern_sans",    name: "Modern",    label: "Clean & Contemporary",      sample: "Emily & James", css: "system-ui, sans-serif" },
  { value: "romantic",       name: "Romantic",  label: "Cormorant Garamond",        sample: "Emily & James", css: "Georgia, serif" },
  { value: "editorial",      name: "Editorial", label: "DM Serif Display",          sample: "Emily & James", css: "Georgia, serif" },
];

// ── Accent colors ─────────────────────────────────────────────────────────────

const ACCENT_COLORS = [
  { value: "#8C9E87", label: "Heritage Sage" },
  { value: "#BF9089", label: "Dusty Rose" },
  { value: "#5E7280", label: "Soft Navy" },
  { value: "#B89A6A", label: "Champagne Gold" },
  { value: "#8FA990", label: "Garden Sage" },
  { value: "#9A7060", label: "Terracotta" },
  { value: "#5B3438", label: "Deep Burgundy" },
  { value: "#6A6460", label: "Warm Stone" },
];

// ── Section definitions ───────────────────────────────────────────────────────

type SectionDef = {
  key: string;
  title: string;
  emoji: string;
  description: string;
  preview?: (content: WebsiteContent) => string | null;
};

const ALL_SECTIONS: SectionDef[] = [
  { key: "home",         emoji: "🌿", title: "Home & Welcome",   description: "Your headline, cover photo, and welcome message.", preview: c => c.home?.title || c.home?.welcomeMessage || null },
  { key: "story",        emoji: "💗", title: "Your Story",        description: "How you met — the most personal part of your website.", preview: c => (c as any).story?.text?.slice(0, 60) || null },
  { key: "event",        emoji: "📍", title: "Event Details",     description: "Ceremony and reception times, locations, and addresses.", preview: c => c.event?.ceremony?.location || c.event?.reception?.location || null },
  { key: "gallery",      emoji: "📸", title: "Photo Gallery",     description: "A beautiful grid of your photos, visible to all guests.", preview: c => c.gallery?.photos?.length ? `${c.gallery.photos.length} photo${c.gallery.photos.length === 1 ? "" : "s"}` : null },
  { key: "schedule",     emoji: "📋", title: "Day-of Schedule",   description: "A timeline for your guests.", preview: c => c.schedule?.length ? `${c.schedule.length} schedule items` : null },
  { key: "travel",       emoji: "🏨", title: "Travel & Hotels",   description: "Hotel blocks, transportation notes, and travel info.", preview: c => c.travel?.hotels?.[0]?.name || c.travel?.message?.slice(0, 50) || null },
  { key: "dress_code",   emoji: "👗", title: "Dress Code",        description: "Help guests know what to wear.", preview: c => c.dress_code?.formality ? ({ casual: "Casual", smart_casual: "Smart Casual", cocktail: "Cocktail Attire", black_tie: "Black Tie", custom: "Custom" }[c.dress_code.formality] ?? null) : null },
  { key: "bridal_party", emoji: "💐", title: "Wedding Party",     description: "Introduce the people standing by your side.", preview: c => c.bridal_party?.members?.length ? `${c.bridal_party.members.length} members` : null },
  { key: "things_to_do", emoji: "🗺",  title: "Things To Do",     description: "Local restaurants, hotels, and attractions for your guests.", preview: c => c.things_to_do?.items?.length ? `${c.things_to_do.items.length} recommendations` : null },
  { key: "music",        emoji: "🎵", title: "Music",             description: "Share the songs that will fill your celebration.", preview: c => c.music?.ceremony || c.music?.reception || null },
  { key: "registry",     emoji: "🎁", title: "Registry",          description: "Links to your registries.", preview: c => c.registry?.length ? `${c.registry.length} registr${c.registry.length === 1 ? "y" : "ies"}` : null },
  { key: "faq",          emoji: "❓", title: "FAQ",               description: "Common guest questions and answers.", preview: c => c.faq?.length ? `${c.faq.length} question${c.faq.length === 1 ? "" : "s"}` : null },
];

const DEFAULT_SECTION_ORDER = ALL_SECTIONS.map(s => s.key);

// ── Photo upload helper ───────────────────────────────────────────────────────

function PhotoUpload({ token, type, label, currentUrl, onUploaded }: {
  token: string; type: string; label: string;
  currentUrl?: string; onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("token", token); form.append("file", file); form.append("type", type);
      const res = await fetch("/api/portal/upload", { method: "POST", body: form });
      const data = await res.json() as { ok: boolean; url?: string; error?: string };
      if (data.ok && data.url) { onUploaded(data.url); toast.success(`${label} uploaded!`); }
      else toast.error(data.error ?? "Upload failed.");
    } catch { toast.error("Upload failed. Please try again."); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      {currentUrl && (
        <div className="relative rounded-xl overflow-hidden h-24 bg-muted">
          <img src={currentUrl} alt={label} className="w-full h-full object-cover" />
        </div>
      )}
      <label className="flex items-center gap-2 cursor-pointer px-3 py-2.5 rounded-xl border border-dashed border-border hover:bg-muted/40 transition-colors">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Image className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm text-muted-foreground">{uploading ? "Uploading…" : currentUrl ? "Change photo" : `Upload ${label.toLowerCase()}`}</span>
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={uploading} />
      </label>
    </div>
  );
}

// ── Field helpers ─────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
    </div>
  );
}

function Actions({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onCancel} className="text-sm text-muted-foreground px-3 py-1.5 rounded-xl hover:bg-muted">Cancel</button>
      <button type="button" onClick={onSave} className="text-sm font-medium px-4 py-1.5 rounded-xl bg-[#5D6F5D] text-white hover:opacity-90">Save</button>
    </div>
  );
}

// ── Section editors ───────────────────────────────────────────────────────────

function HomeEditor({ content, onSave, onCancel, token, suggestions }: {
  content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void; token: string;
  suggestions?: WebsiteSuggestions | null;
}) {
  const suggestedTitle    = suggestions?.coupleNames ?? null;
  const suggestedSubtitle = React.useMemo(() => {
    const date = suggestions?.event?.eventDate
      ? new Date(suggestions.event.eventDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null;
    const city = suggestions?.venue?.city ?? null;
    return date && city ? `${date} · ${city}` : date ?? null;
  }, [suggestions]);

  const [title, setTitle] = React.useState(content.home?.title ?? suggestedTitle ?? "");
  const [subtitle, setSubtitle] = React.useState(content.home?.subtitle ?? suggestedSubtitle ?? "");
  const [welcome, setWelcome] = React.useState(content.home?.welcomeMessage ?? "");
  const [coverUrl, setCoverUrl] = React.useState(content.home?.coverImageUrl ?? "");

  const engagementPhotos = suggestions?.engagementPhotos ?? [];
  const hasCoverSuggestions = engagementPhotos.length > 0 && !coverUrl;

  return (
    <div className="space-y-3">

      {/* ── Cover photo suggestion ── */}
      {hasCoverSuggestions && (
        <div className="rounded-xl border border-[#5D6F5D]/30 bg-[#5D6F5D]/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-[#5D6F5D]">
            📸 {engagementPhotos.length} engagement photo{engagementPhotos.length === 1 ? "" : "s"} found — tap one to use as your cover
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {engagementPhotos.slice(0, 6).map((p, i) => (
              <button key={p.id} type="button" onClick={() => setCoverUrl(p.url)}
                className={`shrink-0 h-16 w-16 rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${coverUrl === p.url ? "border-[#5D6F5D]" : "border-transparent"}`}>
                <img src={p.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Pre-filled names notice ── */}
      {!content.home?.title && suggestedTitle && title === suggestedTitle && (
        <div className="flex items-center gap-2 text-[10px] text-[#5D6F5D] bg-[#5D6F5D]/5 rounded-xl px-3 py-2">
          <span>✦</span>
          <span>Headline pre-filled from your profile — customize it below.</span>
        </div>
      )}

      {coverUrl && (
        <div className="relative rounded-xl overflow-hidden h-24 bg-muted group">
          <img src={coverUrl} alt="Cover photo" className="w-full h-full object-cover" />
          <button type="button" onClick={() => setCoverUrl("")}
            className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/60 items-center justify-center text-white hidden group-hover:flex">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      <PhotoUpload token={token} type="cover" label={coverUrl ? "Change cover photo" : "Upload cover photo"} onUploaded={setCoverUrl} />
      <Field label="Page headline" value={title} onChange={setTitle} placeholder="Emily & James" />
      <Field label="Subtitle" value={subtitle} onChange={setSubtitle} placeholder="June 12, 2027 · Nashville, TN" />
      <TextareaField label="Welcome message" value={welcome} onChange={setWelcome} placeholder="We're so excited to celebrate with you!" rows={3} />
      <Actions onSave={() => onSave({ title, subtitle, welcomeMessage: welcome, coverImageUrl: coverUrl || undefined })} onCancel={onCancel} />
    </div>
  );
}

function StoryEditor({ content, onSave, onCancel, suggestions }: {
  content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void;
  suggestions?: WebsiteSuggestions | null;
}) {
  const story = (content as any).story ?? {};
  const [title, setTitle] = React.useState(story.title ?? "How We Met");
  const [text, setText] = React.useState(story.text ?? "");

  const profileStory = suggestions?.story?.text ?? null;
  // Show sync prompt when: profile has a story AND the website hasn't been customized yet
  const showSyncPrompt = !!profileStory && !story.text;

  function useProfileStory() {
    setText(profileStory!);
    toast.success("Story synced from your profile.");
  }

  return (
    <div className="space-y-3">

      {/* ── Sync from Profile prompt ── */}
      {showSyncPrompt && (
        <div className="rounded-xl border border-[#5D6F5D]/30 bg-[#5D6F5D]/5 p-3 space-y-2.5">
          <div className="flex items-start gap-2">
            <span className="text-sm mt-0.5">✦</span>
            <div>
              <p className="text-xs font-semibold text-[#5D6F5D]">Sync from Profile</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">You already wrote your story in your profile. Use it here.</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/60 border border-[#5D6F5D]/20 px-3 py-2.5">
            <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">{profileStory}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={useProfileStory}
              className="flex-1 text-xs font-semibold py-2 rounded-xl text-white transition-opacity hover:opacity-90"
              style={{ background: "#5D6F5D" }}>
              Use this story
            </button>
            <button type="button" onClick={() => setText("")}
              className="text-xs text-muted-foreground py-2 px-3 rounded-xl border border-border hover:bg-muted/40">
              Write my own
            </button>
          </div>
        </div>
      )}

      <Field label="Section title" value={title} onChange={setTitle} placeholder="How We Met" />
      <TextareaField label="Your story" value={text} onChange={setText} placeholder="We met at a coffee shop in Nashville on a rainy Tuesday morning…" rows={5} />

      {/* ── Re-sync prompt when editing a customized story ── */}
      {!showSyncPrompt && profileStory && story.text && story.text !== profileStory && (
        <button type="button" onClick={useProfileStory}
          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1.5">
          <span>↺</span> Reset to profile story
        </button>
      )}

      <Actions onSave={() => onSave({ title, text })} onCancel={onCancel} />
    </div>
  );
}

function EventEditor({ content, onSave, onCancel, suggestions }: {
  content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void;
  suggestions?: WebsiteSuggestions | null;
}) {
  // Derive venue-based suggestion strings
  const suggestedLocation = suggestions?.venue?.name ?? null;
  const suggestedAddress  = React.useMemo(() => {
    const v = suggestions?.venue;
    if (!v) return null;
    return [v.address, v.city, v.state].filter(Boolean).join(", ") || null;
  }, [suggestions]);

  const [cTime, setCTime] = React.useState(content.event?.ceremony?.time ?? "");
  const [cLocation, setCLocation] = React.useState(
    content.event?.ceremony?.location ?? suggestedLocation ?? ""
  );
  const [cAddress, setCAddress] = React.useState(
    content.event?.ceremony?.address ?? suggestedAddress ?? ""
  );
  const [rTime, setRTime] = React.useState(content.event?.reception?.time ?? "");
  const [rLocation, setRLocation] = React.useState(
    content.event?.reception?.location ?? suggestedLocation ?? ""
  );
  const [rAddress, setRAddress] = React.useState(
    content.event?.reception?.address ?? suggestedAddress ?? ""
  );

  // Show the "pre-filled from venue" notice when fields came from suggestions
  const wasPreFilled = !!(
    suggestedLocation && !content.event?.ceremony?.location && cLocation === suggestedLocation
  );

  function applyVenueSuggestion() {
    if (suggestedLocation) { setCLocation(suggestedLocation); setRLocation(suggestedLocation); }
    if (suggestedAddress) { setCAddress(suggestedAddress); setRAddress(suggestedAddress); }
    toast.success("Filled from venue details.");
  }

  return (
    <div className="space-y-4">

      {/* ── Venue pre-fill notice or button ── */}
      {suggestedLocation && (
        wasPreFilled ? (
          <div className="flex items-center gap-2 text-[10px] text-[#5D6F5D] bg-[#5D6F5D]/5 rounded-xl px-3 py-2">
            <span>✦</span>
            <span>Location pre-filled from your venue — customize the times below.</span>
          </div>
        ) : (
          !content.event?.ceremony?.location && (
            <button type="button" onClick={applyVenueSuggestion}
              className="w-full flex items-center justify-between rounded-xl border border-[#5D6F5D]/30 bg-[#5D6F5D]/5 px-3 py-2.5 text-left hover:bg-[#5D6F5D]/10 transition-colors">
              <div>
                <p className="text-xs font-semibold text-[#5D6F5D]">Fill from venue details</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{suggestedLocation}{suggestedAddress ? ` · ${suggestedAddress}` : ""}</p>
              </div>
              <span className="text-[#5D6F5D] text-xs font-medium">Use →</span>
            </button>
          )
        )
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ceremony</p>
        <Field label="Time" value={cTime} onChange={setCTime} placeholder="4:00 PM" />
        <Field label="Location" value={cLocation} onChange={setCLocation} placeholder="The Wildflower Estate" />
        <Field label="Address" value={cAddress} onChange={setCAddress} placeholder="123 Meadow Lane, Nashville, TN" />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Reception</p>
        <Field label="Time" value={rTime} onChange={setRTime} placeholder="6:00 PM" />
        <Field label="Location" value={rLocation} onChange={setRLocation} placeholder="The Wildflower Estate Garden" />
        <Field label="Address" value={rAddress} onChange={setRAddress} placeholder="123 Meadow Lane, Nashville, TN" />
      </div>
      <Actions onSave={() => onSave({ ceremony: { time: cTime, location: cLocation, address: cAddress }, reception: { time: rTime, location: rLocation, address: rAddress } })} onCancel={onCancel} />
    </div>
  );
}

function GalleryEditor({ content, onSave, onCancel, token }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void; token: string }) {
  const [title, setTitle] = React.useState(content.gallery?.title ?? "Our Photos");
  const [photos, setPhotos] = React.useState<string[]>(content.gallery?.photos ?? []);
  const [loadingImport, setLoadingImport] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function importEngagementPhotos() {
    setLoadingImport(true);
    try {
      const res = await fetch(`/api/portal/profile?token=${token}`);
      const data = await res.json() as { engagementPhotos?: { fileUrl: string }[] };
      const newUrls = (data.engagementPhotos ?? []).map(p => p.fileUrl).filter(u => !photos.includes(u));
      if (newUrls.length > 0) { setPhotos(p => [...p, ...newUrls]); toast.success(`${newUrls.length} photo${newUrls.length === 1 ? "" : "s"} imported!`); }
      else toast.info("All engagement photos are already in your gallery.");
    } catch { toast.error("Could not import photos."); }
    finally { setLoadingImport(false); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("token", token); form.append("file", file); form.append("type", "gallery");
      const res = await fetch("/api/portal/upload", { method: "POST", body: form });
      const data = await res.json() as { ok: boolean; url?: string };
      if (data.ok && data.url) setPhotos(p => [...p, data.url!]);
      else toast.error("Upload failed.");
    } catch { toast.error("Upload failed."); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  return (
    <div className="space-y-4">
      <Field label="Gallery title" value={title} onChange={setTitle} placeholder="Our Photos" />

      <div className="flex gap-2">
        <button type="button" onClick={importEngagementPhotos} disabled={loadingImport}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-border hover:bg-muted/40 transition-colors disabled:opacity-50">
          {loadingImport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Image className="h-3.5 w-3.5" />}
          Import engagement photos
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-xl border border-border hover:bg-muted/40 transition-colors disabled:opacity-50">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Upload photo
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((url, i) => (
            <div key={i} className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "1/1" }}>
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">No photos yet. Import from engagement photos or upload new ones.</p>
      )}
      <Actions onSave={() => onSave({ title, photos })} onCancel={onCancel} />
    </div>
  );
}

function ScheduleEditor({ content, onSave, onCancel, token, scheduleSync, onToggleSync }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void; token?: string; scheduleSync?: boolean; onToggleSync?: (v: boolean) => void }) {
  const [items, setItems] = React.useState<{ time: string; title: string; description: string }[]>(
    content.schedule?.map(i => ({ ...i, description: i.description ?? "" })) ?? []
  );
  const [guestTimeline, setGuestTimeline] = React.useState<{ time: string; title: string }[]>([]);
  const [loadingTimeline, setLoadingTimeline] = React.useState(false);

  React.useEffect(() => {
    if (!token || scheduleSync === false) return;
    setLoadingTimeline(true);
    fetch(`/api/portal/website/guest-timeline?token=${token}`)
      .then(r => r.json())
      .then((d: { entries?: { time: string; title: string }[] }) => setGuestTimeline(d.entries ?? []))
      .catch(() => {})
      .finally(() => setLoadingTimeline(false));
  }, [token, scheduleSync]);

  const isSync = scheduleSync !== false;

  return (
    <div className="space-y-4">
      {onToggleSync && (
        <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-heading">
                {isSync ? "☑ Syncing from Event Timeline" : "○ Using custom content"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isSync ? "Timeline entries tagged 🌿 Guests appear here automatically." : "You've overridden with custom schedule items below."}
              </p>
            </div>
            <button type="button" onClick={() => onToggleSync(!isSync)} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline shrink-0">
              {isSync ? "Use custom" : "Sync from timeline"}
            </button>
          </div>
          {isSync && (loadingTimeline ? (
            <p className="text-[10px] text-muted-foreground">Loading timeline entries…</p>
          ) : guestTimeline.length > 0 ? (
            <div className="space-y-1">
              {guestTimeline.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground w-16 shrink-0">{e.time?.slice(0, 5) ?? ""}</span>
                  <span className="text-heading">{e.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">No guest-facing timeline entries yet. Go to the event's Timeline tab and tag entries 🌿 Guests.</p>
          ))}
        </div>
      )}
      {!isSync && (
        <>
          {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-start rounded-xl border border-border bg-muted/20 p-3">
              <div className="flex-1 grid grid-cols-2 gap-2">
                <input value={item.time} onChange={e => setItems(p => p.map((it, j) => j === i ? { ...it, time: e.target.value } : it))} placeholder="4:00 PM" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                <input value={item.title} onChange={e => setItems(p => p.map((it, j) => j === i ? { ...it, title: e.target.value } : it))} placeholder="Ceremony begins" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                <input value={item.description} onChange={e => setItems(p => p.map((it, j) => j === i ? { ...it, description: e.target.value } : it))} placeholder="Description (optional)" className="col-span-2 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
              </div>
              <button type="button" onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <button type="button" onClick={() => setItems(p => [...p, { time: "", title: "", description: "" }])} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <Plus className="h-3.5 w-3.5" /> Add schedule item
          </button>
          <Actions onSave={() => onSave(items.filter(i => i.title.trim()))} onCancel={onCancel} />
        </>
      )}
      {isSync && <div className="flex justify-end"><button type="button" onClick={onCancel} className="text-sm text-muted-foreground px-3 py-1.5 rounded-xl hover:bg-muted">Close</button></div>}
    </div>
  );
}

function TravelEditor({ content, onSave, onCancel }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void }) {
  const [message, setMessage] = React.useState(content.travel?.message ?? "");
  const [hotels, setHotels] = React.useState<{ name: string; url: string; code: string; notes: string }[]>(
    content.travel?.hotels?.map(h => ({ name: h.name, url: h.url ?? "", code: h.code ?? "", notes: h.notes ?? "" })) ?? []
  );
  const [transport, setTransport] = React.useState(content.travel?.transportation?.notes ?? "");
  return (
    <div className="space-y-4">
      <TextareaField label="Travel message" value={message} onChange={setMessage} placeholder="We've reserved a room block at the Marriott. Use code CARTER2027 for 20% off." rows={2} />
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hotel blocks</p>
        {hotels.map((h, i) => (
          <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
            <input value={h.name} onChange={e => setHotels(p => p.map((it, j) => j === i ? { ...it, name: e.target.value } : it))} placeholder="Hotel name *" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <input value={h.code} onChange={e => setHotels(p => p.map((it, j) => j === i ? { ...it, code: e.target.value } : it))} placeholder="Booking code" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
              <input value={h.url} onChange={e => setHotels(p => p.map((it, j) => j === i ? { ...it, url: e.target.value } : it))} placeholder="Booking URL" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div className="flex gap-2">
              <input value={h.notes} onChange={e => setHotels(p => p.map((it, j) => j === i ? { ...it, notes: e.target.value } : it))} placeholder="Notes" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
              <button type="button" onClick={() => setHotels(p => p.filter((_, j) => j !== i))} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setHotels(p => [...p, { name: "", url: "", code: "", notes: "" }])} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Plus className="h-3.5 w-3.5" /> Add hotel block
        </button>
      </div>
      <TextareaField label="Transportation notes" value={transport} onChange={setTransport} placeholder="Shuttle buses will run from the Marriott every 30 minutes starting at 3:30 PM." rows={2} />
      <Actions onSave={() => onSave({ message, hotels: hotels.filter(h => h.name.trim()), transportation: { notes: transport } })} onCancel={onCancel} />
    </div>
  );
}

function DressCodeEditor({ content, onSave, onCancel }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void }) {
  const dc = content.dress_code;
  const [formality, setFormality] = React.useState<string>(dc?.formality ?? "cocktail");
  const [description, setDescription] = React.useState(dc?.description ?? "");
  const [colorNote, setColorNote] = React.useState(dc?.colorNote ?? "");

  const LEVELS = [
    { value: "casual",       label: "Casual",        note: "Comfortable and relaxed" },
    { value: "smart_casual", label: "Smart Casual",  note: "Polished but not formal" },
    { value: "cocktail",     label: "Cocktail",      note: "Elegant party attire" },
    { value: "black_tie",    label: "Black Tie",     note: "Formal evening wear" },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-muted-foreground">Formality</p>
        <div className="grid grid-cols-2 gap-2">
          {LEVELS.map(l => (
            <button key={l.value} type="button" onClick={() => setFormality(l.value)}
              className={`rounded-xl border p-3 text-left transition-colors ${formality === l.value ? "ring-2 ring-ring ring-offset-1 border-ring" : "border-border"}`}>
              <p className="text-sm font-medium text-heading">{l.label}</p>
              <p className="text-[10px] text-muted-foreground">{l.note}</p>
            </button>
          ))}
        </div>
      </div>
      <TextareaField label="Description (optional)" value={description} onChange={setDescription} placeholder="We'd love for guests to dress in cocktail attire. Think elegant evening wear — the venue is beautiful and we want you to feel wonderful." rows={3} />
      <Field label="Color note (optional)" value={colorNote} onChange={setColorNote} placeholder="Feel free to wear blush, dusty rose, or sage green!" />
      <Actions onSave={() => onSave({ formality, description, colorNote })} onCancel={onCancel} />
    </div>
  );
}

function BridalPartyEditor({ content, onSave, onCancel, token }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void; token: string }) {
  const bp = content.bridal_party;
  const [title, setTitle] = React.useState(bp?.title ?? "Our Wedding Party");
  const [members, setMembers] = React.useState<{ name: string; role: string; note: string; photoUrl: string }[]>(
    bp?.members?.map(m => ({ name: m.name, role: m.role, note: m.note ?? "", photoUrl: m.photoUrl ?? "" })) ?? []
  );

  function add() { setMembers(p => [...p, { name: "", role: "", note: "", photoUrl: "" }]); }
  function remove(i: number) { setMembers(p => p.filter((_, j) => j !== i)); }
  function set(i: number, k: string, v: string) { setMembers(p => p.map((m, j) => j === i ? { ...m, [k]: v } : m)); }

  const COMMON_ROLES = ["Maid of Honor", "Best Man", "Bridesmaid", "Groomsman", "Flower Girl", "Ring Bearer", "Mother of the Bride", "Father of the Bride", "Officiant"];

  return (
    <div className="space-y-4">
      <Field label="Section title" value={title} onChange={setTitle} placeholder="Our Wedding Party" />
      <div className="space-y-3">
        {members.map((m, i) => (
          <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <input value={m.name} onChange={e => set(i, "name", e.target.value)} placeholder="Name *" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                <select value={m.role} onChange={e => set(i, "role", e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none text-muted-foreground">
                  <option value="">Role *</option>
                  {COMMON_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  <option value="custom">Other…</option>
                </select>
                {m.role === "custom" && (
                  <input value={m.role} onChange={e => set(i, "role", e.target.value)} placeholder="Custom role" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                )}
                <input value={m.note} onChange={e => set(i, "note", e.target.value)} placeholder="Fun fact or how you met (optional)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
              </div>
              <button type="button" onClick={() => remove(i)} className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive mt-0.5"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        <button type="button" onClick={add} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Plus className="h-3.5 w-3.5" /> Add person
        </button>
      </div>
      <Actions onSave={() => onSave({ title, members: members.filter(m => m.name.trim()) })} onCancel={onCancel} />
    </div>
  );
}

function ThingsToDoEditor({ content, onSave, onCancel }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void }) {
  const ttd = content.things_to_do;
  const [title, setTitle] = React.useState(ttd?.title ?? "Things To Do");
  const [intro, setIntro] = React.useState(ttd?.intro ?? "");
  const [items, setItems] = React.useState<{ name: string; category: string; description: string; address: string; url: string }[]>(
    ttd?.items?.map(it => ({ name: it.name, category: it.category, description: it.description ?? "", address: it.address ?? "", url: it.url ?? "" })) ?? []
  );

  const CATEGORIES = [
    { value: "restaurant", label: "🍽 Restaurant" },
    { value: "cafe",       label: "☕ Café" },
    { value: "attraction", label: "🗺 Attraction" },
    { value: "hotel",      label: "🏨 Hotel" },
    { value: "shopping",   label: "🛍 Shopping" },
    { value: "other",      label: "✦ Other" },
  ];

  function add() { setItems(p => [...p, { name: "", category: "restaurant", description: "", address: "", url: "" }]); }
  function remove(i: number) { setItems(p => p.filter((_, j) => j !== i)); }
  function set(i: number, k: string, v: string) { setItems(p => p.map((it, j) => j === i ? { ...it, [k]: v } : it)); }

  return (
    <div className="space-y-4">
      <Field label="Section title" value={title} onChange={setTitle} placeholder="Things To Do" />
      <TextareaField label="Intro message (optional)" value={intro} onChange={setIntro} placeholder="Nashville has so much to offer! Here are a few of our favorite spots near the venue." rows={2} />
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <input value={item.name} onChange={e => set(i, "name", e.target.value)} placeholder="Name *" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                  <select value={item.category} onChange={e => set(i, "category", e.target.value)} className="w-36 rounded-lg border border-border bg-background px-2 py-2 text-sm focus:outline-none">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <input value={item.description} onChange={e => set(i, "description", e.target.value)} placeholder="Description (optional)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={item.address} onChange={e => set(i, "address", e.target.value)} placeholder="Address" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                  <input value={item.url} onChange={e => set(i, "url", e.target.value)} placeholder="Website URL" className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
                </div>
              </div>
              <button type="button" onClick={() => remove(i)} className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive mt-0.5"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        ))}
        <button type="button" onClick={add} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <Plus className="h-3.5 w-3.5" /> Add recommendation
        </button>
      </div>
      <Actions onSave={() => onSave({ title, intro, items: items.filter(it => it.name.trim()) })} onCancel={onCancel} />
    </div>
  );
}

function MusicEditor({ content, onSave, onCancel }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void }) {
  const m = content.music;
  const [title, setTitle] = React.useState(m?.title ?? "Our Music");
  const [ceremony, setCeremony] = React.useState(m?.ceremony ?? "");
  const [cocktail, setCocktail] = React.useState(m?.cocktail ?? "");
  const [reception, setReception] = React.useState(m?.reception ?? "");
  const [lastDance, setLastDance] = React.useState(m?.lastDance ?? "");
  const [doNotPlay, setDoNotPlay] = React.useState(m?.doNotPlay ?? "");
  return (
    <div className="space-y-3">
      <Field label="Section title" value={title} onChange={setTitle} placeholder="Our Music" />
      <Field label="🎵 Ceremony song" value={ceremony} onChange={setCeremony} placeholder="Canon in D — Pachelbel" />
      <Field label="🥂 Cocktail hour vibe" value={cocktail} onChange={setCocktail} placeholder="Acoustic jazz, soft indie" />
      <Field label="🎉 First dance song" value={reception} onChange={setReception} placeholder="Can't Help Falling in Love — Elvis" />
      <Field label="🌟 Last dance song" value={lastDance} onChange={setLastDance} placeholder="September — Earth, Wind & Fire" />
      <Field label="🚫 Please don't play" value={doNotPlay} onChange={setDoNotPlay} placeholder="Any song by that one ex (you know who)" />
      <Actions onSave={() => onSave({ title, ceremony, cocktail, reception, lastDance, doNotPlay })} onCancel={onCancel} />
    </div>
  );
}

function RegistryEditor({ content, onSave, onCancel }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void }) {
  const [items, setItems] = React.useState<{ name: string; url: string; notes: string }[]>(
    content.registry?.map(r => ({ name: r.name, url: r.url, notes: r.notes ?? "" })) ?? []
  );
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start rounded-xl border border-border bg-muted/20 p-3">
          <div className="flex-1 space-y-2">
            <input value={item.name} onChange={e => setItems(p => p.map((r, j) => j === i ? { ...r, name: e.target.value } : r))} placeholder="Registry name (e.g., Crate & Barrel)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
            <input value={item.url} onChange={e => setItems(p => p.map((r, j) => j === i ? { ...r, url: e.target.value } : r))} placeholder="URL" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
          </div>
          <button type="button" onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <button type="button" onClick={() => setItems(p => [...p, { name: "", url: "", notes: "" }])} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <Plus className="h-3.5 w-3.5" /> Add registry
      </button>
      <Actions onSave={() => onSave(items.filter(i => i.name.trim() && i.url.trim()))} onCancel={onCancel} />
    </div>
  );
}

function FaqEditor({ content, onSave, onCancel }: { content: WebsiteContent; onSave: (v: object) => void; onCancel: () => void }) {
  const [items, setItems] = React.useState<{ question: string; answer: string }[]>(content.faq ?? []);
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <input value={item.question} onChange={e => setItems(p => p.map((it, j) => j === i ? { ...it, question: e.target.value } : it))} placeholder="Question" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
              <textarea value={item.answer} onChange={e => setItems(p => p.map((it, j) => j === i ? { ...it, answer: e.target.value } : it))} placeholder="Answer" rows={2} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none resize-none" />
            </div>
            <button type="button" onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="shrink-0 p-1.5 text-muted-foreground hover:text-destructive mt-0.5"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setItems(p => [...p, { question: "", answer: "" }])} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <Plus className="h-3.5 w-3.5" /> Add FAQ
      </button>
      <Actions onSave={() => onSave(items.filter(i => i.question.trim()))} onCancel={onCancel} />
    </div>
  );
}

// ── Section accordion ─────────────────────────────────────────────────────────

function SectionAccordion({
  section, content, onSaveSection, saving, token, scheduleSync, onToggleSync,
  onMoveUp, onMoveDown, isFirst, isLast, suggestions, forceOpen,
}: {
  section: SectionDef;
  content: WebsiteContent;
  onSaveSection: (key: string, value: object) => Promise<void>;
  saving: string | null;
  token: string;
  scheduleSync?: boolean;
  onToggleSync?: (v: boolean) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  suggestions?: WebsiteSuggestions | null;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const accordionRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (forceOpen && !open) {
      setOpen(true);
      setTimeout(() => accordionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceOpen]);
  const previewText = section.preview?.(content);
  const hasContent = !!previewText;

  // Show a "✦ Ready to sync" hint when suggestions are available and section is empty
  const hasSuggestion =
    !hasContent && (
      (section.key === "story"  && !!suggestions?.story?.text) ||
      (section.key === "home"   && (!!suggestions?.coupleNames || (suggestions?.engagementPhotos?.length ?? 0) > 0)) ||
      (section.key === "event"  && !!suggestions?.venue?.name)
    );

  function EditorFor() {
    const props = {
      content,
      onSave: async (v: object) => { await onSaveSection(section.key, v); setOpen(false); },
      onCancel: () => setOpen(false),
    };
    switch (section.key) {
      case "home":         return <HomeEditor {...props} token={token} suggestions={suggestions} />;
      case "story":        return <StoryEditor {...props} suggestions={suggestions} />;
      case "event":        return <EventEditor {...props} suggestions={suggestions} />;
      case "gallery":      return <GalleryEditor {...props} token={token} />;
      case "schedule":     return <ScheduleEditor {...props} token={token} scheduleSync={scheduleSync} onToggleSync={onToggleSync} />;
      case "travel":       return <TravelEditor {...props} />;
      case "dress_code":   return <DressCodeEditor {...props} />;
      case "bridal_party": return <BridalPartyEditor {...props} token={token} />;
      case "things_to_do": return <ThingsToDoEditor {...props} />;
      case "music":        return <MusicEditor {...props} />;
      case "registry":     return <RegistryEditor {...props} />;
      case "faq":          return <FaqEditor {...props} />;
      default:             return null;
    }
  }

  return (
    <div ref={accordionRef} className={`rounded-2xl border transition-colors ${open ? "border-ring bg-card" : "border-border bg-card"}`}>
      <div className="flex items-center">
        {/* Order controls */}
        <div className="flex flex-col pl-2 py-1 gap-0.5 shrink-0">
          <button type="button" onClick={onMoveUp} disabled={isFirst}
            className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
            <ArrowUp className="h-3 w-3" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={isLast}
            className="p-0.5 text-muted-foreground/40 hover:text-muted-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>

        {/* Main accordion button */}
        <button type="button" onClick={() => setOpen(o => !o)}
          className="flex-1 flex items-center gap-3 px-3 py-3.5 text-left min-w-0">
          <span className="text-lg shrink-0">{section.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-heading">{section.title}</p>
              {hasContent ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">✓ Added</span>
              ) : hasSuggestion ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "#5D6F5D18", color: "#5D6F5D" }}>✦ Ready to sync</span>
              ) : (
                <span className="text-[10px] text-muted-foreground">Tap to add</span>
              )}
              {saving === section.key && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {hasContent && !open && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">{previewText}</p>
            )}
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 border-t border-border/50 pt-4">
          <p className="text-xs text-muted-foreground mb-3">{section.description}</p>
          <EditorFor />
        </div>
      )}
    </div>
  );
}

// ── Completion meter ──────────────────────────────────────────────────────────

function CompletionMeter({ completed, total, syncableSections }: {
  completed: number; total: number; syncableSections: number;
}) {
  const pct = Math.round((completed / total) * 100);

  const { emoji, headline, sub } = React.useMemo(() => {
    if (completed === 0 && syncableSections > 0)
      return { emoji: "✨", headline: "Your website is already taking shape", sub: `We found ${syncableSections} section${syncableSections === 1 ? "" : "s"} ready to sync from your profile.` };
    if (completed === 0)
      return { emoji: "🌿", headline: "Start building your website", sub: "Choose a theme and start adding your story." };
    if (pct < 30)
      return { emoji: "✨", headline: "Off to a beautiful start", sub: `${completed} of ${total} sections added.` };
    if (pct < 60)
      return { emoji: "💗", headline: `Your website is ${pct}% ready`, sub: `${total - completed} section${total - completed === 1 ? "" : "s"} left to add.` };
    if (pct < 85)
      return { emoji: "🌿", headline: "Looking beautiful", sub: `Almost there — ${total - completed} more section${total - completed === 1 ? "" : "s"} to go.` };
    if (completed < total)
      return { emoji: "✦", headline: "Nearly perfect", sub: `Just ${total - completed} section${total - completed === 1 ? "" : "s"} left. You've got this.` };
    return { emoji: "🎉", headline: "Your website is complete!", sub: "Every section is filled. Ready to share with guests." };
  }, [completed, total, pct, syncableSections]);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="text-lg mt-0.5">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-heading">{headline}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        </div>
        {completed > 0 && (
          <span className="shrink-0 text-xs font-semibold tabular-nums" style={{ color: "#5D6F5D" }}>
            {completed}/{total}
          </span>
        )}
      </div>
      {completed > 0 && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct === 100 ? "#5D6F5D" : "linear-gradient(90deg, #5D6F5D, #D8A7AA)" }}
          />
        </div>
      )}
    </div>
  );
}

// ── Theme Studio — replaces the old Appearance accordion ─────────────────────

function ThemeStudio({
  site, onUpdate,
}: {
  site: CoupleWebsite;
  onUpdate: (patch: Partial<CoupleWebsite & { fontPairing: string }>) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const currentCollection = THEME_LIBRARY.find(t => t.value === (site.theme ?? "classic")) ?? THEME_LIBRARY[0];
  const currentPaletteName = site.themePalette ?? currentCollection.palettes[0].name;
  const currentPalette = currentCollection.palettes.find(p => p.name === currentPaletteName) ?? currentCollection.palettes[0];

  return (
    <div className={`rounded-2xl border transition-colors overflow-hidden ${open ? "border-ring bg-card" : "border-border bg-card"}`}>

      {/* Current theme preview — always visible, acts as the opener */}
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 p-4 text-left group">

        {/* Mini theme card */}
        <div className="h-14 w-20 rounded-xl shrink-0 overflow-hidden relative"
          style={{ background: currentPalette.gradient }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
            <p className="text-[8px] font-semibold text-white leading-tight"
              style={{ fontFamily: currentCollection.headingFont, fontStyle: currentCollection.headingItalic ? "italic" : "normal" }}>
              Emily & James
            </p>
            <p className="text-[6px] text-white/60 mt-0.5">June 2027</p>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-sm font-semibold text-heading">{currentCollection.name}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{currentPaletteName}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{currentCollection.mood}</p>
        </div>

        <p className="text-xs font-medium shrink-0" style={{ color: "#5D6F5D" }}>
          {open ? "Close" : "Change →"}
        </p>
      </button>

      {/* Full theme picker — opens below */}
      {open && (
        <div className="border-t border-border/50 p-4 space-y-6">

          {/* Collection grid */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">Choose your aesthetic</p>
            <div className="grid grid-cols-2 gap-3">
              {THEME_LIBRARY.map(theme => {
                const isSelected = (site.theme ?? "classic") === theme.value;
                const previewPalette = theme.palettes[0];
                return (
                  <button key={theme.value} type="button"
                    onClick={() => onUpdate({ theme: theme.value, themePalette: theme.palettes[0].name })}
                    className={`relative rounded-2xl overflow-hidden text-left transition-all hover:scale-[1.01] ${isSelected ? "ring-2 ring-offset-2 ring-ring" : ""}`}>

                    {/* Visual hero preview */}
                    <div className="h-20 relative" style={{ background: previewPalette.gradient }}>
                      <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
                        <p className="text-[9px] uppercase tracking-[0.2em] mb-0.5"
                          style={{ color: previewPalette.dark ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.65)" }}>
                          {theme.mood}
                        </p>
                        <p className="text-sm font-semibold text-white leading-tight"
                          style={{ fontFamily: theme.headingFont, fontStyle: theme.headingItalic ? "italic" : "normal" }}>
                          Emily & James
                        </p>
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-white/90 flex items-center justify-center shadow">
                          <Check className="h-3 w-3" style={{ color: previewPalette.accent }} />
                        </div>
                      )}
                    </div>

                    {/* Label + palette dots */}
                    <div className="px-3 py-2 bg-card flex items-center justify-between">
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
          </div>

          {/* Palette selector — for selected collection */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {currentCollection.name} palette
            </p>
            <div className="flex gap-3">
              {currentCollection.palettes.map(p => {
                const isActive = p.name === currentPaletteName;
                return (
                  <button key={p.name} type="button"
                    onClick={() => onUpdate({ themePalette: p.name })}
                    className="flex flex-col items-center gap-1.5">
                    <div className={`rounded-full border-2 transition-all ${isActive ? "h-10 w-10 border-foreground shadow-md" : "h-8 w-8 border-transparent hover:border-border"}`}
                      style={{ background: p.gradient }} />
                    <p className={`text-[10px] ${isActive ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {p.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent color override */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Custom accent</p>
            <ColorPickerTrigger
              value={site.accentColor ?? "#BF9089"}
              onChange={(v) => onUpdate({ accentColor: v })}
            />
          </div>

          {/* Font pairing */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Typography</p>
            <div className="grid grid-cols-2 gap-2">
              {FONT_PAIRINGS.map(f => {
                const isSelected = (site.fontPairing ?? "classic_serif") === f.value;
                return (
                  <button key={f.value} type="button" onClick={() => onUpdate({ fontPairing: f.value })}
                    className={`rounded-xl border p-3 text-left transition-all ${isSelected ? "ring-2 ring-ring ring-offset-1 border-ring" : "border-border"}`}>
                    <p className="text-[13px]" style={{ fontFamily: f.css }}>{f.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{f.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

export function WebsiteEditor({
  token, initialSite, origin, initialGuests,
  onSectionSaved, onAppearanceChanged, focusSection, hideStatusHeader,
}: {
  token: string;
  initialSite: CoupleWebsite;
  origin: string;
  initialGuests?: { id: string; firstName: string; lastName: string | null; email: string | null; rsvpStatus: string; rsvpSentAt?: string | null }[];
  // Studio mode hooks — used by WebsiteStudio to keep preview in sync
  onSectionSaved?: (key: string, value: object) => void;
  onAppearanceChanged?: (patch: Partial<CoupleWebsite & { fontPairing: string }>) => void;
  focusSection?: string | null;
  hideStatusHeader?: boolean;
}) {
  const [site, setSite] = React.useState(initialSite);
  const [content, setContent] = React.useState<WebsiteContent>(initialSite.content ?? {});
  const [saving, setSaving] = React.useState<string | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [previewMode, setPreviewMode] = React.useState<"desktop" | "mobile">("mobile");
  const [showPreview, setShowPreview] = React.useState(false);
  const [showQR, setShowQR] = React.useState(false);
  const [scheduleSync, setScheduleSync] = React.useState(
    (initialSite as CoupleWebsite & { scheduleSync?: boolean }).scheduleSync !== false
  );
  const [showInvite, setShowInvite] = React.useState(false);
  const [selectedGuests, setSelectedGuests] = React.useState<string[]>([]);
  const [sendingInvites, setSendingInvites] = React.useState(false);
  const [views, setViews] = React.useState<{ totalViews: number; weekViews: number } | null>(null);

  // Pre-population suggestions — fetched once on mount
  const [suggestions, setSuggestions] = React.useState<WebsiteSuggestions | null>(null);
  const [welcomeDismissed, setWelcomeDismissed] = React.useState(false);

  // Section order state — initialize from site or use default
  const [sectionOrder, setSectionOrder] = React.useState<string[]>(
    initialSite.sectionOrder?.length ? initialSite.sectionOrder : DEFAULT_SECTION_ORDER
  );

  const guests = initialGuests ?? [];
  const websiteUrl = site.slug ? `${origin}/w/${site.slug}` : null;
  const completedSections = ALL_SECTIONS.filter(s => s.preview?.(content)).length;

  React.useEffect(() => {
    fetch(`/api/portal/website/suggestions?token=${token}`)
      .then(r => r.json())
      .then((d: WebsiteSuggestions | null) => setSuggestions(d))
      .catch(() => {});
  }, [token]);

  React.useEffect(() => {
    if (!site.isPublished) return;
    fetch(`/api/portal/website/analytics?token=${token}`)
      .then(r => r.json())
      .then((d: { totalViews?: number; weekViews?: number }) => {
        if (d.totalViews !== undefined) setViews({ totalViews: d.totalViews, weekViews: d.weekViews ?? 0 });
      })
      .catch(() => {});
  }, [token, site.isPublished]);

  // How many sections have ready-to-sync suggestions
  const syncableSections = suggestions
    ? [
        suggestions.story?.text               && "story",
        (suggestions.coupleNames || (suggestions.engagementPhotos?.length ?? 0) > 0) && "home",
        suggestions.venue?.name               && "event",
      ].filter(Boolean).length
    : 0;

  async function saveSection(key: string, value: object) {
    setSaving(key);
    try {
      const res = await fetch("/api/portal/website", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, contentKey: key, contentValue: value }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) {
        setContent(c => ({ ...c, [key]: value }));
        onSectionSaved?.(key, value);
        toast.success(`${ALL_SECTIONS.find(s => s.key === key)?.title ?? "Section"} saved.`);
      } else toast.error("Could not save. Please try again.");
    } finally { setSaving(null); }
  }

  async function saveSectionOrder(order: string[]) {
    setSectionOrder(order);
    await fetch("/api/portal/website", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, sectionOrder: order }),
    });
  }

  function moveSection(key: string, dir: "up" | "down") {
    const idx = sectionOrder.indexOf(key);
    if (idx < 0) return;
    const next = [...sectionOrder];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    saveSectionOrder(next);
  }

  async function updateAppearance(patch: Partial<CoupleWebsite & { fontPairing: string }>) {
    setSaving("appearance");
    try {
      const res = await fetch("/api/portal/website", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, ...patch }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) {
        setSite(s => ({ ...s, ...patch }));
        onAppearanceChanged?.(patch);
        toast.success("Design updated.");
      }
    } finally { setSaving(null); }
  }

  async function togglePublish() {
    setPublishing(true);
    const next = !site.isPublished;
    try {
      const res = await fetch("/api/portal/website", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, isPublished: next }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) {
        setSite(s => ({ ...s, isPublished: next }));
        toast.success(next ? "🎉 Your website is live!" : "Website set to draft.");
      }
    } finally { setPublishing(false); }
  }

  // Ordered sections for rendering
  const orderedSections = React.useMemo(() => {
    return sectionOrder
      .map(key => ALL_SECTIONS.find(s => s.key === key))
      .filter((s): s is SectionDef => s != null);
  }, [sectionOrder]);

  return (
    <div className="space-y-4">

      {/* ── Status header ── */}
      {!hideStatusHeader && <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        {site.isPublished ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎉</span>
              <div>
                <p className="text-sm font-semibold text-heading">Your wedding website is live!</p>
                <p className="text-xs text-muted-foreground">Share the link with your guests.</p>
              </div>
            </div>
            {websiteUrl && (
              <div className="flex gap-2">
                <div className="flex-1 bg-muted/40 rounded-xl px-3 py-2 text-[11px] font-mono text-muted-foreground truncate">{websiteUrl}</div>
                <button type="button" onClick={() => { navigator.clipboard.writeText(websiteUrl); toast.success("Link copied!"); }}
                  className="shrink-0 px-3 py-1.5 rounded-xl border border-border text-xs hover:bg-muted transition-colors">Copy</button>
                <a href={websiteUrl} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 px-3 py-1.5 rounded-xl border border-border text-xs hover:bg-muted transition-colors flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        ) : (
          <CompletionMeter
            completed={completedSections}
            total={ALL_SECTIONS.length}
            syncableSections={syncableSections}
          />
        )}
        <button type="button" onClick={togglePublish} disabled={publishing}
          className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${site.isPublished ? "border border-border text-muted-foreground hover:bg-muted/40" : "text-white"}`}
          style={!site.isPublished ? { background: "#5D6F5D" } : {}}>
          {publishing ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
            : site.isPublished ? "Unpublish website" : "🚀 Publish website"}
        </button>
      </div>}

      {/* ── "Already here" welcome banner ── */}
      {/* Shown on first open when the platform already knows things about the couple */}
      {!welcomeDismissed && completedSections === 0 && syncableSections > 0 && (
        <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: "#5D6F5D40", background: "linear-gradient(135deg, #5D6F5D08 0%, #D8A7AA08 100%)" }}>
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">💗</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-heading">Your website is already taking shape.</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                We found your story, venue details
                {(suggestions?.engagementPhotos?.length ?? 0) > 0 ? `, and ${suggestions!.engagementPhotos!.length} engagement photo${suggestions!.engagementPhotos!.length === 1 ? "" : "s"}` : ""}
                {" "}already in Wevenu. Open any section marked{" "}
                <span className="font-semibold" style={{ color: "#5D6F5D" }}>✦ Ready to sync</span>{" "}
                below to bring it in.
              </p>
            </div>
            <button type="button" onClick={() => setWelcomeDismissed(true)}
              className="shrink-0 p-1 text-muted-foreground/40 hover:text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick preview of what's available */}
          <div className="flex gap-2 flex-wrap">
            {suggestions?.story?.text && (
              <div className="flex items-center gap-1.5 rounded-xl bg-white/60 border border-[#5D6F5D]/20 px-2.5 py-1.5">
                <span className="text-xs">💗</span>
                <span className="text-[11px] font-medium text-heading">Your Story</span>
              </div>
            )}
            {suggestions?.venue?.name && (
              <div className="flex items-center gap-1.5 rounded-xl bg-white/60 border border-[#5D6F5D]/20 px-2.5 py-1.5">
                <span className="text-xs">📍</span>
                <span className="text-[11px] font-medium text-heading">{suggestions.venue.name}</span>
              </div>
            )}
            {(suggestions?.engagementPhotos?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl bg-white/60 border border-[#5D6F5D]/20 px-2.5 py-1.5">
                <span className="text-xs">📸</span>
                <span className="text-[11px] font-medium text-heading">{suggestions!.engagementPhotos!.length} photos</span>
              </div>
            )}
            {suggestions?.coupleNames && (
              <div className="flex items-center gap-1.5 rounded-xl bg-white/60 border border-[#5D6F5D]/20 px-2.5 py-1.5">
                <span className="text-xs">✨</span>
                <span className="text-[11px] font-medium text-heading">{suggestions.coupleNames}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Analytics ── */}
      {!hideStatusHeader && site.isPublished && views !== null && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-4">
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-heading">{views.totalViews}</p>
              <p className="text-[10px] text-muted-foreground">Total visits</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-heading">{views.weekViews}</p>
              <p className="text-[10px] text-muted-foreground">This week</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-heading">{completedSections}</p>
              <p className="text-[10px] text-muted-foreground">Sections</p>
            </div>
          </div>
          {views.totalViews > 0 && (
            <p className="text-center text-xs mt-3" style={{ color: "#5D6F5D" }}>
              ✨ {views.totalViews === 1 ? "1 guest has visited your website." : `${views.totalViews} guests have visited your website.`}
            </p>
          )}
        </div>
      )}

      {/* ── Share & Preview ── */}
      {!hideStatusHeader && websiteUrl && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Share your website</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { navigator.clipboard.writeText(websiteUrl); toast.success("Link copied!"); }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-medium hover:bg-muted/40 transition-colors">
              <Copy className="h-3.5 w-3.5" /> Copy link
            </button>
            <a href={`mailto:?subject=Our Wedding Website&body=Join us for our wedding! ${websiteUrl}`}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-medium hover:bg-muted/40 transition-colors">
              <Mail className="h-3.5 w-3.5" /> Share via email
            </a>
            <button type="button" onClick={() => { navigator.clipboard.writeText(`${websiteUrl}#rsvp`); toast.success("RSVP link copied!"); }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-xs font-medium hover:bg-muted/40 transition-colors">
              💗 Copy RSVP link
            </button>
            <button type="button" onClick={() => setShowPreview(!showPreview)}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-colors ${showPreview ? "bg-[#5D6F5D] text-white border-[#5D6F5D]" : "border-border hover:bg-muted/40"}`}>
              <Smartphone className="h-3.5 w-3.5" /> {showPreview ? "Hide" : "Preview"}
            </button>
            <button type="button" onClick={() => setShowQR(!showQR)}
              className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-colors ${showQR ? "bg-[#5D6F5D] text-white border-[#5D6F5D]" : "border-border hover:bg-muted/40"}`}>
              ▦ QR Code
            </button>
          </div>

          {showQR && websiteUrl && (
            <div className="space-y-2 text-center">
              <img src={`/api/portal/website/qr?url=${encodeURIComponent(websiteUrl)}`}
                alt="Website QR code" className="h-40 w-40 mx-auto rounded-xl border border-border" />
              <p className="text-xs text-muted-foreground">Share on save-the-dates, invitations, and signage.</p>
              <a href={`/api/portal/website/qr?url=${encodeURIComponent(websiteUrl)}`} download="wedding-qr.svg"
                className="inline-block text-xs font-medium px-4 py-2 rounded-xl border border-border hover:bg-muted/40 transition-colors">
                Download QR Code
              </a>
            </div>
          )}

          {guests.filter(g => g.email).length > 0 && (
            <div className="space-y-3">
              <button type="button" onClick={() => setShowInvite(!showInvite)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${showInvite ? "bg-[#5D6F5D] text-white border-[#5D6F5D]" : "border-border hover:bg-muted/40"}`}>
                <span>💌 Send Invitations</span>
                <span className="text-xs opacity-70">{guests.filter(g => g.email && !g.rsvpSentAt).length} guests not yet invited</span>
              </button>
              {showInvite && (
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select guests to invite</p>
                    <button type="button" onClick={() => setSelectedGuests(
                      selectedGuests.length === guests.filter(g => g.email).length ? [] : guests.filter(g => g.email).map(g => g.id)
                    )} className="text-xs text-muted-foreground hover:text-foreground">
                      {selectedGuests.length === guests.filter(g => g.email).length ? "Deselect all" : "Select all"}
                    </button>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {guests.filter(g => g.email).map(g => (
                      <label key={g.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                        <input type="checkbox" checked={selectedGuests.includes(g.id)}
                          onChange={e => setSelectedGuests(prev => e.target.checked ? [...prev, g.id] : prev.filter(id => id !== g.id))}
                          className="rounded" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-heading truncate">{[g.firstName, g.lastName].filter(Boolean).join(" ")}</p>
                          <p className="text-xs text-muted-foreground truncate">{g.email}</p>
                        </div>
                        {g.rsvpSentAt && <span className="text-[10px] text-muted-foreground">Sent</span>}
                        {g.rsvpStatus === "attending" && <span className="text-[10px] text-green-600">✓ Attending</span>}
                      </label>
                    ))}
                  </div>
                  <button type="button" disabled={selectedGuests.length === 0 || sendingInvites}
                    onClick={async () => {
                      setSendingInvites(true);
                      try {
                        const res = await fetch("/api/portal/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, guestIds: selectedGuests }) });
                        const data = await res.json() as { ok: boolean; sent?: number };
                        if (data.ok) { toast.success(`${data.sent} invitation${data.sent !== 1 ? "s" : ""} sent!`); setShowInvite(false); setSelectedGuests([]); }
                        else toast.error("Some invitations failed.");
                      } finally { setSendingInvites(false); }
                    }}
                    className="w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "#5D6F5D" }}>
                    {sendingInvites ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : `Send ${selectedGuests.length > 0 ? selectedGuests.length + " " : ""}Invitation${selectedGuests.length !== 1 ? "s" : ""}`}
                  </button>
                </div>
              )}
            </div>
          )}

          {showPreview && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                  <button type="button" onClick={() => setPreviewMode("mobile")}
                    className={`px-2.5 py-1 transition-colors ${previewMode === "mobile" ? "bg-[#5D6F5D] text-white" : "text-muted-foreground"}`}>📱</button>
                  <button type="button" onClick={() => setPreviewMode("desktop")}
                    className={`px-2.5 py-1 transition-colors ${previewMode === "desktop" ? "bg-[#5D6F5D] text-white" : "text-muted-foreground"}`}>🖥</button>
                </div>
                <a href={websiteUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Open full site
                </a>
              </div>
              <div className={`rounded-2xl overflow-hidden border border-border bg-muted/10 mx-auto transition-all ${previewMode === "mobile" ? "max-w-[320px]" : "w-full"}`}
                style={{ height: previewMode === "mobile" ? "560px" : "400px" }}>
                <iframe src={websiteUrl} className="w-full h-full border-0 rounded-2xl" title="Website preview"
                  style={previewMode === "desktop" ? { transform: "scale(0.7)", transformOrigin: "top left", width: "143%", height: "143%" } : {}} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Theme Studio ── */}
      <ThemeStudio site={site} onUpdate={updateAppearance} />

      {/* ── Section editors ── */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground px-1 pb-1">
          Your sections <span className="font-normal opacity-60">· drag ↕ to reorder</span>
        </p>
        {orderedSections.map((section, idx) => (
          <SectionAccordion
            key={section.key}
            section={section}
            content={content}
            onSaveSection={saveSection}
            saving={saving}
            token={token}
            suggestions={suggestions}
            scheduleSync={section.key === "schedule" ? scheduleSync : undefined}
            onToggleSync={section.key === "schedule" ? async (v) => {
              setScheduleSync(v);
              await fetch("/api/portal/website", {
                method: "POST", headers: { "content-type": "application/json" },
                body: JSON.stringify({ token, scheduleSync: v }),
              });
            } : undefined}
            onMoveUp={() => moveSection(section.key, "up")}
            onMoveDown={() => moveSection(section.key, "down")}
            isFirst={idx === 0}
            isLast={idx === orderedSections.length - 1}
            forceOpen={focusSection === section.key}
          />
        ))}
      </div>

    </div>
  );
}
