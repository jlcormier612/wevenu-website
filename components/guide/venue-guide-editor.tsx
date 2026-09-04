"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addFaqStarterAgainAction } from "@/app/(app)/guide/faq-starter-actions";
import { saveGuideAction } from "@/app/(app)/guide/actions";
import { updateStoryAction } from "@/app/(app)/settings/actions";
import {
  emptyVenueGuideData,
  type DualCopySectionKey,
  type FaqEntry,
  type GuideAudience,
  type GuideSectionKey,
  type HotelBlock,
  type SectionOverrides,
  type VenueContact,
  type VenueGuideData,
  type VendorFaqEntry,
} from "@/lib/guide/venue-guide-data";
import {
  getFaqStarterMaster,
  type FaqStarterMasterKey,
} from "@/lib/venue-guide/starters";
import { LuvHeart } from "@/components/dashboard/luv-widget";
import { librarySavedToastMessage, useLibraryUnsavedGuard } from "@/components/library/use-library-unsaved-guard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Section definitions ──────────────────────────────────────────────────────

type SectionDef = {
  key: GuideSectionKey;
  emoji: string;
  title: string;
  description: string;
  luvTip?: string;
  weight: 1 | 2 | 3;
  isFilled: (data: VenueGuideData) => boolean;
};

const SECTIONS: SectionDef[] = [
  {
    key: "parking",
    emoji: "🚗",
    title: "Parking & Transportation",
    description: "Parking instructions for guests. Directions, lot locations, street parking, valet, rideshare drop-off.",
    luvTip: "Parking questions peak in the final two weeks before the wedding. A clear description here saves a lot of last-minute messages.",
    weight: 3,
    isFilled: (d) => !!(d.parkingInfo?.trim() || d.transportation?.trim()),
  },
  {
    key: "accommodations",
    emoji: "🏨",
    title: "Accommodations",
    description: "Nearby hotels and hotel blocks for out-of-town guests.",
    luvTip: "Out-of-town guests appreciate hotel recommendations more than almost any other venue detail.",
    weight: 3,
    isFilled: (d) => !!(d.nearbyAccommodations?.trim() || d.hotelBlocks.length > 0),
  },
  {
    key: "weather",
    emoji: "🌧️",
    title: "Weather & Rain Plan",
    description: "Your indoor backup option and how you handle weather decisions.",
    weight: 2,
    isFilled: (d) => !!(d.rainPlan?.trim()),
  },
  {
    key: "policies",
    emoji: "📋",
    title: "Policies & Rules",
    description: "What's allowed and what isn't — sparklers, outside vendors, alcohol, candles, pets, decor.",
    luvTip: "Clear policies now mean fewer surprises later. Clients who know the rules early plan with more confidence.",
    weight: 2,
    isFilled: (d) => !!(d.policies?.trim()),
  },
  {
    key: "ceremony",
    emoji: "⛪",
    title: "Ceremony & Arrival",
    description: "Guest arrival instructions, ceremony setup details, photo restrictions, processional notes.",
    weight: 2,
    isFilled: (d) => !!(d.ceremonyInstructions?.trim()),
  },
  {
    key: "things",
    emoji: "🍽️",
    title: "Things To Know",
    description: "Anything else clients should know — setup rules, sound restrictions, cleanup expectations.",
    weight: 1,
    isFilled: (d) => !!(d.thingsToDo?.trim()),
  },
  {
    key: "faqs",
    emoji: "❓",
    title: "FAQs",
    description: "The questions you get asked most often — answered once. Hello to Cheers starters stay unpublished until you review and turn them on.",
    luvTip: "FAQs are the most-used section of the Venue Guide. Each answer here means one fewer coordinator message. Publish starters only after they match your venue.",
    weight: 3,
    isFilled: (d) => d.faqs.length > 0,
  },
  {
    key: "contacts",
    emoji: "📞",
    title: "Important Contacts",
    description: "Day-of contacts for clients — coordinator, catering lead, security, etc.",
    weight: 3,
    isFilled: (d) => d.importantContacts.length > 0,
  },
];

const TOTAL_WEIGHT = SECTIONS.reduce((s, sec) => s + sec.weight, 0);

// ── Completion meter ──────────────────────────────────────────────────────────

const WEIGHT_STARS: Record<1 | 2 | 3, string> = { 1: "⭐", 2: "⭐⭐", 3: "⭐⭐⭐" };

function CompletionMeter({ data }: { data: VenueGuideData }) {
  const filledWeight  = SECTIONS.reduce((s, sec) => s + (sec.isFilled(data) ? sec.weight : 0), 0);
  const pct           = Math.round((filledWeight / TOTAL_WEIGHT) * 100);

  // Top missing sections by weight — used for the actionable Luv nudge
  const topMissing = SECTIONS
    .filter(s => !s.isFilled(data))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2);

  const color = pct === 100 ? "#5D6F5D" : pct >= 60 ? "#D8A7AA" : "#B8AEA1";

  function luvNudge() {
    if (pct === 100) return "Your Guide is complete — clients have everything they need.";
    if (topMissing.length === 0) return null;
    const names = topMissing.map(s => `${s.title}`).join(" and ");
    if (topMissing[0].weight === 3) {
      return `Your guide is ${pct}% complete, but you're still missing ${names} — the section${topMissing.length > 1 ? "s" : ""} clients use most.`;
    }
    return `${names} ${topMissing.length > 1 ? "are" : "is"} still empty. Each section you complete reduces day-of questions.`;
  }

  const nudge = luvNudge();

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <LuvHeart size={14} />
            <p className="text-sm font-semibold text-heading">Guide Completion</p>
          </div>
          <span className="text-sm font-semibold" style={{ color }}>{pct}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>

        {/* Section pills with weight stars */}
        <div className="flex flex-wrap gap-1.5">
          {SECTIONS.map(s => {
            const done = s.isFilled(data);
            return (
              <span key={s.key}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium"
                style={done
                  ? { background: "#5D6F5D18", color: "#3D5040", border: "1px solid #5D6F5D30" }
                  : { background: "#F3F0EC",   color: "#8A837D",  border: "1px solid #E0D8D0" }
                }>
                {done ? <Check className="h-2.5 w-2.5" /> : <span className="h-2 w-2 rounded-full bg-current opacity-40 inline-block" />}
                {s.emoji} {s.title}
                <span className="opacity-60 text-[9px]">{WEIGHT_STARS[s.weight]}</span>
              </span>
            );
          })}
        </div>

        {nudge && (
          <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5">
            <LuvHeart size={11} />
            <span>{nudge}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Shared components ─────────────────────────────────────────────────────────

const AUDIENCE_OPTIONS: { value: GuideAudience; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "clients", label: "Clients" },
  { value: "vendors", label: "Vendors" },
];

function AudienceControl({
  value,
  onChange,
  disabled,
}: {
  value: GuideAudience;
  onChange: (v: GuideAudience) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] text-muted-foreground shrink-0">Visible to</span>
      <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
        {AUDIENCE_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                active
                  ? "bg-background text-heading shadow-sm"
                  : "text-muted-foreground hover:text-heading"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LuvTip({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed"
      style={{ background: "#FDF5F5", border: "1px solid #D8A7AA25", color: "#6B3E40" }}>
      <span className="shrink-0 mt-0.5"><LuvHeart size={12} /></span>
      <span>{text}</span>
    </div>
  );
}

function SectionHeader({
  section, isFilled, isOpen, onToggle,
}: {
  section: SectionDef; isFilled: boolean; isOpen: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/40 transition-colors text-left"
    >
      <span className="text-xl shrink-0">{section.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-heading">{section.title}</p>
          {isFilled
            ? <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-medium text-emerald-700 border-emerald-200 bg-emerald-50">✓ Complete</Badge>
            : <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-medium text-muted-foreground">Empty</Badge>
          }
        </div>
        {!isOpen && <p className="text-xs text-muted-foreground mt-0.5 truncate">{section.description}</p>}
      </div>
      {isOpen
        ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      }
    </button>
  );
}

// ── Text section ─────────────────────────────────────────────────────────────

function TextSectionEditor({
  label, value, placeholder, onSave, saving,
}: {
  label: string; value: string; placeholder: string;
  onSave: (v: string) => Promise<void>; saving: boolean;
}) {
  const [val, setVal]   = React.useState(value);
  const [dirty, setDirty] = React.useState(false);
  useLibraryUnsavedGuard(dirty);

  function handleChange(v: string) {
    setVal(v);
    setDirty(v !== value);
  }

  async function handleSave() {
    await onSave(val);
    setDirty(false);
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={val}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        rows={5}
        className="text-sm resize-none"
      />
      <div className="flex items-center justify-between">
        {dirty && <p className="text-xs text-muted-foreground">Unsaved changes</p>}
        <div className="ml-auto flex gap-2">
          {dirty && (
            <Button variant="outline" size="sm" onClick={() => handleChange(value)}>
              Cancel
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? "Saving…" : `Save ${label}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── FAQs editor ───────────────────────────────────────────────────────────────

type SimpleFaq = { question: string; answer: string };

function FaqStarterRestoreMenu({ missingKeys }: { missingKeys: FaqStarterMasterKey[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  if (missingKeys.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="sm" disabled={pending}>
            Restore starters
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Hello to Cheers starters</DropdownMenuLabel>
        {missingKeys.map((key) => {
          const master = getFaqStarterMaster(key);
          if (!master) return null;
          return (
            <DropdownMenuItem
              key={key}
              onClick={() =>
                startTransition(async () => {
                  const r = await addFaqStarterAgainAction(key);
                  if (r.ok) {
                    toast.success("Starter added — your earlier customizations were left alone.");
                    router.refresh();
                  } else {
                    toast.error(r.message);
                  }
                })
              }
            >
              <span className="truncate">{master.question}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ClientFaqListEditor({
  title,
  emptyHint,
  items: initial,
  onSave,
  saving,
  saveLabel,
}: {
  title?: string;
  emptyHint: string;
  items: FaqEntry[];
  onSave: (items: FaqEntry[]) => Promise<void>;
  saving: boolean;
  saveLabel: string;
}) {
  const [items, setItems] = React.useState<FaqEntry[]>(initial);
  const dirty = JSON.stringify(items) !== JSON.stringify(initial);

  React.useEffect(() => {
    setItems(initial);
  }, [initial]);

  function add() {
    // Venue-authored FAQs are live by default (publisher intentionally writing).
    setItems((p) => [...p, { question: "", answer: "", published: true }]);
  }

  function remove(i: number) {
    setItems((p) => p.filter((_, idx) => idx !== i));
  }

  function update(i: number, patch: Partial<FaqEntry>) {
    setItems((p) => p.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }

  return (
    <div className="space-y-3">
      {title && <p className="text-xs font-medium text-heading">{title}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">{emptyHint}</p>
      ) : (
        <div className="space-y-4">
          {items.map((faq, i) => {
            const isStarter = Boolean(faq.source_master_key);
            const isPublished = faq.published !== false;
            return (
              <div key={`${faq.source_master_key ?? "custom"}-${i}`} className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-semibold text-muted-foreground mt-2 w-4 shrink-0">{i + 1}</span>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {isStarter && <Badge variant="muted">Starter</Badge>}
                      {isStarter && !isPublished && (
                        <Badge variant="outline">Not published</Badge>
                      )}
                    </div>
                    <Input
                      value={faq.question}
                      onChange={(e) => update(i, { question: e.target.value })}
                      placeholder="Question — e.g. Can we have sparklers?"
                      className="text-sm"
                    />
                    <Textarea
                      value={faq.answer}
                      onChange={(e) => update(i, { answer: e.target.value })}
                      placeholder="Answer"
                      rows={2}
                      className="text-sm resize-none"
                    />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer pt-0.5">
                      <Switch
                        checked={isPublished}
                        onCheckedChange={(on) => update(i, { published: on })}
                      />
                      {isPublished
                        ? "Visible to clients, vendors, and brochures"
                        : "Review only — not visible outside the Venue Guide yet"}
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="p-1.5 mt-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add FAQ
        </Button>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="outline" size="sm" onClick={() => setItems(initial)}>
              Cancel
            </Button>
          )}
          <Button size="sm" onClick={() => onSave(items)} disabled={saving || !dirty}>
            {saving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function VendorFaqListEditor({
  title,
  emptyHint,
  questionPlaceholder,
  answerPlaceholder,
  items: initial,
  onSave,
  saving,
  saveLabel,
}: {
  title?: string;
  emptyHint: string;
  questionPlaceholder: string;
  answerPlaceholder: string;
  items: SimpleFaq[];
  onSave: (items: SimpleFaq[]) => Promise<void>;
  saving: boolean;
  saveLabel: string;
}) {
  const [items, setItems] = React.useState<SimpleFaq[]>(initial);
  const dirty = JSON.stringify(items) !== JSON.stringify(initial);

  React.useEffect(() => {
    setItems(initial);
  }, [initial]);

  function add() {
    setItems((p) => [...p, { question: "", answer: "" }]);
  }

  function remove(i: number) {
    setItems((p) => p.filter((_, idx) => idx !== i));
  }

  function update(i: number, patch: Partial<SimpleFaq>) {
    setItems((p) => p.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));
  }

  return (
    <div className="space-y-3">
      {title && <p className="text-xs font-medium text-heading">{title}</p>}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">{emptyHint}</p>
      ) : (
        <div className="space-y-4">
          {items.map((faq, i) => (
            <div key={i} className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
              <div className="flex items-start gap-2">
                <span className="text-xs font-semibold text-muted-foreground mt-2 w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 space-y-2">
                  <Input
                    value={faq.question}
                    onChange={(e) => update(i, { question: e.target.value })}
                    placeholder={questionPlaceholder}
                    className="text-sm"
                  />
                  <Textarea
                    value={faq.answer}
                    onChange={(e) => update(i, { answer: e.target.value })}
                    placeholder={answerPlaceholder}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="p-1.5 mt-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add FAQ
        </Button>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="outline" size="sm" onClick={() => setItems(initial)}>
              Cancel
            </Button>
          )}
          <Button size="sm" onClick={() => onSave(items)} disabled={saving || !dirty}>
            {saving ? "Saving…" : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FaqsSectionEditor({
  sectionAudience,
  clientFaqs,
  vendorFaqs,
  onSaveClient,
  onSaveVendor,
  savingClient,
  savingVendor,
  missingStarterKeys,
}: {
  sectionAudience: GuideAudience;
  clientFaqs: FaqEntry[];
  vendorFaqs: VendorFaqEntry[];
  onSaveClient: (items: FaqEntry[]) => Promise<void>;
  onSaveVendor: (items: VendorFaqEntry[]) => Promise<void>;
  savingClient: boolean;
  savingVendor: boolean;
  missingStarterKeys: FaqStarterMasterKey[];
}) {
  const showClient = sectionAudience === "both" || sectionAudience === "clients";
  // When vendors-only, edit the main faqs column (section is hidden from clients).
  const vendorUsesMainColumn = sectionAudience === "vendors";

  return (
    <div className="space-y-6">
      {missingStarterKeys.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border px-3.5 py-3">
          <p className="text-xs text-muted-foreground">
            Some Hello to Cheers starter FAQs are missing. Restore adds a fresh unpublished copy without changing your other answers.
            Publishing is controlled per FAQ with the toggle — nothing becomes public until you save with Publish on.
          </p>
          <FaqStarterRestoreMenu missingKeys={missingStarterKeys} />
        </div>
      )}

      {showClient && !vendorUsesMainColumn && (
        <ClientFaqListEditor
          title={sectionAudience === "both" ? "Client FAQs" : undefined}
          emptyHint="No FAQs yet. Add the questions clients ask most often — or restore Hello to Cheers starters."
          items={clientFaqs}
          saving={savingClient}
          saveLabel="Save changes"
          onSave={onSaveClient}
        />
      )}

      {sectionAudience === "both" && (
        <div className="border-t border-border pt-5">
          <VendorFaqListEditor
            title="Vendor FAQs"
            emptyHint="No vendor FAQs yet. Add questions vendors ask — load-in, COI, dock access…"
            questionPlaceholder="Question — e.g. Where is load-in?"
            answerPlaceholder="Answer for vendors"
            items={vendorFaqs}
            saving={savingVendor}
            saveLabel="Save changes"
            onSave={onSaveVendor}
          />
        </div>
      )}

      {vendorUsesMainColumn && (
        <ClientFaqListEditor
          emptyHint="No FAQs yet. Add the questions vendors ask most often."
          items={clientFaqs}
          saving={savingClient}
          saveLabel="Save changes"
          onSave={onSaveClient}
        />
      )}
    </div>
  );
}

// ── Hotel blocks editor ───────────────────────────────────────────────────────

function HotelBlocksEditor({ hotels, onSave, saving }: {
  hotels: HotelBlock[]; onSave: (items: HotelBlock[]) => Promise<void>; saving: boolean;
}) {
  const [items, setItems] = React.useState<HotelBlock[]>(hotels);
  const dirty = JSON.stringify(items) !== JSON.stringify(hotels);

  function add() {
    setItems(p => [...p, { name: "", url: "", code: "", notes: "" }]);
  }
  function remove(i: number) { setItems(p => p.filter((_, idx) => idx !== i)); }
  function update(i: number, key: keyof HotelBlock, val: string) {
    setItems(p => p.map((h, idx) => idx === i ? { ...h, [key]: val } : h));
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No hotel blocks yet. Add hotels you recommend to clients.</p>
      ) : (
        <div className="space-y-3">
          {items.map((h, i) => (
            <div key={i} className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <Input
                    value={h.name}
                    onChange={e => update(i, "name", e.target.value)}
                    placeholder="Hotel name *"
                    className="text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={h.url  ?? ""} onChange={e => update(i, "url",  e.target.value)} placeholder="Booking URL" className="text-sm" />
                    <Input value={h.code ?? ""} onChange={e => update(i, "code", e.target.value)} placeholder="Block code" className="text-sm" />
                  </div>
                  <Input value={h.notes ?? ""} onChange={e => update(i, "notes", e.target.value)} placeholder="Notes (optional)" className="text-sm" />
                </div>
                <button type="button" onClick={() => remove(i)}
                  className="p-1.5 mt-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Hotel
        </Button>
        <div className="flex gap-2">
          {dirty && <Button variant="outline" size="sm" onClick={() => setItems(hotels)}>Cancel</Button>}
          <Button size="sm" onClick={() => onSave(items)} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save Hotels"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Contacts editor ───────────────────────────────────────────────────────────

function ContactsEditor({ contacts, onSave, saving }: {
  contacts: VenueContact[]; onSave: (items: VenueContact[]) => Promise<void>; saving: boolean;
}) {
  const [items, setItems] = React.useState<VenueContact[]>(contacts);
  const dirty = JSON.stringify(items) !== JSON.stringify(contacts);

  function add() { setItems(p => [...p, { name: "", role: "", phone: "", email: "" }]); }
  function remove(i: number) { setItems(p => p.filter((_, idx) => idx !== i)); }
  function update(i: number, key: keyof VenueContact, val: string) {
    setItems(p => p.map((c, idx) => idx === i ? { ...c, [key]: val } : c));
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No contacts yet. Add the people clients might need to reach on their wedding day.</p>
      ) : (
        <div className="space-y-3">
          {items.map((c, i) => (
            <div key={i} className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={c.name} onChange={e => update(i, "name", e.target.value)} placeholder="Name *"  className="text-sm" />
                    <Input value={c.role} onChange={e => update(i, "role", e.target.value)} placeholder="Role *"  className="text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={c.phone ?? ""} onChange={e => update(i, "phone", e.target.value)} placeholder="Phone"  className="text-sm" type="tel" />
                    <Input value={c.email ?? ""} onChange={e => update(i, "email", e.target.value)} placeholder="Email" className="text-sm" type="email" />
                  </div>
                </div>
                <button type="button" onClick={() => remove(i)}
                  className="p-1.5 mt-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Contact
        </Button>
        <div className="flex gap-2">
          {dirty && <Button variant="outline" size="sm" onClick={() => setItems(contacts)}>Cancel</Button>}
          <Button size="sm" onClick={() => onSave(items)} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save Contacts"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Section card wrapper ──────────────────────────────────────────────────────

function SectionCard({
  section, isFilled, audience, onAudienceChange, audienceSaving, children,
}: {
  section: SectionDef;
  isFilled: boolean;
  audience: GuideAudience;
  onAudienceChange: (v: GuideAudience) => void;
  audienceSaving?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Card className={`overflow-hidden transition-shadow ${open ? "shadow-md ring-1 ring-border" : ""}`}>
      <SectionHeader
        section={section}
        isFilled={isFilled}
        isOpen={open}
        onToggle={() => setOpen(v => !v)}
      />
      {open && (
        <CardContent className="pt-0 pb-5 space-y-4 border-t border-border">
          <div className="flex items-start justify-between gap-3 flex-wrap pt-4">
            <p className="text-xs text-muted-foreground flex-1 min-w-[12rem]">{section.description}</p>
            <AudienceControl
              value={audience}
              onChange={onAudienceChange}
              disabled={audienceSaving}
            />
          </div>
          {section.luvTip && <LuvTip text={section.luvTip} />}
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// Our Story is the same venues.story column Settings → Business & Brand
// used to edit directly — this is now the one editor for it, not a second
// one. Not part of GuideSectionKey/SECTIONS: Story has no client/vendor
// audience split (always shown, unlike the rest of the Guide) and isn't
// stored in venue_guide, so it deliberately sits outside that completion-
// weighted, audience-aware system rather than being force-fit into it.
// Renders first because that's where couples encounter it in the portal —
// before Parking/Accommodations/etc.
const STORY_DESCRIPTION = "A short welcome, in your own words. It's the first thing couples read in their Venue Guide.";

function StorySection({
  value,
  saving,
  onSave,
}: {
  value: string;
  saving: boolean;
  onSave: (v: string) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(true);
  const isFilled = value.trim().length > 0;

  return (
    <Card className={`overflow-hidden transition-shadow ${open ? "shadow-md ring-1 ring-border" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/40 transition-colors text-left"
      >
        <span className="text-xl shrink-0">📖</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-heading">Our Story</p>
            {isFilled
              ? <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-medium text-emerald-700 border-emerald-200 bg-emerald-50">✓ Complete</Badge>
              : <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-medium text-muted-foreground">Empty</Badge>
            }
          </div>
          {!open && <p className="text-xs text-muted-foreground mt-0.5 truncate">{value.trim() || STORY_DESCRIPTION}</p>}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <CardContent className="pt-0 pb-5 space-y-4 border-t border-border">
          <p className="text-xs text-muted-foreground pt-4">{STORY_DESCRIPTION}</p>
          <TextSectionEditor
            label="Our Story"
            value={value}
            placeholder="We are so grateful you chose us and can't wait to help you plan and celebrate your special day…"
            saving={saving}
            onSave={onSave}
          />
        </CardContent>
      )}
    </Card>
  );
}

function VendorOverrideToggle({
  enabled,
  onToggle,
  label,
  vendorLabel,
  vendorValue,
  vendorPlaceholder,
  onVendorSave,
  saving,
}: {
  enabled: boolean;
  onToggle: (on: boolean) => void;
  label: string;
  vendorLabel: string;
  vendorValue: string;
  vendorPlaceholder: string;
  onVendorSave: (v: string) => Promise<void>;
  saving: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border px-3.5 py-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <Switch checked={enabled} onCheckedChange={onToggle} />
        Different for vendors
      </label>
      {enabled && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-heading">{vendorLabel}</p>
          <TextSectionEditor
            label={label}
            value={vendorValue}
            placeholder={vendorPlaceholder}
            saving={saving}
            onSave={onVendorSave}
          />
        </div>
      )}
    </div>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

export function VenueGuideEditor({
  initial,
  missingStarterKeys = [],
  initialStory = "",
}: {
  initial: VenueGuideData | null;
  missingStarterKeys?: FaqStarterMasterKey[];
  /** venues.story — same column/action Settings → Business & Brand used to edit; one source of truth. */
  initialStory?: string;
}) {
  const [data, setData]     = React.useState<VenueGuideData>(initial ?? emptyVenueGuideData());
  const [saving, setSaving] = React.useState<string | null>(null);
  const [story, setStory]   = React.useState(initialStory);

  React.useEffect(() => {
    if (initial) setData(initial);
  }, [initial]);

  React.useEffect(() => {
    setStory(initialStory);
  }, [initialStory]);

  async function save(partial: Parameters<typeof saveGuideAction>[0], field: string) {
    setSaving(field);
    const result = await saveGuideAction(partial);
    if (result.ok) {
      toast.success(librarySavedToastMessage());
    } else {
      toast.error(result.error ?? "Could not save. Please try again.");
    }
    setSaving(null);
  }

  async function saveStory(v: string) {
    setSaving("story");
    await updateStoryAction(v);
    setStory(v);
    toast.success(librarySavedToastMessage());
    setSaving(null);
  }

  async function setSectionAudience(key: GuideSectionKey, audience: GuideAudience) {
    const nextAudiences = { ...data.sectionAudiences, [key]: audience };
    setData(d => ({ ...d, sectionAudiences: nextAudiences }));
    await save({ section_audiences: nextAudiences }, "section_audiences");
  }

  async function setSectionOverride(
    key: DualCopySectionKey,
    vendors: string | null | undefined,
  ) {
    const nextOverrides: SectionOverrides = { ...data.sectionOverrides };
    if (vendors === undefined || vendors === null) {
      const { [key]: _removed, ...rest } = nextOverrides;
      void _removed;
      setData(d => ({ ...d, sectionOverrides: rest }));
      await save({ section_overrides: rest }, "section_overrides");
      return;
    }
    nextOverrides[key] = { vendors };
    setData(d => ({ ...d, sectionOverrides: nextOverrides }));
    await save({ section_overrides: nextOverrides }, "section_overrides");
  }

  async function setVendorFaqs(vendors: VendorFaqEntry[]) {
    const nextOverrides: SectionOverrides = { ...data.sectionOverrides };
    const cleaned = vendors
      .map((f) => ({ question: f.question, answer: f.answer }))
      .filter((f) => f.question.trim().length > 0 || f.answer.trim().length > 0);
    if (cleaned.length === 0) {
      const { faqs: _removed, ...rest } = nextOverrides;
      void _removed;
      setData((d) => ({ ...d, sectionOverrides: rest }));
      await save({ section_overrides: rest }, "section_overrides");
      return;
    }
    nextOverrides.faqs = { vendors: cleaned };
    setData((d) => ({ ...d, sectionOverrides: nextOverrides }));
    await save({ section_overrides: nextOverrides }, "section_overrides");
  }

  function sectionProps(key: GuideSectionKey) {
    const def = SECTIONS.find(s => s.key === key)!;
    return {
      section: def,
      isFilled: def.isFilled(data),
      audience: data.sectionAudiences[key],
      onAudienceChange: (v: GuideAudience) => void setSectionAudience(key, v),
      audienceSaving: saving === "section_audiences",
    };
  }

  const parkingVendorCopy = data.sectionOverrides.parking?.vendors ?? "";
  const policiesVendorCopy = data.sectionOverrides.policies?.vendors ?? "";
  const ceremonyVendorCopy = data.sectionOverrides.ceremony?.vendors ?? "";
  const thingsVendorCopy = data.sectionOverrides.things?.vendors ?? "";
  const parkingDual = typeof data.sectionOverrides.parking?.vendors === "string";
  const policiesDual = typeof data.sectionOverrides.policies?.vendors === "string";
  const ceremonyDual = typeof data.sectionOverrides.ceremony?.vendors === "string";
  const thingsDual = typeof data.sectionOverrides.things?.vendors === "string";
  const vendorFaqs = data.sectionOverrides.faqs?.vendors ?? [];

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-sm border border-border bg-muted/30 px-4 py-3 text-sm space-y-1.5">
        <p className="font-medium text-heading">What clients see here</p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Everything in this guide (parking, policies, FAQs, day-of contacts, and the rest) is edited
          on this page — this is the source of truth clients and vendors read in the portal. Your
          venue name, logo, and brand colors used in emails and portal chrome live in{" "}
          <a href="/settings/business" className="underline underline-offset-2 text-heading">
            Settings → Business &amp; Brand
          </a>
          . Client reminder cadence and optional staff email alerts live in{" "}
          <a href="/settings/communications" className="underline underline-offset-2 text-heading">
            Settings → Communications
          </a>
          .
        </p>
      </div>

      <CompletionMeter data={data} />

      {/* Our Story — first thing couples read in the portal Guide, right after the hero photo */}
      <StorySection value={story} saving={saving === "story"} onSave={saveStory} />

      {/* Parking & Transportation */}
      <SectionCard {...sectionProps("parking")}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-heading">Parking</p>
            <TextSectionEditor
              label="Parking"
              value={data.parkingInfo ?? ""}
              placeholder="Describe where guests should park — lots, street parking, cost, accessibility…"
              saving={saving === "parking_info"}
              onSave={async v => {
                const next = { ...data, parkingInfo: v || null };
                setData(next);
                await save({ parking_info: v || null }, "parking_info");
              }}
            />
          </div>
          <VendorOverrideToggle
            enabled={parkingDual}
            onToggle={(on) => void setSectionOverride("parking", on ? "" : undefined)}
            label="Vendor Parking"
            vendorLabel="Vendor parking / load-in"
            vendorValue={parkingVendorCopy}
            vendorPlaceholder="Load-in access, vendor lot, dock instructions, setup vehicle rules…"
            saving={saving === "section_overrides"}
            onVendorSave={async v => { await setSectionOverride("parking", v); }}
          />
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-heading">Transportation & Directions</p>
            <TextSectionEditor
              label="Transportation"
              value={data.transportation ?? ""}
              placeholder="Directions, rideshare drop-off points, shuttle info, nearby transit…"
              saving={saving === "transportation"}
              onSave={async v => {
                const next = { ...data, transportation: v || null };
                setData(next);
                await save({ transportation: v || null }, "transportation");
              }}
            />
          </div>
        </div>
      </SectionCard>

      {/* Accommodations */}
      <SectionCard {...sectionProps("accommodations")}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-heading">Hotel Blocks</p>
            <HotelBlocksEditor
              hotels={data.hotelBlocks}
              saving={saving === "hotel_blocks"}
              onSave={async items => {
                setData(d => ({ ...d, hotelBlocks: items }));
                await save({ hotel_blocks: items }, "hotel_blocks");
              }}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-heading">Nearby Accommodations (general)</p>
            <TextSectionEditor
              label="Accommodations"
              value={data.nearbyAccommodations ?? ""}
              placeholder="Overview of nearby hotels, Airbnbs, or other lodging options…"
              saving={saving === "nearby_accommodations"}
              onSave={async v => {
                setData(d => ({ ...d, nearbyAccommodations: v || null }));
                await save({ nearby_accommodations: v || null }, "nearby_accommodations");
              }}
            />
          </div>
        </div>
      </SectionCard>

      {/* Weather & Rain Plan */}
      <SectionCard {...sectionProps("weather")}>
        <TextSectionEditor
          label="Rain Plan"
          value={data.rainPlan ?? ""}
          placeholder="How weather decisions are made, indoor backup location, when clients are notified…"
          saving={saving === "rain_plan"}
          onSave={async v => {
            setData(d => ({ ...d, rainPlan: v || null }));
            await save({ rain_plan: v || null }, "rain_plan");
          }}
        />
      </SectionCard>

      {/* Policies & Rules */}
      <SectionCard {...sectionProps("policies")}>
        <div className="space-y-4">
          <TextSectionEditor
            label="Policies"
            value={data.policies ?? ""}
            placeholder="Sparklers, open flames, outside catering, alcohol rules, décor restrictions, noise curfew, cleanup expectations…"
            saving={saving === "policies"}
            onSave={async v => {
              setData(d => ({ ...d, policies: v || null }));
              await save({ policies: v || null }, "policies");
            }}
          />
          <VendorOverrideToggle
            enabled={policiesDual}
            onToggle={(on) => void setSectionOverride("policies", on ? "" : undefined)}
            label="Vendor Policies"
            vendorLabel="Vendor rules"
            vendorValue={policiesVendorCopy}
            vendorPlaceholder="Insurance, load-in window, approved deliveries, floor protection, teardown expectations…"
            saving={saving === "section_overrides"}
            onVendorSave={async v => { await setSectionOverride("policies", v); }}
          />
        </div>
      </SectionCard>

      {/* Ceremony & Arrival */}
      <SectionCard {...sectionProps("ceremony")}>
        <div className="space-y-4">
          <TextSectionEditor
            label="Ceremony Instructions"
            value={data.ceremonyInstructions ?? ""}
            placeholder="Guest arrival time, seating arrangement, ceremony start, photo restrictions during ceremony…"
            saving={saving === "ceremony_instructions"}
            onSave={async v => {
              setData(d => ({ ...d, ceremonyInstructions: v || null }));
              await save({ ceremony_instructions: v || null }, "ceremony_instructions");
            }}
          />
          <VendorOverrideToggle
            enabled={ceremonyDual}
            onToggle={(on) => void setSectionOverride("ceremony", on ? "" : undefined)}
            label="Vendor Ceremony"
            vendorLabel="Vendor arrival / setup"
            vendorValue={ceremonyVendorCopy}
            vendorPlaceholder="Vendor arrival window, setup access, ceremony-day load-in, restricted areas…"
            saving={saving === "section_overrides"}
            onVendorSave={async v => { await setSectionOverride("ceremony", v); }}
          />
        </div>
      </SectionCard>

      {/* Things To Know */}
      <SectionCard {...sectionProps("things")}>
        <div className="space-y-4">
          <TextSectionEditor
            label="Things To Know"
            value={data.thingsToDo ?? ""}
            placeholder="Setup rules, load-in times, what's included vs. not, tips for the day, anything else clients should know…"
            saving={saving === "things_to_do"}
            onSave={async v => {
              setData(d => ({ ...d, thingsToDo: v || null }));
              await save({ things_to_do: v || null }, "things_to_do");
            }}
          />
          <VendorOverrideToggle
            enabled={thingsDual}
            onToggle={(on) => void setSectionOverride("things", on ? "" : undefined)}
            label="Vendor Notes"
            vendorLabel="Things vendors should know"
            vendorValue={thingsVendorCopy}
            vendorPlaceholder="Power drops, floor protection, teardown windows, preferred vendor entrance…"
            saving={saving === "section_overrides"}
            onVendorSave={async v => { await setSectionOverride("things", v); }}
          />
        </div>
      </SectionCard>

      {/* FAQs */}
      <SectionCard {...sectionProps("faqs")}>
        <FaqsSectionEditor
          sectionAudience={data.sectionAudiences.faqs}
          clientFaqs={data.faqs}
          vendorFaqs={vendorFaqs}
          savingClient={saving === "faqs"}
          savingVendor={saving === "section_overrides"}
          missingStarterKeys={missingStarterKeys}
          onSaveClient={async items => {
            setData(d => ({ ...d, faqs: items }));
            await save({ faqs: items }, "faqs");
          }}
          onSaveVendor={async items => {
            await setVendorFaqs(items);
          }}
        />
      </SectionCard>

      {/* Important Contacts */}
      <SectionCard {...sectionProps("contacts")}>
        <ContactsEditor
          contacts={data.importantContacts}
          saving={saving === "important_contacts"}
          onSave={async items => {
            setData(d => ({ ...d, importantContacts: items }));
            await save({ important_contacts: items }, "important_contacts");
          }}
        />
      </SectionCard>
    </div>
  );
}
