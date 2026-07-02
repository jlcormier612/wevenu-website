"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { saveGuideAction } from "@/app/(app)/guide/actions";
import type { FaqEntry, HotelBlock, VenueContact, VenueGuideData } from "@/app/(app)/guide/actions";
import { LuvHeart } from "@/components/dashboard/luv-widget";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// ── Section definitions ──────────────────────────────────────────────────────

type SectionDef = {
  key: string;
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
    luvTip: "Clear policies now mean fewer surprises later. Couples who know the rules early plan with more confidence.",
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
    description: "Anything else couples should know — setup rules, sound restrictions, cleanup expectations.",
    weight: 1,
    isFilled: (d) => !!(d.thingsToDo?.trim()),
  },
  {
    key: "faqs",
    emoji: "❓",
    title: "FAQs",
    description: "The questions you get asked most often — answered once, visible to every couple.",
    luvTip: "FAQs are the most-used section of the Venue Guide. Each answer here means one fewer coordinator message.",
    weight: 3,
    isFilled: (d) => d.faqs.length > 0,
  },
  {
    key: "contacts",
    emoji: "📞",
    title: "Important Contacts",
    description: "Day-of contacts for couples — coordinator, catering lead, security, etc.",
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
    if (pct === 100) return "Your Guide is complete — couples have everything they need.";
    if (topMissing.length === 0) return null;
    const names = topMissing.map(s => `${s.title}`).join(" and ");
    if (topMissing[0].weight === 3) {
      return `Your guide is ${pct}% complete, but you're still missing ${names} — the section${topMissing.length > 1 ? "s" : ""} couples use most.`;
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

function FaqsEditor({ faqs, onSave, saving }: {
  faqs: FaqEntry[]; onSave: (items: FaqEntry[]) => Promise<void>; saving: boolean;
}) {
  const [items, setItems] = React.useState<FaqEntry[]>(faqs);
  const dirty = JSON.stringify(items) !== JSON.stringify(faqs);

  function add() {
    setItems(p => [...p, { question: "", answer: "" }]);
  }

  function remove(i: number) {
    setItems(p => p.filter((_, idx) => idx !== i));
  }

  function update(i: number, key: keyof FaqEntry, val: string) {
    setItems(p => p.map((item, idx) => idx === i ? { ...item, [key]: val } : item));
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No FAQs yet. Add the questions couples ask most often.</p>
      ) : (
        <div className="space-y-4">
          {items.map((faq, i) => (
            <div key={i} className="rounded-xl border border-border bg-muted/20 p-4 space-y-2.5">
              <div className="flex items-start gap-2">
                <span className="text-xs font-semibold text-muted-foreground mt-2 w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 space-y-2">
                  <Input
                    value={faq.question}
                    onChange={e => update(i, "question", e.target.value)}
                    placeholder="Question — e.g. Can we have sparklers?"
                    className="text-sm"
                  />
                  <Textarea
                    value={faq.answer}
                    onChange={e => update(i, "answer", e.target.value)}
                    placeholder="Answer"
                    rows={2}
                    className="text-sm resize-none"
                  />
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
          <Plus className="h-3.5 w-3.5" /> Add FAQ
        </Button>
        <div className="flex gap-2">
          {dirty && (
            <Button variant="outline" size="sm" onClick={() => setItems(faqs)}>
              Cancel
            </Button>
          )}
          <Button size="sm" onClick={() => onSave(items)} disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save FAQs"}
          </Button>
        </div>
      </div>
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
        <p className="text-sm text-muted-foreground py-2">No hotel blocks yet. Add hotels you recommend to couples.</p>
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
        <p className="text-sm text-muted-foreground py-2">No contacts yet. Add the people couples might need to reach on their wedding day.</p>
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
  section, isFilled, children,
}: {
  section: SectionDef; isFilled: boolean; children: React.ReactNode;
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
          <p className="text-xs text-muted-foreground pt-4">{section.description}</p>
          {section.luvTip && <LuvTip text={section.luvTip} />}
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ── Main editor ───────────────────────────────────────────────────────────────

export function VenueGuideEditor({ initial }: { initial: VenueGuideData | null }) {
  const empty: VenueGuideData = {
    parkingInfo: null, transportation: null, nearbyAccommodations: null,
    hotelBlocks: [], rainPlan: null, policies: null, ceremonyInstructions: null,
    thingsToDo: null, faqs: [], importantContacts: [],
  };

  const [data, setData]     = React.useState<VenueGuideData>(initial ?? empty);
  const [saving, setSaving] = React.useState<string | null>(null);

  async function save(partial: Parameters<typeof saveGuideAction>[0], field: string) {
    setSaving(field);
    const result = await saveGuideAction(partial);
    if (result.ok) {
      toast.success("Guide updated.");
    } else {
      toast.error(result.error ?? "Could not save. Please try again.");
    }
    setSaving(null);
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <CompletionMeter data={data} />

      {/* Parking & Transportation */}
      <SectionCard section={SECTIONS[0]} isFilled={SECTIONS[0].isFilled(data)}>
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
      <SectionCard section={SECTIONS[1]} isFilled={SECTIONS[1].isFilled(data)}>
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
      <SectionCard section={SECTIONS[2]} isFilled={SECTIONS[2].isFilled(data)}>
        <TextSectionEditor
          label="Rain Plan"
          value={data.rainPlan ?? ""}
          placeholder="How weather decisions are made, indoor backup location, when couples are notified…"
          saving={saving === "rain_plan"}
          onSave={async v => {
            setData(d => ({ ...d, rainPlan: v || null }));
            await save({ rain_plan: v || null }, "rain_plan");
          }}
        />
      </SectionCard>

      {/* Policies & Rules */}
      <SectionCard section={SECTIONS[3]} isFilled={SECTIONS[3].isFilled(data)}>
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
      </SectionCard>

      {/* Ceremony & Arrival */}
      <SectionCard section={SECTIONS[4]} isFilled={SECTIONS[4].isFilled(data)}>
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
      </SectionCard>

      {/* Things To Know */}
      <SectionCard section={SECTIONS[5]} isFilled={SECTIONS[5].isFilled(data)}>
        <TextSectionEditor
          label="Things To Know"
          value={data.thingsToDo ?? ""}
          placeholder="Setup rules, load-in times, what's included vs. not, tips for the day, anything else couples should know…"
          saving={saving === "things_to_do"}
          onSave={async v => {
            setData(d => ({ ...d, thingsToDo: v || null }));
            await save({ things_to_do: v || null }, "things_to_do");
          }}
        />
      </SectionCard>

      {/* FAQs */}
      <SectionCard section={SECTIONS[6]} isFilled={SECTIONS[6].isFilled(data)}>
        <FaqsEditor
          faqs={data.faqs}
          saving={saving === "faqs"}
          onSave={async items => {
            setData(d => ({ ...d, faqs: items }));
            await save({ faqs: items }, "faqs");
          }}
        />
      </SectionCard>

      {/* Important Contacts */}
      <SectionCard section={SECTIONS[7]} isFilled={SECTIONS[7].isFilled(data)}>
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
