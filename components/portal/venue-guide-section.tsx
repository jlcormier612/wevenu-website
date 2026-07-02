"use client";

import * as React from "react";
import { Search, Globe, Phone, Mail, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { PortalContext } from "@/lib/portal/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const SAGE      = "#5D6F5D";
const LINEN     = "#FAF8F4";
const TAUPE     = "#8C8075";
const ROSE      = "#C9697A";
const BORDER    = "#E8E2DB";

// ── Data types ────────────────────────────────────────────────────────────────

type HotelBlock = {
  name:  string;
  url?:  string | null;
  code?: string | null;
  notes?: string | null;
};

type ContactEntry = {
  name:   string;
  role?:  string | null;
  phone?: string | null;
  email?: string | null;
};

type FaqEntry = {
  question: string;
  answer:   string;
};

type VenueGuideData = {
  parkingInfo:          string | null;
  transportation:       string | null;
  hotelBlocks:          HotelBlock[];
  nearbyAccommodations: string | null;
  thingsToDo:           string | null;
  faqs:                 FaqEntry[];
  policies:             string | null;
  ceremonyInstructions: string | null;
  rainPlan:             string | null;
  importantContacts:    ContactEntry[];
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function matches(text: string | null | undefined, q: string): boolean {
  if (!text || !q) return true;
  return text.toLowerCase().includes(q.toLowerCase());
}

function hasAny(...vals: (string | null | undefined | unknown[])[]): boolean {
  return vals.some(v => {
    if (Array.isArray(v)) return v.length > 0;
    return !!v;
  });
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function GuideSection({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 pb-1" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <span className="text-base leading-none">{emoji}</span>
        <h3 className="text-sm font-semibold" style={{ color: SAGE }}>{title}</h3>
      </div>
      {children}
    </section>
  );
}

// ── Text block ────────────────────────────────────────────────────────────────

function TextBlock({ text }: { text: string }) {
  return (
    <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#4A4440" }}>
      {text}
    </p>
  );
}

// ── Hotel card ────────────────────────────────────────────────────────────────

function HotelCard({ hotel }: { hotel: HotelBlock }) {
  return (
    <div className="rounded-2xl border p-4 space-y-1.5" style={{ borderColor: BORDER, background: "#FDFCFA" }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium" style={{ color: "#2D2A28" }}>{hotel.name}</p>
        {hotel.url && (
          <a href={hotel.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] shrink-0 hover:underline"
            style={{ color: SAGE }}>
            Book <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {hotel.code && (
        <p className="text-xs" style={{ color: TAUPE }}>
          Block code: <span className="font-mono font-semibold" style={{ color: "#2D2A28" }}>{hotel.code}</span>
        </p>
      )}
      {hotel.notes && (
        <p className="text-xs leading-relaxed" style={{ color: TAUPE }}>{hotel.notes}</p>
      )}
    </div>
  );
}

// ── Contact card ──────────────────────────────────────────────────────────────

function ContactCard({ contact }: { contact: ContactEntry }) {
  return (
    <div className="rounded-2xl border p-4 space-y-2" style={{ borderColor: BORDER, background: "#FDFCFA" }}>
      <div>
        <p className="text-sm font-medium" style={{ color: "#2D2A28" }}>{contact.name}</p>
        {contact.role && (
          <p className="text-[11px]" style={{ color: TAUPE }}>{contact.role}</p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {contact.phone && (
          <a href={`tel:${contact.phone}`}
            className="flex items-center gap-1.5 text-xs hover:underline"
            style={{ color: SAGE }}>
            <Phone className="h-3 w-3" />
            {contact.phone}
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`}
            className="flex items-center gap-1.5 text-xs hover:underline"
            style={{ color: SAGE }}>
            <Mail className="h-3 w-3" />
            {contact.email}
          </a>
        )}
      </div>
    </div>
  );
}

// ── FAQ accordion item ────────────────────────────────────────────────────────

function FaqItem({ faq, open, onToggle }: { faq: FaqEntry; open: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: BORDER }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-3 px-4 py-3.5 text-left transition-colors"
        style={{ background: open ? `${SAGE}08` : "#FDFCFA" }}>
        <p className="text-sm font-medium leading-snug" style={{ color: "#2D2A28" }}>{faq.question}</p>
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 mt-0.5" style={{ color: TAUPE }} />
          : <ChevronDown className="h-4 w-4 shrink-0 mt-0.5" style={{ color: TAUPE }} />
        }
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1" style={{ background: `${SAGE}06` }}>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: "#4A4440" }}>
            {faq.answer}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyGuide({ venueName }: { venueName: string }) {
  return (
    <div className="text-center py-16 space-y-3">
      <span className="text-4xl block">🏛️</span>
      <p className="text-sm font-medium" style={{ color: "#4A4440" }}>Your Venue Guide is on its way</p>
      <p className="text-xs leading-relaxed max-w-xs mx-auto" style={{ color: TAUPE }}>
        {venueName} is still adding venue details here. In the meantime, feel free to ask Luv any questions you have.
      </p>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function VenueGuideSection({ token, context }: { token: string; context: PortalContext }) {
  const [data,    setData]    = React.useState<VenueGuideData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [query,   setQuery]   = React.useState("");
  const [openFaq, setOpenFaq] = React.useState<number | null>(null);

  React.useEffect(() => {
    fetch(`/api/portal/venue-info?token=${token}`)
      .then(r => r.json())
      .then((d: VenueGuideData | null) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const q = query.trim().toLowerCase();

  // Derived filtered content
  const filteredFaqs = (data?.faqs ?? []).filter(
    f => !q || matches(f.question, q) || matches(f.answer, q)
  );
  const filteredHotels = (data?.hotelBlocks ?? []).filter(
    h => !q || matches(h.name, q) || matches(h.notes, q) || matches(h.code, q)
  );
  const filteredContacts = (data?.importantContacts ?? []).filter(
    c => !q || matches(c.name, q) || matches(c.role, q) || matches(c.phone, q) || matches(c.email, q)
  );

  // Section visibility when searching
  function show(relevant: boolean, ...texts: (string | null | undefined)[]): boolean {
    if (!q) return relevant;
    return texts.some(t => matches(t, q)) || (relevant && filteredFaqs.length + filteredHotels.length + filteredContacts.length > 0);
  }

  const hasParking         = hasAny(data?.parkingInfo, data?.transportation);
  const hasAccommodations  = hasAny(data?.hotelBlocks, data?.nearbyAccommodations);
  const hasCeremony        = hasAny(data?.ceremonyInstructions);
  const hasRain            = hasAny(data?.rainPlan);
  const hasPolicies        = hasAny(data?.policies);
  const hasThings          = hasAny(data?.thingsToDo);
  const hasFaqs            = data?.faqs && data.faqs.length > 0;
  const hasContacts        = data?.importantContacts && data.importantContacts.length > 0;
  const hasAnyData         = hasParking || hasAccommodations || hasCeremony || hasRain || hasPolicies || hasThings || hasFaqs || hasContacts;

  // Search visibility per section
  const showParking        = hasParking        && (!q || matches(data?.parkingInfo, q) || matches(data?.transportation, q));
  const showAccommodations = hasAccommodations && (!q || filteredHotels.length > 0 || matches(data?.nearbyAccommodations, q));
  const showCeremony       = hasCeremony       && (!q || matches(data?.ceremonyInstructions, q));
  const showRain           = hasRain           && (!q || matches(data?.rainPlan, q));
  const showPolicies       = hasPolicies       && (!q || matches(data?.policies, q));
  const showThings         = hasThings         && (!q || matches(data?.thingsToDo, q));
  const showFaqs           = hasFaqs           && (!q || filteredFaqs.length > 0);
  const showContacts       = hasContacts       && (!q || filteredContacts.length > 0);

  const hasResults = showParking || showAccommodations || showCeremony || showRain || showPolicies || showThings || showFaqs || showContacts;

  return (
    <div className="space-y-6 pb-10">

      {/* Page header */}
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold" style={{ color: "#2D2A28" }}>🏛️ Venue Guide</h2>
        <p className="text-xs" style={{ color: TAUPE }}>
          Everything {context.venue.name} has shared — browse, search, or ask Luv anything.
        </p>
      </div>

      {/* Search */}
      {hasAnyData && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: TAUPE }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search venue guide…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-2xl border focus:outline-none focus:ring-2 focus:ring-offset-0"
            style={{
              borderColor: BORDER,
              background: "#FDFCFA",
              color: "#2D2A28",
              // @ts-expect-error css variable
              "--tw-ring-color": `${SAGE}40`,
            }}
          />
          {query && (
            <button type="button" onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: TAUPE }}>
              Clear
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-2xl border p-4 space-y-2 animate-pulse" style={{ borderColor: BORDER }}>
              <div className="h-3 w-32 rounded-full bg-gray-100" />
              <div className="h-3 w-full rounded-full bg-gray-100" />
              <div className="h-3 w-3/4 rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      )}

      {/* No data at all */}
      {!loading && !hasAnyData && <EmptyGuide venueName={context.venue.name} />}

      {/* No search results */}
      {!loading && hasAnyData && q && !hasResults && (
        <div className="text-center py-8 space-y-2">
          <p className="text-sm font-medium" style={{ color: "#4A4440" }}>No results for "{query}"</p>
          <p className="text-xs" style={{ color: TAUPE }}>
            Try a different search, or ask Luv directly.
          </p>
        </div>
      )}

      {/* ── Venue Overview ── always shown if we have any data ── */}
      {!loading && hasAnyData && (!q || show(true, context.venue.name, context.venue.website)) && (
        <GuideSection emoji="📍" title="Venue Overview">
          <div className="rounded-2xl border p-4 space-y-2" style={{ borderColor: BORDER, background: "#FDFCFA" }}>
            <p className="text-sm font-semibold" style={{ color: "#2D2A28" }}>{context.venue.name}</p>
            {context.venue.website && (
              <a href={context.venue.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs hover:underline"
                style={{ color: SAGE }}>
                <Globe className="h-3 w-3" />
                {context.venue.website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </GuideSection>
      )}

      {/* ── Parking & Transportation ── */}
      {!loading && showParking && (
        <GuideSection emoji="🚗" title="Parking & Transportation">
          <div className="space-y-3">
            {data?.parkingInfo   && <TextBlock text={data.parkingInfo} />}
            {data?.transportation && data.parkingInfo && (
              <div className="h-px" style={{ background: BORDER }} />
            )}
            {data?.transportation && <TextBlock text={data.transportation} />}
          </div>
        </GuideSection>
      )}

      {/* ── Accommodations ── */}
      {!loading && showAccommodations && (
        <GuideSection emoji="🏨" title="Accommodations">
          <div className="space-y-3">
            {filteredHotels.length > 0 && (
              <div className="space-y-2">
                {filteredHotels.map((h, i) => <HotelCard key={i} hotel={h} />)}
              </div>
            )}
            {data?.nearbyAccommodations && (!q || matches(data.nearbyAccommodations, q)) && (
              <>
                {filteredHotels.length > 0 && <div className="h-px" style={{ background: BORDER }} />}
                <TextBlock text={data.nearbyAccommodations} />
              </>
            )}
          </div>
        </GuideSection>
      )}

      {/* ── Weather & Rain Plan ── */}
      {!loading && showRain && (
        <GuideSection emoji="🌧️" title="Weather & Rain Plan">
          <TextBlock text={data!.rainPlan!} />
        </GuideSection>
      )}

      {/* ── Policies & Rules ── */}
      {!loading && showPolicies && (
        <GuideSection emoji="📋" title="Policies & Rules">
          <TextBlock text={data!.policies!} />
        </GuideSection>
      )}

      {/* ── Ceremony & Arrival ── */}
      {!loading && showCeremony && (
        <GuideSection emoji="⛪" title="Ceremony & Arrival">
          <TextBlock text={data!.ceremonyInstructions!} />
        </GuideSection>
      )}

      {/* ── Things To Know ── */}
      {!loading && showThings && (
        <GuideSection emoji="🍽️" title="Things To Know">
          <TextBlock text={data!.thingsToDo!} />
        </GuideSection>
      )}

      {/* ── FAQs ── */}
      {!loading && showFaqs && (
        <GuideSection emoji="❓" title="FAQs">
          <div className="space-y-2">
            {filteredFaqs.map((faq, i) => (
              <FaqItem
                key={i}
                faq={faq}
                open={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </GuideSection>
      )}

      {/* ── Important Contacts ── */}
      {!loading && showContacts && (
        <GuideSection emoji="📞" title="Important Contacts">
          <div className="space-y-2">
            {filteredContacts.map((c, i) => <ContactCard key={i} contact={c} />)}
          </div>
        </GuideSection>
      )}

      {/* Luv nudge at bottom */}
      {!loading && hasAnyData && (
        <div className="rounded-2xl border border-dashed p-4 text-center space-y-1" style={{ borderColor: `${ROSE}40`, background: `${ROSE}08` }}>
          <p className="text-xs font-medium" style={{ color: ROSE }}>💗 Can't find what you're looking for?</p>
          <p className="text-[11px]" style={{ color: TAUPE }}>
            Ask Luv — she knows everything in this guide and can answer your questions conversationally.
          </p>
        </div>
      )}
    </div>
  );
}
