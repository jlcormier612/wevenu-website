"use client";

/**
 * PortalShell — the couple's wedding planning workspace.
 *
 * Navigation model (Sprint 50):
 *
 * COUPLE-OWNED (their space):
 *   Overview    — combined dashboard: guests, todos, upcoming milestones
 *   Guest List  — their guest list with RSVP tracking
 *   To-Do       — personal planning tasks (separate from venue tasks)
 *   Our People  — who else has access to their planning workspace
 *
 * SHARED WITH VENUE:
 *   Tasks       — venue-assigned tasks requiring couple action
 *   Payments    — invoices + payment schedule
 *   Documents   — shared documents
 *   Messages    — shared communication thread
 *
 * Design: mobile-first, Heritage Sage palette, venue-branded header.
 * "The client portal is not the venue portal filtered for the couple."
 */

import * as React from "react";

import {
  CalendarDays, Check, CheckSquare, Clock, Loader2,
  Plus, Trash2, Users, X,
} from "lucide-react";
import { toast } from "sonner";

import type {
  ActivityItem, ClientMedia, CoupleProfile, CoupleTodo, CoupleGuest,
  GuestStats, JournalEntry, PortalContext, PortalKeyDate, PortalSection, PortalTask,
  RecentActivity, TodoCategory, PortalParticipant, PortalActivity,
  PortalTimelineEntry, PortalTimelineSection, PortalVenueTeamMember,
} from "@/lib/portal/types";
import { getAnniversaryObservations, getCountdownObservation, getOverviewObservation, getWeddingDayObservations } from "@/lib/luv/portal-observations";
import {
  type AccountState, getAccountStateAction, changePasswordAction, revokeSessionAction,
  grantSupportAccessAction, revokeSupportGrantAction,
} from "@/app/(portal)/p/[token]/account-actions";
import { RequestsPortalSection, RequestsSummaryCard } from "@/components/portal/requests-section";
import { LuvIntroCard } from "@/components/luv/luv-intro-card";
import { UnifiedTasksSection } from "@/components/portal/unified-tasks-section";
import { buildUnifiedTaskList } from "@/lib/portal/unified-tasks";
import type { PortalRequestSummary } from "@/lib/requests/types";
import { QuestionnairePortalSection } from "@/components/portal/questionnaire-section";

// Venue Brand Experience Phase 1: SAGE/LINEN/CREAM were Hello to Cheers' own hardcoded
// palette, now the venue's own brand via CSS custom properties injected on
// this file's root wrapper (context.venue.*). TAUPE stays a fixed muted gray
// deliberately — it's used here for body text/icon legibility, and a venue's
// own "neutral" color (often near-white) isn't guaranteed safe as text color
// the way it is as a background tint. ROSE/ROSE_DEEP are Luv's own persona
// identity, not a venue-branding target — confirmed unchanged everywhere
// else in the app (dashboard, Settings, draft panels).
const SAGE = "var(--venue-primary)";
const LINEN = "var(--venue-neutral)";
const TAUPE = "#B8AEA1";
const ROSE  = "#D8A7AA";
const ROSE_DEEP = "#C17F84";
const CREAM = "var(--venue-neutral)";

// ── Shared utilities ──────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso + "T12:00:00").getTime() - Date.now()) / 86_400_000);
}

function ReadinessRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={CREAM} strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={SAGE} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={SAGE}>{score}%</text>
    </svg>
  );
}

// ── Floral line art — hero corner decoration ──────────────────────────────────

function FloralLineart() {
  return (
    <svg width="200" height="220" viewBox="0 0 200 220" fill="none" style={{ opacity: 0.18 }} aria-hidden="true">
      <path d="M155 220 C148 190 138 165 122 140 C106 115 92 85 86 50 C83 35 82 20 80 5" stroke={ROSE} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M122 140 C108 133 90 130 74 122" stroke={ROSE} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M132 115 C144 106 152 92 158 76" stroke={ROSE} strokeWidth="1.1" strokeLinecap="round" />
      <path d="M101 90 C112 82 118 70 115 55" stroke={ROSE} strokeWidth="0.9" strokeLinecap="round" />
      <path d="M96 100 C88 94 80 93 76 98 C80 100 88 101 96 100Z" stroke={ROSE} strokeWidth="0.9" fill="none" />
      <path d="M128 126 C134 118 136 110 132 104 C128 110 126 118 128 126Z" stroke={ROSE} strokeWidth="0.9" fill="none" />
      <path d="M108 72 C114 65 115 57 111 53 C107 58 106 66 108 72Z" stroke={ROSE} strokeWidth="0.8" fill="none" />
      <circle cx="80" cy="5" r="3.5" stroke={ROSE} strokeWidth="1" />
      <path d="M80 5 C77 -2 73 -3 71 0 C74 2 78 3 80 5Z" stroke={ROSE} strokeWidth="0.8" fill="none" />
      <path d="M80 5 C83 -2 87 -3 89 0 C86 2 82 3 80 5Z" stroke={ROSE} strokeWidth="0.8" fill="none" />
      <path d="M80 5 C75 0 73 4 75 7 C77 7 79 6 80 5Z" stroke={ROSE} strokeWidth="0.8" fill="none" />
      <path d="M80 5 C85 0 87 4 85 7 C83 7 81 6 80 5Z" stroke={ROSE} strokeWidth="0.8" fill="none" />
      <circle cx="74" cy="122" r="3" stroke={ROSE} strokeWidth="1" />
      <path d="M74 122 C70 117 66 117 65 121 C68 122 72 122 74 122Z" stroke={ROSE} strokeWidth="0.7" fill="none" />
      <path d="M74 122 C78 117 82 117 83 121 C80 122 76 122 74 122Z" stroke={ROSE} strokeWidth="0.7" fill="none" />
      <path d="M74 122 C70 127 70 131 74 131 C75 129 74 125 74 122Z" stroke={ROSE} strokeWidth="0.7" fill="none" />
      <circle cx="158" cy="76" r="2.5" stroke={ROSE} strokeWidth="0.9" />
      <path d="M158 76 C155 70 152 70 151 73 C154 74 157 75 158 76Z" stroke={ROSE} strokeWidth="0.7" fill="none" />
      <path d="M158 76 C161 70 164 70 165 73 C162 74 159 75 158 76Z" stroke={ROSE} strokeWidth="0.7" fill="none" />
      <circle cx="68" cy="108" r="1.2" fill={ROSE} opacity="0.6" />
      <circle cx="145" cy="95" r="1" fill={ROSE} opacity="0.5" />
      <circle cx="90" cy="130" r="1" fill={ROSE} opacity="0.4" />
    </svg>
  );
}

// ── Luv message generator (contextual, warm) ─────────────────────────────────

function getLuvMessage(du: number | null, guestTotal: number, readiness: number): string {
  if (du === null) return "Your wedding planning is underway. You're doing beautifully.";
  if (du < 0) return "You made it. Every detail of how you got here lives in this space — revisit it whenever you want to remember.";
  if (du === 0) return "Today is your wedding day. Everything you've planned leads to this moment. You're going to be extraordinary.";
  if (du > 365) return "You have a beautiful journey ahead. The earlier you start, the more you can enjoy every moment.";
  if (du > 270) return "This is such an exciting time. Most couples at your stage are locking in their venue and photographer.";
  if (du > 180 && guestTotal === 0) return "Your guest list is the heart of your celebration. Now is a wonderful time to start building it.";
  if (du > 180) return `With ${guestTotal} guests on your list, you're building something beautiful. Invitations typically go out 2–3 months out.`;
  if (du > 90 && readiness < 50) return "You have everything you need to make this incredible. A few focused weeks of planning will bring it all together.";
  if (du > 90) return "You're making wonderful progress. The details are coming together exactly as they should.";
  if (du > 30) return "The final weeks before a wedding are often the most magical. Your special day is almost here.";
  return "Your wedding day is so close. Breathe, celebrate, and enjoy every moment of this journey.";
}

// Short poetic line for the hero — storytelling, not status.
function getStoryLine(du: number | null): string {
  if (du === null) return "A love story, beautifully in progress.";
  if (du === 0) return "Today is the day.";
  if (du < 0) {
    const n = -du;
    if (n >= 365 * 2) return `${Math.floor(n / 365)} years married.`;
    if (n >= 365)     return "One year married. 💗";
    if (n >= 180)     return "Half a year married. The journey continues.";
    if (n >= 90)      return "Three months married.";
    if (n >= 30)      return "One month married.";
    return "Just married. The best is yet to come.";
  }
  if (du > 365) return "Where it all begins.";
  if (du > 270) return "The first beautiful decisions.";
  if (du > 180) return "The big decisions, falling into place.";
  if (du > 90) return "Every detail, coming to life.";
  if (du > 30) return "So close, you can almost feel it.";
  return "The countdown is real now.";
}

// ── Planning journey milestone path ──────────────────────────────────────────

const MILESTONES = [
  { label: "12 mo", threshold: 365 },
  { label: "9 mo",  threshold: 270 },
  { label: "6 mo",  threshold: 180 },
  { label: "3 mo",  threshold: 90  },
  { label: "1 mo",  threshold: 30  },
  { label: "Day",   threshold: 0   },
];

function PlanningJourney({ du, readiness }: { du: number | null; readiness: number }) {
  if (du === null) return null;
  const activeIdx = MILESTONES.findIndex(m => du > m.threshold);
  const pct = readiness;

  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-heading">🌸 Wedding Journey</p>
        <p className="text-xs font-semibold" style={{ color: ROSE_DEEP }}>{pct}% complete</p>
      </div>
      {/* Milestone dots */}
      <div className="flex items-center gap-0">
        {MILESTONES.map((m, i) => {
          const isPast = activeIdx > 0 && i < activeIdx;
          const isCurrent = i === activeIdx || activeIdx === -1 && i === MILESTONES.length - 1;
          return (
            <React.Fragment key={m.label}>
              <div className="flex flex-col items-center gap-1">
                <div className={`rounded-full border-2 transition-all ${
                  isCurrent ? "h-3.5 w-3.5 scale-110" : "h-3 w-3"
                }`}
                  style={{
                    background: isCurrent ? ROSE : isPast ? SAGE : "white",
                    borderColor: isCurrent ? ROSE : isPast ? SAGE : "#DED6CA",
                    boxShadow: isCurrent ? `0 0 0 4px ${ROSE}25` : "none",
                  }} />
                <p className="text-[9px] font-medium" style={{ color: isCurrent ? ROSE_DEEP : isPast ? SAGE : "#B8AEA1" }}>{m.label}</p>
              </div>
              {i < MILESTONES.length - 1 && (
                <div className="flex-1 h-0.5 mb-3" style={{ background: isPast ? SAGE : "#DED6CA" }} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ── "Your Season" — narrative context, not a status card ────────────────────

type Season = "spring" | "summer" | "fall" | "winter";

function getSeason(iso: string): Season {
  const month = Number(iso.slice(5, 7));
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

const SEASON_CONTENT: Record<Season, { emoji: string; title: string; copy: string; sparkle: string }> = {
  spring: { emoji: "🌷", title: "A Spring Wedding", copy: "Soft blooms, fresh air, and new beginnings — spring weddings carry a sense of renewal in every detail.", sparkle: "🌸 · 🌿 · 🌷" },
  summer: { emoji: "☀️", title: "A Summer Wedding", copy: "Long golden evenings and warm celebrations — summer is when love feels most alive.", sparkle: "☀️ · 🌿 · 🌻" },
  fall:   { emoji: "🍂", title: "A Fall Wedding",   copy: "Rich colors and crisp air — fall weddings carry a cozy, romantic warmth.", sparkle: "🍂 · 🌾 · 🍁" },
  winter: { emoji: "❄️", title: "A Winter Wedding", copy: "Twinkling lights and intimate gatherings — winter weddings feel like a fairytale.", sparkle: "❄️ · ✨ · 🤍" },
};

function YourSeasonCard({ eventDate }: { eventDate: string }) {
  const season = getSeason(eventDate);
  const { emoji, title, copy, sparkle } = SEASON_CONTENT[season];
  const dateLabel = new Date(eventDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  return (
    <div className="rounded-3xl p-6 sm:p-8 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${ROSE}14 0%, #FBF8F5 100%)`, border: `1px solid ${ROSE}30` }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: ROSE_DEEP }}>💗 Your Season</p>
      <div className="flex items-start gap-4">
        <span className="text-4xl shrink-0">{emoji}</span>
        <div className="space-y-1.5">
          <p className="font-heading text-2xl text-heading leading-snug">{title}</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md">{copy}</p>
          <p className="text-xs text-muted-foreground/70 pt-1">{dateLabel}</p>
        </div>
      </div>
      <p className="mt-5 text-sm tracking-widest" style={{ color: `${ROSE}A0` }}>{sparkle}</p>
    </div>
  );
}

// ── "Most Couples Like You" — reassuring social proof ────────────────────────

const SOCIAL_PROOF_BY_BRACKET: Record<string, string> = {
  "12+": "Most couples this far out are choosing their venue and starting their guest list. You're exactly on track.",
  "9-12": "Most couples at 9–12 months are locking in photographers, florists, and caterers. This is the season of big decisions.",
  "6-9": "Most couples at 6–9 months are sending invitations and booking hair & makeup trials.",
  "3-6": "Most couples at 3–6 months are finalizing their guest count and building their day-of timeline.",
  "1-3": "Most couples in the final stretch are writing vows and confirming details with every vendor.",
  "<1": "Most couples this close are simply trying to enjoy the moment — you've already done the hard part.",
};

// ── Journal milestone labels ──────────────────────────────────────────────────
// Shared between OurStorySection (form) and journal entry display

export const JOURNAL_MILESTONES: { key: string; emoji: string; label: string; postWedding?: boolean }[] = [
  { key: "venue_tour",        emoji: "🏡", label: "Venue Tour" },
  { key: "engagement_party",  emoji: "🥂", label: "Engagement Party" },
  { key: "dress_shopping",    emoji: "👗", label: "Dress Shopping" },
  { key: "venue_signed",      emoji: "✍️", label: "Venue Signed" },
  { key: "save_the_dates",    emoji: "💌", label: "Save the Dates" },
  { key: "vendor_booked",     emoji: "📸", label: "Vendor Booked" },
  { key: "bridal_shower",     emoji: "🌸", label: "Bridal Shower" },
  { key: "bachelorette",      emoji: "✨", label: "Bachelorette" },
  { key: "rehearsal",         emoji: "💍", label: "Rehearsal" },
  { key: "wedding_day",       emoji: "💒", label: "Wedding Day" },
  { key: "honeymoon",         emoji: "🌴", label: "Honeymoon",         postWedding: true },
  { key: "first_anniversary", emoji: "🎉", label: "First Anniversary", postWedding: true },
  { key: "first_home",        emoji: "🏠", label: "First Home",        postWedding: true },
  { key: "reflection",        emoji: "💭", label: "Reflection",        postWedding: true },
  { key: "other",             emoji: "💗", label: "Moment" },
];

// ── YourWeekCard ──────────────────────────────────────────────────────────────

function YourWeekCard({ activity }: { activity: RecentActivity | null }) {
  if (!activity) return null;
  const { activity: items = [], totalThisWeek } = activity;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em]" style={{ color: ROSE_DEEP }}>
        🌿 This Week
      </p>
      {totalThisWeek === 0 ? (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-heading">A quiet week.</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your journey has its own rhythm — still moments are part of the story too.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.slice(0, 4).map((item: ActivityItem, i: number) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-sm leading-none mt-0.5 shrink-0">{item.emoji}</span>
              <p className="text-xs text-heading leading-snug">{item.label}</p>
            </div>
          ))}
          {totalThisWeek > 4 && (
            <p className="text-[10px] text-muted-foreground pl-6">
              +{totalThisWeek - 4} more this week
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Guest milestone thresholds for the sidebar card ───────────────────────────

const GUEST_MILESTONES = [10, 25, 50, 75, 100, 150, 200];

function MostCouplesCard({ bracket }: { bracket: string }) {
  const message = SOCIAL_PROOF_BY_BRACKET[bracket] ?? SOCIAL_PROOF_BY_BRACKET["6-9"];
  return (
    <div className="rounded-3xl border bg-card p-6 sm:p-7 flex items-start gap-4" style={{ borderColor: `${ROSE}30` }}>
      <span className="text-2xl shrink-0">✨</span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1.5" style={{ color: ROSE_DEEP }}>Most Couples Like You</p>
        <p className="text-sm sm:text-[15px] text-heading leading-relaxed">{message}</p>
      </div>
    </div>
  );
}

// ── Wedding quotes — cover-of-a-magazine feel ─────────────────────────────────

const WEDDING_QUOTES = [
  "And so the adventure begins.",
  "Yours, forever and always.",
  "The beginning of forever.",
  "From this day forward.",
  "A love story, beautifully unfolding.",
  "Every detail, crafted with love.",
  "The best is yet to come.",
  "Love, celebrated beautifully.",
  "Where two become one.",
  "Something beautiful is coming.",
];

function pickQuote(name: string): string {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return WEDDING_QUOTES[h % WEDDING_QUOTES.length];
}

// ── Wedding Snapshot — at-a-glance editorial summary ─────────────────────────

function WeddingSnapshotCard({
  du, guestStats, todoCount, readinessScore,
}: {
  du: number | null; guestStats: GuestStats | null; todoCount: number; readinessScore: number;
}) {
  const cells = [
    du !== null && du > 0 && { emoji: "📅", label: `${du} days to go`, sub: null },
    du !== null && du <= 0 && { emoji: "✦",  label: du === 0 ? "Your wedding day" : `${-du} days married`, sub: null },
    { emoji: "👥", label: guestStats?.total ? `${guestStats.total} guests invited` : "Guest list not started", sub: guestStats?.attending ? `${guestStats.attending} confirmed` : null },
    { emoji: "✨", label: todoCount > 0 ? `${todoCount} planning ${todoCount === 1 ? "item" : "items"}` : "Planning notebook ready", sub: null },
    readinessScore > 0 && { emoji: "🌿", label: `${readinessScore}% of venue tasks done`, sub: null },
  ].filter(Boolean) as { emoji: string; label: string; sub: string | null }[];

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] mb-3" style={{ color: ROSE_DEEP }}>🌿 Your Snapshot</p>
      <div className="grid grid-cols-2 gap-2">
        {cells.map(cell => (
          <div key={cell.label} className="rounded-xl p-3" style={{ background: "#F8F6F2" }}>
            <p className="text-base mb-1">{cell.emoji}</p>
            <p className="text-xs font-medium text-heading leading-snug">{cell.label}</p>
            {cell.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{cell.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Next Big Moment — surfaces the most relevant next step ───────────────────

const NEXT_MILESTONE_BY_BRACKET: Record<string, { emoji: string; title: string; desc: string }> = {
  "12+": { emoji: "👥", title: "Start your guest list", desc: "One of the most exciting parts of planning — who will celebrate with you?" },
  "9-12":{ emoji: "🌸", title: "Book your florist", desc: "Talented florists book up fast. Now is the perfect time to lock in your vision." },
  "6-9": { emoji: "💌", title: "Send your save the dates", desc: "Let your guests know the date so they can make it a priority." },
  "3-6": { emoji: "📬", title: "Mail your invitations", desc: "The most tangible moment of your celebration — the invitation in hand." },
  "1-3": { emoji: "📝", title: "Write your vows", desc: "The most personal words of your entire wedding. Give them the time they deserve." },
  "<1":  { emoji: "😌", title: "Take a deep breath", desc: "You've done the hard part. Now enjoy the countdown to the best day of your life." },
};

function NextBigMomentCard({
  bracket, guestTotal, onNavigate,
}: {
  bracket: string; guestTotal: number; onNavigate: (s: PortalSection) => void;
}) {
  const milestone = guestTotal === 0 && bracket !== "<1"
    ? NEXT_MILESTONE_BY_BRACKET["12+"]
    : NEXT_MILESTONE_BY_BRACKET[bracket] ?? NEXT_MILESTONE_BY_BRACKET["6-9"];

  return (
    <div className="rounded-3xl p-6" style={{ background: `linear-gradient(135deg, ${ROSE}12 0%, #FAF7F4 100%)`, border: `1px solid ${ROSE}28` }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: ROSE_DEEP }}>💗 Next Big Moment</p>
      <div className="flex items-start gap-4">
        <span className="text-3xl shrink-0 mt-0.5">{milestone.emoji}</span>
        <div className="space-y-1">
          <p className="font-heading text-lg text-heading leading-snug">{milestone.title}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{milestone.desc}</p>
        </div>
      </div>
      <button type="button" onClick={() => onNavigate("todos")}
        className="mt-5 text-xs font-semibold px-4 py-2 rounded-xl transition-colors text-white"
        style={{ background: ROSE }}>
        Add to your plans →
      </button>
    </div>
  );
}

// ── Venue Note — warm message from the venue team ────────────────────────────

function VenueNoteCard({ venueName }: { venueName: string }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid #E8E2D8` }}>
      <div className="px-5 pt-4 pb-5" style={{ background: "linear-gradient(135deg, #F9F6F0 0%, #F4EFE6 100%)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: ROSE_DEEP }}>
          💌 From Your Venue
        </p>
        <p className="font-heading text-sm text-heading leading-relaxed italic">
          "We're so excited to start planning with you. Every couple who celebrates with us becomes part of our story — and you are no exception. We can't wait to make this beautiful."
        </p>
        <p className="mt-3 text-[11px] font-medium" style={{ color: ROSE_DEEP, opacity: 0.65 }}>
          — The {venueName} Team
        </p>
      </div>
    </div>
  );
}

// ── "Coming Up" — friendly guidance, not tasks ───────────────────────────────

const COMING_UP_BY_BRACKET: Record<string, { emoji: string; text: string }[]> = {
  "12+": [
    { emoji: "📷", text: "Book your photographer" },
    { emoji: "🏡", text: "Tour venue options" },
    { emoji: "👥", text: "Start your guest list" },
  ],
  "9-12": [
    { emoji: "🌸", text: "Book your florist" },
    { emoji: "👗", text: "Start dress shopping" },
    { emoji: "📜", text: "Book your officiant" },
  ],
  "6-9": [
    { emoji: "💌", text: "Send your save the dates" },
    { emoji: "🏨", text: "Reserve a hotel block" },
    { emoji: "💄", text: "Book hair & makeup" },
  ],
  "3-6": [
    { emoji: "📬", text: "Mail your invitations" },
    { emoji: "🍰", text: "Finalize your menu" },
    { emoji: "📋", text: "Build your day-of timeline" },
  ],
  "1-3": [
    { emoji: "📝", text: "Write your vows" },
    { emoji: "⏰", text: "Confirm vendor timing" },
    { emoji: "🪑", text: "Finalize seating" },
  ],
  "<1": [
    { emoji: "😌", text: "Take a deep breath" },
    { emoji: "🧴", text: "Pack your emergency kit" },
    { emoji: "💌", text: "Write your vows (final draft)" },
  ],
};

function ComingUpCard({ bracket, onNavigate }: { bracket: string; onNavigate: (s: PortalSection) => void }) {
  const items = COMING_UP_BY_BRACKET[bracket] ?? COMING_UP_BY_BRACKET["6-9"];
  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ background: `linear-gradient(135deg, ${ROSE}10 0%, #FAF8F5 100%)`, border: `1px solid ${ROSE}28` }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: ROSE_DEEP }}>💗 Coming Up</p>
      <div className="space-y-2.5">
        {items.map(item => (
          <button key={item.text} type="button" onClick={() => onNavigate("todos")}
            className="w-full text-left flex items-center gap-2.5 group">
            <span className="text-base shrink-0 group-hover:scale-110 transition-transform">{item.emoji}</span>
            <span className="text-sm text-heading group-hover:text-heading/80 transition-colors">{item.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Inspiration — static seasonal content ────────────────────────────────────

const INSPIRATION_CONTENT: Record<string, { emoji: string; headline: string; items: string[] }> = {
  "12+": { emoji: "🌿", headline: "Finding your aesthetic", items: ["Explore color palettes", "Discover your venue style", "Gather inspiration photos"] },
  "9-12": { emoji: "🌸", headline: "Big vendor decisions", items: ["Questions to ask photographers", "Floral style guide", "Cake inspiration boards"] },
  "6-9": { emoji: "💌", headline: "Details that delight", items: ["Invitation suite inspiration", "Welcome bag ideas", "Ceremony décor trends"] },
  "3-6": { emoji: "🎉", headline: "The final vision", items: ["Day-of timeline tips", "Seating chart ideas", "Vow writing guidance"] },
  "1-3": { emoji: "✨", headline: "Last-minute magic", items: ["Emergency kit essentials", "A beautiful morning routine", "Tips for staying present"] },
  "<1": { emoji: "💗", headline: "Savoring every moment", items: ["How to be present on your day", "First look inspiration", "Capturing candid moments"] },
};

function InspirationCard({ bracket }: { bracket: string }) {
  const content = INSPIRATION_CONTENT[bracket] ?? INSPIRATION_CONTENT["6-9"];
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${ROSE}22` }}>
      <div className="px-5 py-4" style={{ background: `linear-gradient(135deg, ${ROSE}10 0%, #FBF9F6 100%)` }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2" style={{ color: ROSE_DEEP }}>
          {content.emoji} Inspiration
        </p>
        <p className="font-heading text-base text-heading mb-3 leading-snug">{content.headline}</p>
        <div className="space-y-1.5">
          {content.items.map(item => (
            <p key={item} className="text-xs text-muted-foreground flex items-center gap-2">
              <span style={{ color: ROSE }}>✦</span> {item}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Wedding Journey Milestones — bottom full-width section ────────────────────

const JOURNEY_MILESTONES = [
  { key: "venue",       label: "Venue booked",       emoji: "🏡", detail: "You're here — the most important step is done." },
  { key: "guests",      label: "Guest list started",  emoji: "👥", detail: "Add your guests to get started." },
  { key: "website",     label: "Website published",   emoji: "🌐", detail: "Share your love story with the world." },
  { key: "invitations", label: "Invitations sent",    emoji: "💌", detail: "The world is about to know." },
  { key: "rsvps",       label: "RSVPs received",      emoji: "📬", detail: "Your guests are celebrating with you." },
];

function WeddingJourneySection({ guestStats }: { guestStats: GuestStats | null }) {
  const completed: Record<string, boolean> = {
    venue:       true,
    guests:      (guestStats?.total ?? 0) > 0,
    website:     false,
    invitations: false,
    rsvps:       (guestStats?.attending ?? 0) > 0,
  };
  const doneCount = Object.values(completed).filter(Boolean).length;

  return (
    <div className="rounded-3xl p-6 sm:p-8" style={{
      background: "linear-gradient(135deg, #F7F5F0 0%, #F0EDE6 100%)",
      border: "1px solid #E8E2D8",
    }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1" style={{ color: ROSE_DEEP }}>💗 Your Wedding Journey</p>
          <p className="font-heading text-2xl sm:text-3xl text-heading leading-snug">Milestones worth celebrating</p>
        </div>
        <div className="text-right shrink-0 pl-4">
          <p className="font-heading text-2xl font-semibold text-heading">{doneCount}/{JOURNEY_MILESTONES.length}</p>
          <p className="text-[11px] text-muted-foreground">complete</p>
        </div>
      </div>
      <div className="space-y-4">
        {JOURNEY_MILESTONES.map((m, i) => {
          const done = completed[m.key];
          const isNext = !done && JOURNEY_MILESTONES.slice(0, i).every(prev => completed[prev.key]);
          return (
            <div key={m.key} className={`flex items-start gap-4 ${!done && !isNext ? "opacity-50" : ""}`}>
              <div className="h-7 w-7 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  borderColor: done ? SAGE : isNext ? ROSE : "#DED6CA",
                  background: done ? SAGE : isNext ? `${ROSE}12` : "white",
                }}>
                {done
                  ? <Check className="h-4 w-4 text-white" />
                  : <span className="text-[10px]" style={{ color: isNext ? ROSE_DEEP : "#C0B8B0" }}>{i + 1}</span>
                }
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base">{m.emoji}</span>
                  <p className={`text-sm font-semibold ${done || isNext ? "text-heading" : "text-muted-foreground"}`}>
                    {m.label}
                  </p>
                  {done && (
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, var(--venue-primary) 9%, transparent)`, color: SAGE }}>
                      Done ✓
                    </span>
                  )}
                  {isNext && (
                    <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${ROSE}15`, color: ROSE_DEEP }}>
                      Up next
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{m.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Post-Wedding: Star Rating ─────────────────────────────────────────────────

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = React.useState(0);
  return (
    <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)} onMouseEnter={() => setHover(n)}
          className="p-0.5 transition-transform hover:scale-110" aria-label={`${n} star${n === 1 ? "" : "s"}`}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill={(hover || value) >= n ? ROSE : "none"}
              stroke={(hover || value) >= n ? ROSE : "#C4BAB5"}
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

// ── Post-Wedding: Feedback Flow ───────────────────────────────────────────────
// Step 1: Venue experience (stars + qualitative)
// Step 2: Permission (if rating >= 3)
// Step 3: Hello to Cheers platform feedback — completely separate, never visible to venue
// Done: Thank you

type FeedbackStep = "prompt" | "step1" | "step2" | "step3" | "done";
type PermOption   = "none" | "review_only" | "review_and_names" | "review_and_photos";

function FeedbackFlow({
  token, venueName, coupleName, onDone,
}: {
  token: string; venueName: string; coupleName: string;
  onDone: (rating: number) => void;
}) {
  const [step, setStep]             = React.useState<FeedbackStep>("prompt");
  const [rating, setRating]         = React.useState(0);
  const [lovedMost, setLovedMost]   = React.useState("");
  const [couldImprove, setCouldImprove] = React.useState("");
  const [wouldRecommend, setWouldRecommend] = React.useState(true);
  const [permission, setPermission] = React.useState<PermOption>("none");
  const [npsScore, setNpsScore]     = React.useState(8);
  const [platformComments, setPlatformComments] = React.useState("");
  const [suggestions, setSuggestions] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  function handleStep1Next() {
    if (!rating) return;
    if (rating >= 3) setStep("step2");
    else setStep("step3");
  }

  async function handleFinalSubmit() {
    setSubmitting(true);
    try {
      await Promise.all([
        fetch("/api/portal/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, rating, lovedMost, couldImprove, wouldRecommend, permission }),
        }),
        fetch("/api/portal/platform-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, npsScore, comments: platformComments, suggestions }),
        }),
      ]);
      setStep("done");
      onDone(rating);
    } catch {
      toast.error("Could not submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const PERM_OPTS: { val: PermOption; label: string; sub: string }[] = [
    { val: "none",                label: "Keep private",                       sub: "Just for the venue's own records" },
    { val: "review_only",         label: "Share my words anonymously",         sub: "No names — just the sentiment" },
    { val: "review_and_names",    label: `Share with our names`,               sub: coupleName },
    { val: "review_and_photos",   label: "Share with names + selected photos", sub: "Only photos you choose to share" },
  ];

  const ratingLabel = ["", "Below expectations", "Could have been better", "Pretty good", "Really wonderful", "Absolutely perfect 💗"][rating] ?? "";

  if (step === "prompt") {
    return (
      <div className="rounded-2xl p-6 text-center space-y-4"
        style={{ background: "#FDF5F5", border: `1px solid ${ROSE}28` }}>
        <p className="text-lg">💗</p>
        <div>
          <p className="text-sm font-semibold text-heading">How was your experience?</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Share your thoughts with {venueName}. Feedback goes directly to them — nothing is shared publicly.
          </p>
        </div>
        <button onClick={() => setStep("step1")}
          className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: ROSE_DEEP }}>
          Share your experience
        </button>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="rounded-2xl p-5 flex items-center gap-3"
        style={{ background: `color-mix(in srgb, var(--venue-primary) 2%, transparent)`, border: `1px solid color-mix(in srgb, var(--venue-primary) 15%, transparent)` }}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, var(--venue-primary) 9%, transparent)` }}>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke={SAGE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-heading">Thank you, {coupleName.split(" ")[0]}.</p>
          <p className="text-xs text-muted-foreground">Your words went directly to {venueName}.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${ROSE}28` }}>
      {/* Progress bar */}
      <div className="flex justify-center gap-1.5 py-3 border-b" style={{ background: "#FDF5F5", borderColor: `${ROSE}20` }}>
        {(["step1", "step2", "step3"] as const).map((s, i) => {
          const currentIndex = ["step1", "step2", "step3"].indexOf(step);
          return (
            <div key={s} className="h-1.5 rounded-full transition-all"
              style={{ width: step === s ? 20 : 6, background: currentIndex >= i ? ROSE_DEEP : `${ROSE}40` }} />
          );
        })}
      </div>

      <div className="p-5 space-y-5" style={{ background: "#FDF5F5" }}>

        {/* ── Step 1: Venue experience ── */}
        {step === "step1" && (
          <>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: ROSE_DEEP }}>
                Your experience with {venueName}
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                This feedback goes directly to {venueName}. Nothing is shared publicly.
              </p>
              <div className="flex justify-center mb-1"><StarRating value={rating} onChange={setRating} /></div>
              {rating > 0 && (
                <p className="text-center text-xs mt-1" style={{ color: ROSE_DEEP }}>{ratingLabel}</p>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-heading block mb-1.5">What did you love most?</label>
                <textarea value={lovedMost} onChange={e => setLovedMost(e.target.value)}
                  placeholder="The ceremony space, our coordinator, the little details..."
                  rows={3} className="w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none focus:outline-none bg-white/80"
                  style={{ borderColor: `${ROSE}40` }} />
              </div>
              <div>
                <label className="text-xs font-medium text-heading block mb-1.5">
                  Anything we could have done even better?{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea value={couldImprove} onChange={e => setCouldImprove(e.target.value)}
                  placeholder="Even the smallest things help us improve..."
                  rows={2} className="w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none focus:outline-none bg-white/80"
                  style={{ borderColor: `${ROSE}40` }} />
              </div>
              <div className="flex items-center justify-between rounded-xl border p-3.5 bg-white/50"
                style={{ borderColor: `${ROSE}30` }}>
                <p className="text-sm font-medium text-heading">Would you recommend {venueName}?</p>
                <div className="flex gap-2">
                  {([{ label: "Yes", val: true }, { label: "Not sure", val: false }] as const).map(opt => (
                    <button key={String(opt.val)} type="button" onClick={() => setWouldRecommend(opt.val)}
                      className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
                      style={wouldRecommend === opt.val
                        ? { background: ROSE_DEEP, color: "white" }
                        : { background: `${ROSE}15`, color: ROSE_DEEP }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={handleStep1Next} disabled={!rating}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ background: ROSE_DEEP }}>
              Continue →
            </button>
          </>
        )}

        {/* ── Step 2: Permission (positive reviews only) ── */}
        {step === "step2" && (
          <>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2" style={{ color: ROSE_DEEP }}>
                Sharing your kind words
              </p>
              <p className="text-sm font-medium text-heading mb-1">
                Would you be comfortable with {venueName} sharing your experience?
              </p>
              <p className="text-xs text-muted-foreground">
                The venue reviews everything first. Nothing is published without their approval.
              </p>
            </div>

            <div className="space-y-2">
              {PERM_OPTS.map(opt => (
                <button key={opt.val} type="button"
                  onClick={() => { setPermission(opt.val); setStep("step3"); }}
                  className="w-full text-left rounded-xl border px-4 py-3 transition-all hover:opacity-90"
                  style={{ background: "white", borderColor: permission === opt.val ? `${ROSE_DEEP}60` : `${ROSE}30` }}>
                  <p className="text-sm font-medium text-heading">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Step 3: Hello to Cheers platform feedback (separate — never to venue) ── */}
        {step === "step3" && (
          <>
            <div className="rounded-xl border p-4 space-y-4 bg-white">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                  Just for the Hello to Cheers team
                </p>
                <p className="text-sm font-medium text-heading">How was your experience using Hello to Cheers?</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  🔒 This goes only to Hello to Cheers — never to {venueName}, never publicly shared.
                </p>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                  <span>Not likely</span>
                  <span className="font-semibold text-heading">{npsScore} / 10</span>
                  <span>Extremely likely</span>
                </div>
                <input type="range" min={0} max={10} value={npsScore}
                  onChange={e => setNpsScore(Number(e.target.value))}
                  className="w-full accent-rose-400" />
                <p className="text-center text-[10px] text-muted-foreground mt-1">
                  How likely are you to recommend Hello to Cheers to others?
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-heading block mb-1.5">
                  Any feedback or features you&apos;d love?{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <textarea value={platformComments} onChange={e => setPlatformComments(e.target.value)}
                  placeholder="What could we improve? What did you love?"
                  rows={2} className="w-full rounded-xl border px-3.5 py-2.5 text-sm resize-none focus:outline-none"
                  style={{ borderColor: "#E5E0DC" }} />
              </div>
            </div>

            <button onClick={handleFinalSubmit} disabled={submitting}
              className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
              style={{ background: ROSE_DEEP }}>
              {submitting ? "Submitting…" : "Submit →"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Post-Wedding: Memories ────────────────────────────────────────────────────
// Couple shares photos from their day. Private by default; can share with venue
// or approve for testimonial use. Venue sees shared/testimonial photos only.

type CoupleMemory = {
  id: string; storageUrl: string; caption: string | null;
  visibility: "private" | "venue" | "testimonial"; createdAt: string;
};

function MemoriesSection({ token, venueName }: { token: string; venueName: string }) {
  const [memories, setMemories]   = React.useState<CoupleMemory[]>([]);
  const [showAdd, setShowAdd]     = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [caption, setCaption]     = React.useState("");
  const [visibility, setVisibility] = React.useState<"private" | "venue" | "testimonial">("venue");
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    fetch(`/api/portal/memories?token=${token}`)
      .then(r => r.json())
      .then((d: { memories?: CoupleMemory[] }) => setMemories(d.memories ?? []))
      .catch(() => {});
  }, [token]);

  async function handleUpload() {
    if (!pendingFile) return;
    setUploading(true);

    const form = new FormData();
    form.append("token", token);
    form.append("file", pendingFile);
    form.append("type", "memory");

    const uploadRes  = await fetch("/api/portal/upload", { method: "POST", body: form });
    const uploadData = await uploadRes.json() as { ok: boolean; url?: string; path?: string };

    if (uploadData.ok && uploadData.url && uploadData.path) {
      const memRes  = await fetch("/api/portal/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token, storageUrl: uploadData.url, storagePath: uploadData.path,
          caption: caption.trim() || null, visibility,
        }),
      });
      const memData = await memRes.json() as { ok: boolean; memory?: CoupleMemory };
      if (memData.ok && memData.memory) {
        setMemories(prev => [memData.memory!, ...prev]);
      }
    }

    setPendingFile(null);
    setCaption("");
    setVisibility("venue");
    setShowAdd(false);
    setUploading(false);
  }

  const VISIB: Record<string, { label: string; color: string }> = {
    private:     { label: "Private",     color: "#9B9490" },
    venue:       { label: "Shared",      color: SAGE },
    testimonial: { label: "Testimonial", color: ROSE_DEEP },
  };

  const venueSuffix = venueName.split(" ").slice(0, 2).join(" ");

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #E8E3DC" }}>
      <div className="px-5 py-3.5 border-b flex items-center justify-between"
        style={{ background: "#F7F5F1", borderColor: "#E8E3DC" }}>
        <div className="flex items-center gap-2">
          <span>📸</span>
          <p className="text-sm font-semibold text-heading">Memories</p>
          {memories.length > 0 && (
            <span className="text-[10px] text-muted-foreground">({memories.length})</span>
          )}
        </div>
        <button type="button" onClick={() => setShowAdd(s => !s)}
          className="text-xs font-semibold px-3 py-1 rounded-full transition-all"
          style={{ background: showAdd ? `${ROSE}20` : `color-mix(in srgb, var(--venue-primary) 7%, transparent)`, color: showAdd ? ROSE_DEEP : SAGE }}>
          {showAdd ? "Cancel" : "+ Add"}
        </button>
      </div>

      {/* Upload form */}
      {showAdd && (
        <div className="p-4 border-b space-y-3" style={{ background: "#FDFAF8", borderColor: "#E8E3DC" }}>
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-6 cursor-pointer"
            style={{ borderColor: pendingFile ? ROSE : "#D9D3CB" }}
            onClick={() => fileRef.current?.click()}>
            {pendingFile
              ? <p className="text-sm font-medium text-heading">{pendingFile.name}</p>
              : <>
                  <span className="text-2xl">🖼️</span>
                  <p className="text-sm text-muted-foreground">Tap to choose a photo</p>
                </>}
          </div>
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" className="hidden"
            onChange={e => setPendingFile(e.target.files?.[0] ?? null)} />

          <input value={caption} onChange={e => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="w-full rounded-xl border px-3.5 py-2 text-sm focus:outline-none"
            style={{ borderColor: "#DDD8D2" }} />

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Who can see this?</p>
            <div className="flex gap-2">
              {(["private", "venue", "testimonial"] as const).map(v => (
                <button key={v} type="button" onClick={() => setVisibility(v)}
                  className="flex-1 rounded-xl border py-2 text-xs font-semibold transition-all"
                  style={visibility === v
                    ? { background: VISIB[v].color, color: "white", borderColor: VISIB[v].color }
                    : { background: "white", color: "#888", borderColor: "#DDD8D2" }}>
                  {v === "private" ? "Private" : v === "venue" ? `Share with ${venueSuffix}` : "Testimonial"}
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={handleUpload} disabled={!pendingFile || uploading}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            style={{ background: SAGE }}>
            {uploading ? "Uploading…" : "Upload Memory"}
          </button>
        </div>
      )}

      {/* Memory grid */}
      {memories.length === 0 && !showAdd ? (
        <div className="py-8 text-center px-5">
          <span className="text-2xl">📸</span>
          <p className="text-sm text-muted-foreground mt-2">No memories shared yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add photos from your day — they&apos;ll live here forever.
          </p>
        </div>
      ) : memories.length > 0 ? (
        <div className="grid grid-cols-3 gap-0.5" style={{ background: "#E8E3DC" }}>
          {memories.map(m => (
            <div key={m.id} className="relative aspect-square overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.storageUrl} alt={m.caption ?? "Memory"} className="h-full w-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1"
                style={{ background: "rgba(0,0,0,0.45)" }}>
                <p className="text-[9px] font-semibold"
                  style={{ color: VISIB[m.visibility]?.color ?? "white" }}>
                  {VISIB[m.visibility]?.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Post-Wedding: Referral Card ───────────────────────────────────────────────
// Couple refers a friend to the venue. Shows after positive feedback.

function ReferralCard({
  token, venueName, onDone,
}: {
  token: string; venueName: string; onDone: () => void;
}) {
  const [name, setName]         = React.useState("");
  const [contact, setContact]   = React.useState("");
  const [note, setNote]         = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone]         = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);

    const isEmail = contact.includes("@");
    try {
      const res = await fetch("/api/portal/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name:  name.trim(),
          email: isEmail ? contact.trim() : undefined,
          phone: !isEmail ? contact.trim() : undefined,
          note:  note.trim() || undefined,
        }),
      });
      const data = await res.json() as { ok?: boolean };
      if (data.ok === false) throw new Error("Referral failed");
      setDone(true);
      onDone();
    } catch {
      toast.error("Could not send referral. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl p-5 text-center space-y-2"
        style={{ background: `color-mix(in srgb, var(--venue-primary) 2%, transparent)`, border: `1px solid color-mix(in srgb, var(--venue-primary) 15%, transparent)` }}>
        <p className="text-lg">💗</p>
        <p className="text-sm font-semibold text-heading">Referral sent. Thank you!</p>
        <p className="text-xs text-muted-foreground">{venueName} will be in touch with them.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${ROSE}28` }}>
      <div className="px-5 py-4 border-b" style={{ background: "#FDF5F5", borderColor: `${ROSE}20` }}>
        <p className="text-sm font-semibold text-heading">💗 Know someone getting married?</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Help {venueName} find their next couple.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-3" style={{ background: "#FDFAF9" }}>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="Friend's name *" required
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none"
          style={{ borderColor: `${ROSE}35` }} />
        <input value={contact} onChange={e => setContact(e.target.value)}
          placeholder="Email or phone number"
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none"
          style={{ borderColor: `${ROSE}35` }} />
        <input value={note} onChange={e => setNote(e.target.value)}
          placeholder="A note (optional)"
          className="w-full rounded-xl border px-3.5 py-2.5 text-sm focus:outline-none"
          style={{ borderColor: `${ROSE}35` }} />
        <button type="submit" disabled={!name.trim() || submitting}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
          style={{ background: ROSE_DEEP }}>
          {submitting ? "Sending…" : "Send Referral →"}
        </button>
      </form>
    </div>
  );
}

// ── Keepsake Mode (du < -3) ───────────────────────────────────────────────────
// The portal's post-wedding life. Replaces all planning tools.
// "Most platforms end on wedding day. Ours doesn't have to."

function marriedDuration(daysSince: number): string {
  if (daysSince < 7)   return `${daysSince} day${daysSince === 1 ? "" : "s"}`;
  if (daysSince < 30)  return `${Math.floor(daysSince / 7)} week${Math.floor(daysSince / 7) === 1 ? "" : "s"}`;
  if (daysSince < 365) {
    const months = Math.floor(daysSince / 30);
    return `${months} month${months === 1 ? "" : "s"}`;
  }
  const years  = Math.floor(daysSince / 365);
  const months = Math.floor((daysSince % 365) / 30);
  return months > 0
    ? `${years} year${years === 1 ? "" : "s"} and ${months} month${months === 1 ? "" : "s"}`
    : `${years} year${years === 1 ? "" : "s"}`;
}

function nextAnniversary(eventDate: string): { date: Date; daysUntil: number; yearNumber: number } {
  const wedding = new Date(eventDate + "T12:00:00");
  const today   = new Date();
  today.setHours(12, 0, 0, 0);

  let anniv = new Date(wedding);
  let year  = 1;
  while (anniv <= today) {
    anniv = new Date(wedding);
    anniv.setFullYear(wedding.getFullYear() + year);
    year++;
  }
  const daysUntil = Math.ceil((anniv.getTime() - today.getTime()) / 86_400_000);
  return { date: anniv, daysUntil, yearNumber: year - 1 };
}

type AnniversaryMessage = { id: string; message: string; yearNumber: number; sentAt: string };

function KeepsakeSection({
  token, du, eventDate, venueName, coupleName,
}: {
  token: string;
  du: number;                  // always negative here
  eventDate: string;
  venueName: string;
  coupleName: string;
}) {
  const daysSince = -du;
  const { daysUntil: daysUntilAnn, yearNumber, date: annivDate } = nextAnniversary(eventDate);
  const luvObs = React.useMemo(
    () => getAnniversaryObservations(daysSince, daysUntilAnn),
    [daysSince, daysUntilAnn],
  );
  const [annivMessages, setAnnivMessages] = React.useState<AnniversaryMessage[]>([]);
  const [postWeddingStatus, setPostWeddingStatus] = React.useState<{
    feedbackSubmitted: boolean;
    feedbackRating:    number;
    referralSubmitted: boolean;
    memoriesCount:     number;
  } | null>(null);

  React.useEffect(() => {
    fetch(`/api/portal/anniversary-messages?token=${token}`)
      .then(r => r.json())
      .then((d: { messages?: AnniversaryMessage[] }) => setAnnivMessages(d.messages ?? []))
      .catch(() => {});
    fetch(`/api/portal/post-wedding-status?token=${token}`)
      .then(r => r.json())
      .then((d: { feedbackSubmitted?: boolean; feedbackRating?: number; referralSubmitted?: boolean; memoriesCount?: number }) => {
        setPostWeddingStatus({
          feedbackSubmitted: d.feedbackSubmitted ?? false,
          feedbackRating:    d.feedbackRating    ?? 0,
          referralSubmitted: d.referralSubmitted ?? false,
          memoriesCount:     d.memoriesCount     ?? 0,
        });
      })
      .catch(() => {});
  }, [token]);

  const ordinal = yearNumber === 1 ? "1st" : yearNumber === 2 ? "2nd" : yearNumber === 3 ? "3rd" : `${yearNumber}th`;
  const isAnniversaryToday = daysUntilAnn === 0;
  const approachingAnn     = daysUntilAnn > 0 && daysUntilAnn <= 30;

  return (
    <div className="space-y-5">

      {/* ── Anniversary hero ── */}
      <div className="rounded-3xl p-7 text-center space-y-3"
        style={{
          background: isAnniversaryToday
            ? `linear-gradient(135deg, ${ROSE}30 0%, #FBF8F5 100%)`
            : `linear-gradient(135deg, ${ROSE}14 0%, #FBF8F5 100%)`,
          border: `1px solid ${ROSE}${isAnniversaryToday ? "50" : "28"}`,
        }}>
        <p className="text-4xl">{isAnniversaryToday ? "🎊" : "💍"}</p>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: ROSE_DEEP }}>
            Married for
          </p>
          <p className="font-heading text-4xl sm:text-5xl text-heading font-medium leading-tight mt-1">
            {marriedDuration(daysSince)}
          </p>
        </div>

        {/* Anniversary countdown or celebration */}
        {isAnniversaryToday ? (
          <p className="text-sm font-medium" style={{ color: ROSE_DEEP }}>
            Happy {ordinal} anniversary. 💗
          </p>
        ) : approachingAnn ? (
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mx-auto"
            style={{ background: `${ROSE}20`, border: `1px solid ${ROSE}40` }}>
            <span className="text-xs font-semibold" style={{ color: ROSE_DEEP }}>
              {ordinal} anniversary in {daysUntilAnn} day{daysUntilAnn === 1 ? "" : "s"} ·{" "}
              {annivDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {ordinal} anniversary · {annivDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        )}
      </div>

      {/* ── Venue anniversary message (if sent) ── */}
      {annivMessages.length > 0 && (
        <div className="rounded-2xl p-5 space-y-3" style={{ background: `color-mix(in srgb, var(--venue-primary) 3%, transparent)`, border: `1px solid color-mix(in srgb, var(--venue-primary) 15%, transparent)` }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: SAGE }}>
            A note from {venueName}
          </p>
          {annivMessages.map(m => (
            <p key={m.id} className="text-sm leading-relaxed text-heading italic">
              "{m.message}"
            </p>
          ))}
        </div>
      )}

      {/* ── Luv anniversary observations ── */}
      {luvObs.length > 0 && (
        <div className="rounded-2xl px-5 py-4 space-y-3"
          style={{ background: "#FDF5F5", border: `1px solid ${ROSE}28` }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: ROSE_DEEP }}>💗 Luv</p>
          {luvObs.map(obs => (
            <p key={obs.id} className="text-sm leading-relaxed" style={{ color: "#5A3235" }}>{obs.text}</p>
          ))}
        </div>
      )}

      {/* ── Keepsake Journey timeline ── */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#E8E3DC" }}>
        <div className="px-5 py-3.5 border-b flex items-center gap-2" style={{ background: "#F7F5F1", borderColor: "#E8E3DC" }}>
          <span>📖</span>
          <p className="text-sm font-semibold text-heading">Your Journey</p>
        </div>
        <div className="divide-y divide-border/40">
          {[
            { emoji: "💍", label: "The engagement", sub: "Before all the planning began", dim: true },
            { emoji: "📋", label: "Planning begins", sub: "Guest lists, budgets, timelines", dim: true },
            { emoji: "✨", label: "Final details", sub: "The last two weeks", dim: true },
            {
              emoji: "🤍",
              label: "Wedding day",
              sub: new Date(eventDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
              dim: false,
              highlight: true,
            },
            {
              emoji: "💗",
              label: daysSince === 0 ? "Today" : `Married ${marriedDuration(daysSince)}`,
              sub: "Right now",
              dim: false,
              current: true,
            },
            {
              emoji: "🎊",
              label: `${ordinal} anniversary`,
              sub: annivDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
              dim: true,
              future: true,
            },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3"
              style={item.current
                ? { background: `${ROSE}06` }
                : item.highlight
                  ? { background: `color-mix(in srgb, var(--venue-primary) 2%, transparent)` }
                  : undefined}>
              <span className="text-base shrink-0 mt-0.5" style={{ opacity: item.dim ? 0.45 : 1 }}>
                {item.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-${item.current || item.highlight ? "semibold" : "medium"}`}
                  style={{ color: item.dim ? "#A09690" : item.current ? ROSE_DEEP : "#2D3020" }}>
                  {item.label}
                  {item.current && <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full align-middle" style={{ background: `${ROSE}20`, color: ROSE_DEEP }}>Now</span>}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
              </div>
              {item.future && (
                <span className="text-[10px] text-muted-foreground shrink-0 mt-1">
                  in {daysUntilAnn}d
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Feedback flow — shows 7+ days post-wedding, once per event ── */}
      {daysSince >= 7 && postWeddingStatus !== null && !postWeddingStatus.feedbackSubmitted && (
        <FeedbackFlow
          token={token}
          venueName={venueName}
          coupleName={coupleName}
          onDone={(rating) =>
            setPostWeddingStatus(prev => prev
              ? { ...prev, feedbackSubmitted: true, feedbackRating: rating }
              : null
            )
          }
        />
      )}

      {/* Already submitted confirmation */}
      {postWeddingStatus?.feedbackSubmitted && daysSince >= 7 && (
        <div className="rounded-2xl p-5 flex items-center gap-3"
          style={{ background: `color-mix(in srgb, var(--venue-primary) 2%, transparent)`, border: `1px solid color-mix(in srgb, var(--venue-primary) 15%, transparent)` }}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: `color-mix(in srgb, var(--venue-primary) 9%, transparent)` }}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke={SAGE}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-heading">Feedback shared. Thank you.</p>
            <p className="text-xs text-muted-foreground">Your words went directly to {venueName}.</p>
          </div>
        </div>
      )}

      {/* ── Referral card — after positive feedback ── */}
      {postWeddingStatus?.feedbackSubmitted &&
        postWeddingStatus.feedbackRating >= 4 &&
        !postWeddingStatus.referralSubmitted && (
          <ReferralCard
            token={token}
            venueName={venueName}
            onDone={() =>
              setPostWeddingStatus(prev => prev ? { ...prev, referralSubmitted: true } : null)
            }
          />
        )}

      {/* ── Memories — always available in keepsake mode ── */}
      <MemoriesSection token={token} venueName={venueName} />

    </div>
  );
}

// ── Wedding Day Mode ──────────────────────────────────────────────────────────
// Three distinct experiences depending on days until:
//   1–14:    Final Details mode  — checklist focus, countdown nudge
//   0:       Wedding Day mode    — emotional, stripped down, ceremony countdown
//   -3–-1:  Just Married mode   — celebration, invitation to revisit journey

type RunOfShowEntry = { id: string; title: string; description: string | null; entryTime: string | null; sortOrder: number };
type PortalContactRow = { id: string; firstName: string; lastName: string | null; role: string; customRoleLabel: string | null; phone?: string | null; email?: string | null };

function fmtPortalTime(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hNum = parseInt(h, 10);
  return `${hNum % 12 || 12}:${m} ${hNum >= 12 ? "PM" : "AM"}`;
}

function ceremonyTimeLabel(entries: RunOfShowEntry[]): { label: string; minutesUntil: number } | null {
  const ceremony = entries.find(e =>
    e.entryTime && /ceremony|processional|i do/i.test(e.title)
  ) ?? entries.find(e => e.entryTime);
  if (!ceremony?.entryTime) return null;
  const [h, m] = ceremony.entryTime.split(":");
  const target = new Date();
  target.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
  const mins = Math.round((target.getTime() - Date.now()) / 60_000);
  if (mins < 0) return null;
  const label = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return { label, minutesUntil: mins };
}

// ── Sub-component: Wedding Day portal (du === 0) ───────────────────────────────

function WeddingDayPortal({
  token, tasks, venueName,
}: {
  token: string;
  tasks: PortalTask[];
  venueName: string;
}) {
  const [entries, setEntries] = React.useState<RunOfShowEntry[]>([]);
  const [contacts, setContacts] = React.useState<PortalContactRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [countdown, setCountdown] = React.useState<ReturnType<typeof ceremonyTimeLabel>>(null);

  React.useEffect(() => {
    Promise.all([
      fetch(`/api/portal/run-of-show?token=${token}`).then(r => r.json()),
      fetch(`/api/portal/participants?token=${token}`).then(r => r.json()),
    ]).then(([ros, parts]) => {
      const rosEntries: RunOfShowEntry[] = (ros as { entries?: RunOfShowEntry[] }).entries ?? [];
      setEntries(rosEntries);
      setContacts((parts as { participants?: PortalContactRow[] }).participants ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  // Live countdown tick
  React.useEffect(() => {
    const tick = () => setCountdown(ceremonyTimeLabel(entries));
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [entries]);

  const weddingDayTasks = tasks.filter(t => t.milestoneKind === "event_day" && t.canComplete && t.status !== "complete");

  // Key Luv messages for today
  const luvMessages = React.useMemo(() => {
    const msgs: string[] = [];
    msgs.push("Take a deep breath. Everything is ready.");
    if (countdown) {
      msgs.push(`Your ceremony begins in ${countdown.label}.`);
    }
    if (weddingDayTasks.length > 0) {
      msgs.push(`${weddingDayTasks.length} thing${weddingDayTasks.length === 1 ? "" : "s"} left on your checklist — you've got this.`);
    }
    msgs.push("Every detail you've planned leads to this moment. Enjoy every second.");
    return msgs;
  }, [countdown, weddingDayTasks.length]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── Ceremony countdown chip ── */}
      {countdown && (
        <div className="rounded-2xl px-5 py-4 text-center space-y-1"
          style={{ background: `linear-gradient(135deg, ${ROSE}18 0%, #FBF8F5 100%)`, border: `1px solid ${ROSE}35` }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: ROSE_DEEP }}>
            💗 Ceremony begins in
          </p>
          <p className="font-heading text-4xl text-heading font-medium">{countdown.label}</p>
          <p className="text-xs text-muted-foreground">Breathe. You are ready.</p>
        </div>
      )}

      {/* ── Luv observations ── */}
      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: "#FDF5F5", border: `1px solid ${ROSE}30` }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: ROSE_DEEP }}>💗 Luv</p>
        {luvMessages.map((msg, i) => (
          <p key={i} className="text-sm leading-relaxed" style={{ color: "#5A3235" }}>{msg}</p>
        ))}
      </div>

      {/* ── Next in timeline ── */}
      {entries.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${ROSE}28` }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: `${ROSE}08` }}>
            <span>✨</span>
            <p className="text-sm font-semibold text-heading">Your Day</p>
          </div>
          <div className="divide-y divide-border/40">
            {entries.map((e, i) => {
              const isFirst = i === 0;
              return (
                <div key={e.id} className={`flex items-start gap-3 px-5 py-3 ${isFirst ? "bg-white" : ""}`}>
                  <div className="shrink-0 w-14 text-right pt-0.5">
                    <p className="text-xs font-semibold" style={{ color: isFirst ? ROSE_DEEP : "#A09690" }}>
                      {fmtPortalTime(e.entryTime)}
                    </p>
                  </div>
                  <div className="shrink-0 mt-1.5">
                    <div className="h-2.5 w-2.5 rounded-full"
                      style={{ background: isFirst ? ROSE : "#DED6CA" }} />
                  </div>
                  <p className={`text-sm leading-snug ${isFirst ? "font-semibold text-heading" : "text-muted-foreground"}`}>
                    {e.title}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Your tasks for today ── */}
      {weddingDayTasks.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#E8E3DC" }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: "#F7F5F1" }}>
            <span>✅</span>
            <p className="text-sm font-semibold text-heading">Your tasks for today</p>
          </div>
          <div className="divide-y divide-border/40">
            {weddingDayTasks.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <div className="h-4 w-4 rounded border-2 shrink-0" style={{ borderColor: "#DED6CA" }} />
                <p className="text-sm text-heading">{t.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Key contacts ── */}
      {contacts.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#E8E3DC" }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ background: "#F7F5F1" }}>
            <span>📱</span>
            <p className="text-sm font-semibold text-heading">Key people today</p>
          </div>
          <div className="divide-y divide-border/40">
            {contacts.slice(0, 5).map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-heading">
                    {[c.firstName, c.lastName].filter(Boolean).join(" ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.customRoleLabel ?? c.role.replace(/_/g, " ")}
                  </p>
                </div>
                {c.phone && (
                  <a href={`tel:${c.phone}`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                    style={{ background: ROSE_DEEP }}>
                    Call
                  </a>
                )}
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t" style={{ borderColor: "#E8E3DC" }}>
            <p className="text-xs text-muted-foreground">
              For anything else, reach your coordinator at {venueName}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main WeddingDaySection ─────────────────────────────────────────────────────

function WeddingDaySection({
  token, tasks, du, venueName,
}: {
  token: string;
  tasks: PortalTask[];
  du: number;
  venueName: string;
}) {
  // ── Just Married (du < 0) ─────────────────────────────────────────────────
  if (du < 0) {
    return (
      <div className="rounded-3xl p-8 text-center space-y-4"
        style={{ background: `linear-gradient(135deg, ${ROSE}16 0%, #FBF8F5 100%)`, border: `1px solid ${ROSE}30` }}>
        <p className="text-5xl">💍</p>
        <p className="font-heading text-3xl text-heading leading-snug">Just Married.</p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
          {-du === 1
            ? "One day married. Everything you planned led to one perfect moment."
            : `${-du} days married. Your planning portal will always be here whenever you want to revisit the journey.`}
        </p>
        <p className="text-xs" style={{ color: `${ROSE_DEEP}80` }}>
          Come back anytime — this space is yours forever.
        </p>
      </div>
    );
  }

  // ── Wedding Day (du === 0) ─────────────────────────────────────────────────
  if (du === 0) {
    return <WeddingDayPortal token={token} tasks={tasks} venueName={venueName} />;
  }

  // ── Final Details phase (du 1–14) ─────────────────────────────────────────
  const finalDetailsTasks = tasks.filter(t => t.milestoneKind === "final_stretch" && t.status !== "complete");
  const countdownObs = getCountdownObservation(du);

  return (
    <div className="space-y-4">
      {/* Luv countdown observation */}
      {countdownObs && (
        <div className="rounded-2xl px-5 py-4 flex items-start gap-3"
          style={{ background: "#FDF5F5", border: `1px solid ${ROSE}30` }}>
          <span style={{ color: ROSE, fontSize: 16, lineHeight: 1.4 }}>💗</span>
          <p className="text-sm leading-relaxed" style={{ color: "#5A3235" }}>{countdownObs.text}</p>
        </div>
      )}

      {/* Final Details task checklist */}
      {finalDetailsTasks.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "#E8E3DC" }}>
          <div className="px-5 py-3 flex items-center justify-between gap-2" style={{ background: "#F7F5F1" }}>
            <div className="flex items-center gap-2">
              <span>✅</span>
              <p className="text-sm font-semibold text-heading">Final Details Checklist</p>
            </div>
            <p className="text-[11px] text-muted-foreground">{du} day{du === 1 ? "" : "s"} to go</p>
          </div>
          <div className="divide-y divide-border/50">
            {finalDetailsTasks.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3">
                <div className="h-4 w-4 rounded border-2 shrink-0"
                  style={{ borderColor: t.status === "complete" ? SAGE : "#DED6CA",
                           background: t.status === "complete" ? SAGE : "white" }}>
                  {t.status === "complete" && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-heading">{t.title}</p>
                  {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
                </div>
                {t.canComplete && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${ROSE}15`, color: ROSE_DEEP }}>
                    Your task
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

function OverviewSection({
  token, context, tasks, guestStats, todoCount, latestJournalEntry, onNavigate,
}: {
  token: string;
  context: PortalContext;
  tasks: PortalTask[];
  guestStats: GuestStats | null;
  todoCount: number;
  latestJournalEntry?: JournalEntry | null;
  onNavigate: (s: PortalSection) => void;
}) {
  const du = context.event ? daysUntil(context.event.eventDate) : null;
  const required = tasks.filter(t => t.isRequired);
  const readinessScore = required.length > 0
    ? Math.round(required.filter(t => t.status === "complete").length / required.length * 100)
    : 0;
  const coupleName = [context.client.firstName, context.client.partnerFirstName].filter(Boolean).join(" & ");
  const bracket = getSuggestionBracket(du);
  const suggestions = (SUGGESTIONS_BY_BRACKET[bracket] ?? []).slice(0, 4);
  // Program 4, Initiative D, Phase 2 (2026-07-23) — the venue's own hero
  // photo, not the couple's; see venues.hero_image_url.
  const venueHeroPhotoUrl = context.venue.heroImageUrl;

  return (
    <div className="space-y-6">

      {/* ── HERO — Program 4, Initiative D, Phase 2/3 (2026-07-23): "The
          hero should no longer emphasize only the couple. Instead it
          should welcome the couple into the venue." Hierarchy is the
          directive's own list, top to bottom: venue photo → venue name →
          welcome message → couple names → countdown → event date →
          tagline → primary actions. One shared content layout regardless
          of whether the venue has uploaded a hero photo (brand-gradient
          fallback otherwise) — the hierarchy doesn't change, only the
          backdrop does. ── */}
      <div className="rounded-3xl overflow-hidden relative" style={{
        background: venueHeroPhotoUrl
          ? `url(${venueHeroPhotoUrl}) center/cover no-repeat`
          : `linear-gradient(155deg, var(--venue-secondary) 0%, var(--venue-primary) 38%, var(--venue-secondary) 100%)`,
        minHeight: "min(64vh, 560px)",
      }}>
        {venueHeroPhotoUrl ? (
          <div className="absolute inset-0" style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.58) 32%, rgba(0,0,0,0.18) 62%, rgba(0,0,0,0.05) 100%)",
          }} />
        ) : (
          <>
            <div className="absolute inset-0" style={{
              backgroundImage: "radial-gradient(circle at 25% 35%, rgba(255,255,255,0.06) 1px, transparent 1px), radial-gradient(circle at 75% 70%, rgba(255,255,255,0.04) 1px, transparent 1px)",
              backgroundSize: "55px 55px, 80px 80px",
            }} />
            <div className="absolute -top-12 -right-12 h-72 w-72 rounded-full pointer-events-none" style={{
              background: `radial-gradient(circle, ${ROSE} 0%, transparent 70%)`, opacity: 0.30, filter: "blur(10px)",
            }} />
            <div className="absolute -bottom-10 -left-10 h-52 w-52 rounded-full pointer-events-none" style={{
              background: `radial-gradient(circle, ${ROSE} 0%, transparent 70%)`, opacity: 0.16, filter: "blur(18px)",
            }} />
            <div className="absolute bottom-0 right-0 pointer-events-none select-none">
              <FloralLineart />
            </div>
          </>
        )}

        <div className="relative flex flex-col justify-end gap-3 p-8 sm:p-10" style={{ minHeight: "min(64vh, 560px)" }}>
          {/* Venue name — first in the hierarchy */}
          <div className="flex items-center gap-2.5">
            <span className="h-px w-5" style={{ background: `${ROSE}60` }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: "rgba(255,255,255,0.75)" }}>
              {context.venue.name}
            </span>
          </div>

          {/* Welcome message */}
          <p className="font-heading italic leading-snug" style={{ color: `${ROSE}D0`, fontSize: "clamp(0.95rem, 2.2vw, 1.2rem)" }}>
            Welcome to your wedding home.
          </p>

          {/* Couple names */}
          <p className="font-heading font-medium text-white leading-[0.92] tracking-tight" style={{ fontSize: "clamp(2.6rem, 7vw, 5.2rem)" }}>
            {coupleName}
          </p>

          {/* Countdown + event date */}
          {context.event && du !== null ? (
            <div className="space-y-0.5 pt-1">
              <p className="font-heading font-semibold text-white" style={{ fontSize: "clamp(1.1rem, 2.6vw, 1.6rem)" }}>
                {du > 0 ? `${du.toLocaleString()} Days Until Your Celebration`
                  : du === 0 ? "Today Is Your Celebration ✦"
                  : `Married ${new Date(context.event.eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`}
              </p>
              {du >= 0 && (
                <p className="font-light tracking-wide" style={{ color: "rgba(255,255,255,0.60)", fontSize: "clamp(0.75rem, 1.6vw, 0.9rem)" }}>
                  {new Date(context.event.eventDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          ) : (
            <p className="text-white/55 text-sm pt-1">Your planning journey has begun.</p>
          )}

          {/* Tagline */}
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            Your venue team is here to guide you every step of the way.
          </p>

          {/* Primary actions */}
          <div className="flex items-center gap-2 flex-wrap pt-2">
            <button type="button" onClick={() => onNavigate("todos")}
              className="text-xs font-semibold px-4 py-2.5 rounded-full text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--venue-primary)" }}>
              Continue Your Journey
            </button>
            <button type="button" onClick={() => onNavigate("tasks")}
              className="text-xs font-medium px-4 py-2.5 rounded-full text-white border transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.08)" }}>
              Review Tasks
            </button>
            <button type="button" onClick={() => onNavigate("messages")}
              className="text-xs font-medium px-4 py-2.5 rounded-full text-white border transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.08)" }}>
              Message Venue
            </button>
            <button type="button" onClick={() => onNavigate("timeline")}
              className="text-xs font-medium px-4 py-2.5 rounded-full text-white border transition-colors"
              style={{ borderColor: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.08)" }}>
              View Timeline
            </button>
          </div>
        </div>
      </div>

      {/* ── Your Venue — Phase 4: the operational relationship, immediately below the hero ── */}
      <YourVenueCards token={token} tasks={tasks} onNavigate={onNavigate} />

      {/* ── Your Wedding — Phase 5: personal planning, intentionally secondary ── */}
      <YourWeddingSection guestStats={guestStats} todoCount={todoCount} onNavigate={onNavigate} />

      {/* ── Luv, daily — one small card, never buried in a desktop-only sidebar ── */}
      <LuvDailyCard token={token} du={du} guestTotal={guestStats?.total ?? 0} readiness={readinessScore} />

      {/* ── Memory Strip — latest journal moment ── */}
      {latestJournalEntry && (
        <MemoryStrip entry={latestJournalEntry} onNavigate={onNavigate} />
      )}

      {/* ── Keepsake Mode — replaces all planning when du < -3 ── */}
      {du !== null && du < -3 && context.event && (
        <KeepsakeSection
          token={token}
          du={du}
          eventDate={context.event.eventDate}
          venueName={context.venue.name}
          coupleName={coupleName}
        />
      )}

      {/* ── Wedding Day Mode — replaces planning cards when ≤ 14 days out ── */}
      {du !== null && du <= 14 && du >= -3 && (
        <WeddingDaySection token={token} tasks={tasks} du={du} venueName={context.venue.name} />
      )}

      {/* ── Your Season — narrative context (planning phase only) ── */}
      {context.event && (du === null || du > 14) && <YourSeasonCard eventDate={context.event.eventDate} />}

      {/* ── Wedding Journey (milestone path — pre-wedding, planning phase only) ── */}
      {context.event && du !== null && du > 14 && (
        <PlanningJourney du={du} readiness={readinessScore} />
      )}

      {/* ── Wedding Snapshot — at-a-glance editorial summary (planning phase only) ── */}
      {(du === null || du > -3) && (
        <WeddingSnapshotCard du={du} guestStats={guestStats} todoCount={todoCount} readinessScore={readinessScore} />
      )}

      {/* Program 4, Initiative D, Phase 8/9 (2026-07-23): the mobile quick-
          cards grid and "Action needed" banner that used to live here are
          gone — both mixed venue-tasks and personal-planning into one
          undifferentiated grid, exactly what "do not intermingle these two
          categories" rules out. YourVenueCards' Next Steps card (visible
          on every breakpoint, not desktop-sidebar-gated) and
          YourWeddingSection above now cover this ground without
          duplicating it. */}

      {/* ── This Month — editorial style (planning phase only) ── */}
      {(du === null || du > 14) && <div className="rounded-3xl overflow-hidden" style={{ background: "linear-gradient(135deg, #F7F5F0 0%, #F0EDE6 100%)", border: "1px solid #E8E2D8" }}>
        <div className="p-6 sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-2" style={{ color: ROSE_DEEP }}>✨ This Month</p>
          <p className="font-heading text-2xl text-heading mb-5 leading-snug">
            {bracket === "12+" ? "Laying a beautiful foundation" :
             bracket === "9-12" ? "Locking in your most important vendors" :
             bracket === "6-9"  ? "The details that make it unforgettable" :
             bracket === "3-6"  ? "Bringing it all together beautifully" :
             bracket === "1-3"  ? "The final, wonderful stretch" :
             "Last touches before the magic begins"}
          </p>
          <div className="space-y-3">
            {suggestions.map(s => (
              <button key={s.title} type="button" onClick={() => onNavigate("todos")}
                className="w-full text-left flex items-center gap-4 group">
                <span className="text-2xl shrink-0 group-hover:scale-110 transition-transform">{s.emoji}</span>
                <div className="flex-1 border-b pb-3" style={{ borderColor: `${ROSE}25` }}>
                  <p className="text-sm font-medium text-heading">{s.title}</p>
                </div>
                <span className="shrink-0 text-[11px] font-medium transition-colors" style={{ color: ROSE_DEEP, opacity: 0.7 }}>+ Add</span>
              </button>
            ))}
          </div>
        </div>
      </div>}

      {/* ── Luv observation — contextual planning nudge (planning phase only) ── */}
      {(du === null || du > 14) && (() => {
        const obs = getOverviewObservation(
          guestStats ? { total: guestStats.total, attending: guestStats.attending } : null,
          readinessScore,
          du,
        );
        if (!obs) return null;
        return (
          <div
            className="rounded-2xl px-5 py-4 flex items-start gap-3"
            style={{ background: "#FDF5F5", border: "1px solid #D8A7AA30" }}
          >
            <span style={{ color: ROSE, fontSize: 16, lineHeight: 1.4 }}>💗</span>
            <p className="text-sm leading-relaxed" style={{ color: "#5A3235" }}>{obs.text}</p>
          </div>
        );
      })()}

      {/* ── Next Big Moment — surfaces most relevant next step (planning phase only) ── */}
      {(du === null || du > 14) && (
        <NextBigMomentCard bracket={bracket} guestTotal={guestStats?.total ?? 0} onNavigate={onNavigate} />
      )}

      {/* ── Wedding Journey Milestones — anchors the left column, balances sidebar height ── */}
      <WeddingJourneySection guestStats={guestStats} />

    </div>
  );
}

// ── Memory Strip ─────────────────────────────────────────────────────────────

function MemoryStrip({
  entry, onNavigate,
}: {
  entry: JournalEntry | null;
  onNavigate: (s: PortalSection) => void;
}) {
  if (!entry) return null;

  return (
    <button type="button" onClick={() => onNavigate("story")}
      className="w-full text-left rounded-2xl flex items-center gap-4 p-4 group transition-all hover:shadow-sm"
      style={{ background: `${ROSE}08`, border: `1px solid ${ROSE}22` }}>

      {/* Photo or icon */}
      {entry.mediaUrl ? (
        <img src={entry.mediaUrl} alt=""
          className="w-16 h-16 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 text-2xl"
          style={{ background: `${ROSE}18` }}>
          {entry.source === "auto" ? "✦" : "📖"}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: ROSE_DEEP }}>
          💗 A Moment From Your Journey
        </p>
        {entry.title && (
          <p className="text-sm font-semibold text-heading leading-snug truncate">{entry.title}</p>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{entry.body}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{formatEntryDate(entry.entryDate)}</p>
        <p className="text-[10px] font-semibold mt-2 group-hover:underline" style={{ color: ROSE_DEEP }}>
          View your journey →
        </p>
      </div>
    </button>
  );
}

// ── Personal To-Do ────────────────────────────────────────────────────────────

const TODO_CATEGORIES: { value: TodoCategory; label: string }[] = [
  { value: "venue", label: "Venue" }, { value: "attire", label: "Attire" },
  { value: "florals", label: "Florals" }, { value: "music", label: "Music" },
  { value: "catering", label: "Catering" }, { value: "photography", label: "Photography" },
  { value: "travel", label: "Travel" }, { value: "invitations", label: "Invitations" },
  { value: "beauty", label: "Beauty" }, { value: "other", label: "Other" },
];

// Dynamic to-do suggestions by time bracket.
// "No ML required. Just thoughtful, curated guidance."
const SUGGESTIONS_BY_BRACKET: Record<string, { title: string; category: TodoCategory; emoji: string }[]> = {
  "12+": [
    { title: "Book photographer", category: "photography", emoji: "📷" },
    { title: "Book videographer", category: "photography", emoji: "🎬" },
    { title: "Choose ceremony venue", category: "venue", emoji: "🌿" },
    { title: "Set a wedding budget", category: "other", emoji: "💰" },
    { title: "Create your guest list", category: "other", emoji: "👥" },
    { title: "Start venue research", category: "venue", emoji: "🏡" },
    { title: "Schedule engagement photos", category: "photography", emoji: "💗" },
    { title: "Choose your wedding date", category: "other", emoji: "📅" },
  ],
  "9-12": [
    { title: "Book florist", category: "florals", emoji: "🌸" },
    { title: "Book caterer or confirm venue catering", category: "catering", emoji: "🍽️" },
    { title: "Book officiant", category: "other", emoji: "📜" },
    { title: "Start dress shopping", category: "attire", emoji: "👗" },
    { title: "Book transportation", category: "travel", emoji: "🚗" },
    { title: "Research honeymoon destinations", category: "travel", emoji: "✈️" },
    { title: "Choose your wedding party", category: "other", emoji: "💗" },
    { title: "Schedule suit fittings", category: "attire", emoji: "🤵" },
  ],
  "6-9": [
    { title: "Order wedding invitations", category: "invitations", emoji: "✉️" },
    { title: "Reserve hotel block for guests", category: "travel", emoji: "🏨" },
    { title: "Book hair & makeup", category: "beauty", emoji: "💄" },
    { title: "Plan rehearsal dinner", category: "other", emoji: "🍷" },
    { title: "Book honeymoon travel", category: "travel", emoji: "✈️" },
    { title: "Order wedding cake", category: "catering", emoji: "🎂" },
    { title: "Choose ceremony music", category: "music", emoji: "🎵" },
    { title: "Schedule dress fitting", category: "attire", emoji: "👗" },
  ],
  "3-6": [
    { title: "Address and mail invitations", category: "invitations", emoji: "📬" },
    { title: "Finalize guest list", category: "other", emoji: "✅" },
    { title: "Plan wedding day timeline", category: "other", emoji: "📋" },
    { title: "Confirm all vendor bookings", category: "other", emoji: "📞" },
    { title: "Schedule makeup trial", category: "beauty", emoji: "💄" },
    { title: "Arrange guest transportation", category: "travel", emoji: "🚌" },
    { title: "Create wedding website", category: "other", emoji: "🌐" },
    { title: "Order wedding favors", category: "other", emoji: "🎁" },
  ],
  "1-3": [
    { title: "Write personal vows", category: "other", emoji: "📝" },
    { title: "Schedule rehearsal dinner", category: "other", emoji: "🍽️" },
    { title: "Confirm vendor arrival times", category: "other", emoji: "⏰" },
    { title: "Finalize seating arrangements", category: "other", emoji: "🪑" },
    { title: "Send final guest count to caterer", category: "catering", emoji: "🍽️" },
    { title: "Prepare ceremony programs", category: "invitations", emoji: "📄" },
    { title: "Break in wedding shoes", category: "attire", emoji: "👠" },
    { title: "Pack an emergency kit", category: "other", emoji: "🧴" },
  ],
  "<1": [
    { title: "Write vows (final version)", category: "other", emoji: "💌" },
    { title: "Pack overnight bag", category: "other", emoji: "🧳" },
    { title: "Confirm wedding day timeline with all vendors", category: "other", emoji: "📋" },
    { title: "Prepare tips for vendors", category: "other", emoji: "💵" },
    { title: "Arrange day-of emergency contact list", category: "other", emoji: "📱" },
    { title: "Get a good night's sleep the night before", category: "other", emoji: "😴" },
  ],
};

function getSuggestionBracket(daysUntil: number | null): string {
  if (daysUntil === null || daysUntil > 365) return "12+";
  if (daysUntil > 270) return "9-12";
  if (daysUntil > 180) return "6-9";
  if (daysUntil > 90) return "3-6";
  if (daysUntil > 30) return "1-3";
  return "<1";
}

function getBracketLabel(bracket: string): string {
  const labels: Record<string, string> = {
    "12+": "12+ months out — laying the foundation",
    "9-12": "9–12 months out — the big decisions",
    "6-9": "6–9 months out — invitations and details",
    "3-6": "3–6 months out — finalizing everything",
    "1-3": "1–3 months out — the final stretch",
    "<1": "Less than a month to go — last touches",
  };
  return labels[bracket] ?? "Suggested for your planning stage";
}

function TodoSection({ token, onCountChange, eventDate }: { token: string; onCountChange?: (n: number) => void; eventDate?: string | null }) {
  const [todos, setTodos] = React.useState<CoupleTodo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAdd, setShowAdd] = React.useState(false);
  const [addTitle, setAddTitle] = React.useState("");
  const [addNotes, setAddNotes] = React.useState("");
  const [addCategory, setAddCategory] = React.useState<string>("");
  const [addDue, setAddDue] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/portal/todos?token=${token}`)
      .then(r => r.json())
      .then((d: { todos?: CoupleTodo[] }) => {
        const t = d.todos ?? [];
        setTodos(t);
        onCountChange?.(t.filter(x => !x.completed).length);
      })
      .finally(() => setLoading(false));
  }, [token, onCountChange]);

  async function handleAdd() {
    if (!addTitle.trim()) return;
    setAdding(true);
    const res = await fetch("/api/portal/todos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, title: addTitle.trim(), notes: addNotes.trim() || undefined, category: addCategory || undefined, dueDate: addDue || undefined }) });
    const data = await res.json() as { ok: boolean; todoId?: string };
    if (data.ok) {
      const newTodo: CoupleTodo = { id: data.todoId!, title: addTitle.trim(), notes: addNotes.trim() || null, dueDate: addDue || null, category: (addCategory as TodoCategory) || null, completed: false, completedAt: null };
      setTodos(t => [newTodo, ...t]);
      onCountChange?.(todos.filter(x => !x.completed).length + 1);
      setAddTitle(""); setAddNotes(""); setAddCategory(""); setAddDue(""); setShowAdd(false);
    }
    setAdding(false);
  }

  async function handleToggle(todo: CoupleTodo) {
    const next = !todo.completed;
    const prevTodos = todos;
    setTodos(t => t.map(x => x.id === todo.id ? { ...x, completed: next, completedAt: next ? new Date().toISOString() : null } : x));
    onCountChange?.(todos.filter(x => !x.completed).length + (next ? -1 : 1));
    try {
      const res = await fetch("/api/portal/todos", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, todoId: todo.id, completed: next }) });
      if (!res.ok) throw new Error("Update failed");
    } catch {
      setTodos(prevTodos);
      toast.error("Could not update task. Please try again.");
    }
  }

  async function handleDelete(todoId: string) {
    const prevTodos = todos;
    setTodos(t => t.filter(x => x.id !== todoId));
    try {
      const res = await fetch("/api/portal/todos", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, todoId }) });
      if (!res.ok) throw new Error("Delete failed");
    } catch {
      setTodos(prevTodos);
      toast.error("Could not delete task. Please try again.");
    }
  }

  const open = todos.filter(t => !t.completed);
  const done = todos.filter(t => t.completed);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Your personal planning checklist — separate from tasks assigned by the venue.</p>

      {loading ? <p className="text-sm text-muted-foreground text-center py-6">Loading…</p> : (
        <>
          {todos.length === 0 && !showAdd ? (
            <div className="rounded-2xl border border-dashed border-border py-10 text-center space-y-2">
              <CheckSquare className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium text-heading">Your planning list is empty</p>
              <p className="text-xs text-muted-foreground">Add "Book florist", "Choose dress", or anything you need to track.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {open.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-muted/30 group">
                  <button type="button" onClick={() => handleToggle(t)}
                    className="shrink-0 h-5 w-5 rounded border border-border flex items-center justify-center hover:border-primary transition-colors">
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-heading">{t.title}</p>
                    {t.notes && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 whitespace-pre-line">{t.notes}</p>
                    )}
                    {(t.dueDate || t.category) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t.category && <span className="capitalize">{t.category}</span>}
                        {t.category && t.dueDate && <span> · </span>}
                        {t.dueDate && <span>Due {formatDate(t.dueDate)}</span>}
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => handleDelete(t.id)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive rounded">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {done.length > 0 && (
                <div className="pt-2 border-t border-border/50 space-y-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide px-3 py-1">Completed ({done.length})</p>
                  {done.map(t => (
                    <div key={t.id} className="flex items-center gap-3 py-2 px-3 rounded-xl opacity-50">
                      <button type="button" onClick={() => handleToggle(t)} className="shrink-0 h-5 w-5 rounded border flex items-center justify-center" style={{ background: SAGE, borderColor: SAGE }}>
                        <Check className="h-3 w-3 text-white" />
                      </button>
                      <p className="text-sm text-muted-foreground line-through">{t.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showAdd ? (
            <div className="rounded-2xl border border-ring bg-card p-4 space-y-3">
              <input value={addTitle} onChange={e => setAddTitle(e.target.value)} placeholder="What needs to get done? *" autoFocus
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              <textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} placeholder="Notes or details (optional)"
                rows={2}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
              <div className="flex gap-2">
                <select value={addCategory} onChange={e => setAddCategory(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Category…</option>
                  {TODO_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input type="date" value={addDue} onChange={e => setAddDue(e.target.value)}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowAdd(false)} className="text-sm text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted">Cancel</button>
                <button type="button" onClick={handleAdd} disabled={!addTitle.trim() || adding}
                  className="text-sm font-medium px-4 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: SAGE }}>
                  {adding ? "Adding…" : "Add To-Do"}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl border border-border hover:bg-muted/40 transition-colors">
              <Plus className="h-4 w-4" /> Add To-Do
            </button>
          )}

          {/* Dynamic to-do suggestions — time-bracket aware */}
          {todos.length === 0 && !showAdd && (
            <div className="rounded-2xl border border-border/50 bg-muted/20 p-4 space-y-3">
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Suggested for your stage</p>
                {eventDate && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    💗 {getBracketLabel(getSuggestionBracket(daysUntil(eventDate)))}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(SUGGESTIONS_BY_BRACKET[getSuggestionBracket(eventDate ? daysUntil(eventDate) : null)] ?? SUGGESTIONS_BY_BRACKET["6-9"])
                  .filter(s => !todos.some(t => t.title.toLowerCase().includes(s.title.toLowerCase().slice(0, 12))))
                  .slice(0, 8)
                  .map(s => (
                  <button key={s.title} type="button"
                    onClick={async () => {
                      const res = await fetch("/api/portal/todos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, title: s.title, category: s.category }) });
                      const data = await res.json() as { ok: boolean; todoId?: string };
                      if (data.ok) {
                        const newTodo: CoupleTodo = { id: data.todoId!, title: s.title, notes: null, dueDate: null, category: s.category as TodoCategory, completed: false, completedAt: null };
                        setTodos(t => [...t, newTodo]);
                        onCountChange?.(1);
                      }
                    }}
                    className="text-left text-xs px-3 py-2.5 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors text-heading flex items-center gap-1.5">
                    <span>{s.emoji}</span><span>+ {s.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Our People ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  partner:        "Partner",
  parent:         "Parent",
  wedding_planner:"Wedding Planner",
  maid_of_honor:  "Maid of Honor",
  best_man:       "Best Man",
  family_member:  "Family Member",
  friend:         "Friend",
  custom:         "Custom",
};

const PERMISSION_META: Record<string, { label: string; desc: string; color: string }> = {
  full:      { label: "Full Access",        desc: "Everything except venue administration.",             color: SAGE      },
  planning:  { label: "Planning Access",    desc: "Planning, website, guest list, and to-dos.",         color: "#7B9E87" },
  financial: { label: "Financial Access",   desc: "Payments and invoices only.",                        color: TAUPE     },
  website:   { label: "Website Contributor",desc: "Website editing and RSVP management.",               color: ROSE_DEEP },
  view_only: { label: "View Only",          desc: "Can view but cannot edit.",                          color: "#A0A0A0" },
};

function avatarInitials(firstName: string, lastName?: string | null) {
  return [(firstName[0] ?? ""), (lastName?.[0] ?? "")].filter(Boolean).join("").toUpperCase();
}

function avatarBg(name: string) {
  const palettes = [`color-mix(in srgb, var(--venue-primary) 16%, transparent)`, `${ROSE}28`, "#E8E2D855", "#D4C9BE44"];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return palettes[h % palettes.length];
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  if (days <  7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function OurPeopleSection({ token, context }: { token: string; context: PortalContext }) {
  const [participants, setParticipants] = React.useState<PortalParticipant[]>([]);
  const [activity, setActivity]         = React.useState<PortalActivity[]>([]);
  const [loading, setLoading]           = React.useState(true);

  // Invite form
  const [showInvite, setShowInvite]         = React.useState(false);
  const [inviteFirst, setInviteFirst]       = React.useState("");
  const [inviteLast, setInviteLast]         = React.useState("");
  const [inviteEmail, setInviteEmail]       = React.useState("");
  const [inviteRole, setInviteRole]         = React.useState("friend");
  const [inviteCustomRole, setInviteCustomRole] = React.useState("");
  const [invitePermission, setInvitePermission] = React.useState("planning");
  const [inviting, setInviting]             = React.useState(false);

  // Edit participant
  const [editingId, setEditingId]                   = React.useState<string | null>(null);
  const [editRole, setEditRole]                     = React.useState("");
  const [editCustomRole, setEditCustomRole]         = React.useState("");
  const [editPermission, setEditPermission]         = React.useState("");
  const [editNotifyPlanning, setEditNotifyPlanning] = React.useState(true);
  const [editNotifyPayments, setEditNotifyPayments] = React.useState(false);
  const [editNotifyWebsite, setEditNotifyWebsite]   = React.useState(true);
  const [editNotifyRsvps, setEditNotifyRsvps]       = React.useState(true);
  const [saving, setSaving]     = React.useState(false);
  const [removing, setRemoving] = React.useState<string | null>(null);

  const coupleName = [context.client.firstName, context.client.partnerFirstName].filter(Boolean).join(" & ");

  React.useEffect(() => {
    fetch(`/api/portal/participants?token=${token}`)
      .then(r => r.json())
      .then((d: { participants?: PortalParticipant[]; activity?: PortalActivity[] }) => {
        setParticipants(d.participants ?? []);
        setActivity(d.activity ?? []);
      })
      .finally(() => setLoading(false));
  }, [token]);

  function openEdit(p: PortalParticipant) {
    setEditingId(p.id);
    setEditRole(p.role);
    setEditCustomRole(p.customRoleLabel ?? "");
    setEditPermission(p.permissionLevel);
    setEditNotifyPlanning(p.notifyPlanning);
    setEditNotifyPayments(p.notifyPayments);
    setEditNotifyWebsite(p.notifyWebsite);
    setEditNotifyRsvps(p.notifyRsvps);
  }

  function resetInviteForm() {
    setShowInvite(false);
    setInviteFirst(""); setInviteLast(""); setInviteEmail("");
    setInviteRole("friend"); setInviteCustomRole(""); setInvitePermission("planning");
  }

  async function handleInvite() {
    if (!inviteFirst.trim() || !inviteEmail.trim()) return;
    setInviting(true);
    const res = await fetch("/api/portal/participants", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token,
        email: inviteEmail.trim(),
        firstName: inviteFirst.trim(),
        lastName: inviteLast.trim() || undefined,
        role: inviteRole,
        customRoleLabel: inviteRole === "custom" ? inviteCustomRole : undefined,
        permissionLevel: invitePermission,
      }),
    });
    const data = await res.json() as { ok: boolean; participantId?: string; error?: string };
    setInviting(false);
    if (data.ok) {
      toast.success(`Invitation sent to ${inviteFirst.trim()}.`);
      const newP: PortalParticipant = {
        id: data.participantId ?? crypto.randomUUID(),
        firstName: inviteFirst.trim(), lastName: inviteLast.trim() || null,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole as PortalParticipant["role"],
        customRoleLabel: inviteRole === "custom" ? inviteCustomRole : null,
        permissionLevel: invitePermission as PortalParticipant["permissionLevel"],
        notifyPlanning: true, notifyPayments: false, notifyWebsite: true, notifyRsvps: true,
        inviteStatus: "pending", invitedAt: new Date().toISOString(), acceptedAt: null,
      };
      setParticipants(p => [newP, ...p]);
      setActivity(a => [{
        id: crypto.randomUUID(), activityType: "participant_invited",
        actorName: inviteFirst.trim(),
        detailText: `${inviteFirst.trim()} was invited to join your planning workspace.`,
        createdAt: new Date().toISOString(),
      }, ...a]);
      resetInviteForm();
    } else {
      toast.error(data.error ?? "Could not send invitation.");
    }
  }

  async function handleSaveEdit() {
    if (!editingId) return;
    setSaving(true);
    const res = await fetch("/api/portal/participants", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token, participantId: editingId,
        role: editRole, customRoleLabel: editRole === "custom" ? editCustomRole : "",
        permissionLevel: editPermission,
        notifyPlanning: editNotifyPlanning, notifyPayments: editNotifyPayments,
        notifyWebsite: editNotifyWebsite, notifyRsvps: editNotifyRsvps,
      }),
    });
    const data = await res.json() as { ok: boolean };
    setSaving(false);
    if (data.ok) {
      setParticipants(p => p.map(x => x.id !== editingId ? x : {
        ...x,
        role: editRole as PortalParticipant["role"],
        customRoleLabel: editRole === "custom" ? editCustomRole : null,
        permissionLevel: editPermission as PortalParticipant["permissionLevel"],
        notifyPlanning: editNotifyPlanning, notifyPayments: editNotifyPayments,
        notifyWebsite: editNotifyWebsite, notifyRsvps: editNotifyRsvps,
      }));
      setEditingId(null);
    } else {
      toast.error("Could not save changes.");
    }
  }

  async function handleRemove(p: PortalParticipant) {
    setRemoving(p.id);
    const res = await fetch("/api/portal/participants", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, participantId: p.id }),
    });
    const data = await res.json() as { ok: boolean };
    setRemoving(null);
    if (data.ok) {
      setParticipants(prev => prev.filter(x => x.id !== p.id));
      toast.success(`${p.firstName}'s access has been removed.`);
    } else {
      toast.error("Could not remove participant.");
    }
  }

  function roleLabel(p: PortalParticipant) {
    if (p.role === "custom" && p.customRoleLabel) return p.customRoleLabel;
    return ROLE_LABELS[p.role] ?? p.role;
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="rounded-3xl p-6" style={{ background: `linear-gradient(135deg, ${ROSE}10 0%, #FAF8F5 100%)`, border: `1px solid ${ROSE}25` }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1.5" style={{ color: ROSE_DEEP }}>💗 Your People</p>
        <p className="font-heading text-xl text-heading leading-snug mb-2">Who is helping you plan your celebration?</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Invite family members, your wedding planner, or anyone you'd like to share parts of your planning experience with. You control what each person can see and do.
        </p>
      </div>

      {/* Primary couple */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2 px-1">Primary</p>
        <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
            style={{ background: `color-mix(in srgb, var(--venue-primary) 13%, transparent)`, color: SAGE }}>
            {avatarInitials(context.client.firstName, context.client.lastName)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-heading">{coupleName}</p>
            <p className="text-xs text-muted-foreground">Couple · Primary contact</p>
          </div>
          <span className="shrink-0 text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `color-mix(in srgb, var(--venue-primary) 8%, transparent)`, color: SAGE }}>Full Access</span>
        </div>
      </div>

      {/* Participants */}
      {loading ? (
        <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></div>
      ) : participants.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2 px-1">Planning Team</p>
          <div className="space-y-2">
            {participants.map(p => {
              const isEditing = editingId === p.id;
              const meta = PERMISSION_META[p.permissionLevel] ?? PERMISSION_META.planning;
              return (
                <div key={p.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="p-4 flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
                      style={{ background: avatarBg(p.firstName), color: SAGE }}>
                      {avatarInitials(p.firstName, p.lastName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-heading">{[p.firstName, p.lastName].filter(Boolean).join(" ")}</p>
                        {p.inviteStatus === "pending"  && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${ROSE}15`, color: ROSE_DEEP }}>Pending</span>}
                        {p.inviteStatus === "accepted" && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `color-mix(in srgb, var(--venue-primary) 8%, transparent)`, color: SAGE }}>Joined ✓</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{roleLabel(p)} · {p.email}</p>
                      <span className="inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: `${meta.color}18`, color: meta.color }}>{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button type="button" onClick={() => isEditing ? setEditingId(null) : openEdit(p)}
                        className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                        style={{ color: SAGE }}>{isEditing ? "Close" : "Edit"}</button>
                      <button type="button" onClick={() => handleRemove(p)} disabled={removing === p.id}
                        className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors text-muted-foreground hover:text-destructive">
                        {removing === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div className="border-t border-border/50 p-4 space-y-4" style={{ background: "#FAF9F7" }}>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Role</p>
                          <select value={editRole} onChange={e => setEditRole(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none">
                            {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                          {editRole === "custom" && (
                            <input value={editCustomRole} onChange={e => setEditCustomRole(e.target.value)} placeholder="Custom role label"
                              className="mt-1.5 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none" />
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Permissions</p>
                          <select value={editPermission} onChange={e => setEditPermission(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none">
                            {Object.entries(PERMISSION_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                          </select>
                          <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{PERMISSION_META[editPermission]?.desc}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Notifications</p>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            ["Planning reminders", editNotifyPlanning, setEditNotifyPlanning],
                            ["Payment reminders",  editNotifyPayments, setEditNotifyPayments],
                            ["Website updates",    editNotifyWebsite,  setEditNotifyWebsite],
                            ["RSVP updates",       editNotifyRsvps,    setEditNotifyRsvps],
                          ] as [string, boolean, React.Dispatch<React.SetStateAction<boolean>>][]).map(([label, val, set]) => (
                            <label key={label} className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={val} onChange={e => set(e.target.checked)}
                                className="h-3.5 w-3.5 rounded" style={{ accentColor: SAGE }} />
                              <span className="text-xs text-heading">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={() => setEditingId(null)}
                          className="text-xs text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted">Cancel</button>
                        <button type="button" onClick={handleSaveEdit} disabled={saving}
                          className="text-xs font-semibold px-4 py-1.5 rounded-lg text-white disabled:opacity-50"
                          style={{ background: SAGE }}>
                          {saving ? "Saving…" : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Invite form / button */}
      {showInvite ? (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <p className="text-sm font-semibold text-heading">Invite someone to help plan</p>
          <div className="grid grid-cols-2 gap-3">
            <input value={inviteFirst} onChange={e => setInviteFirst(e.target.value)} placeholder="First name *" autoFocus
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
            <input value={inviteLast} onChange={e => setInviteLast(e.target.value)} placeholder="Last name"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email address *"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Role</p>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none">
                {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {inviteRole === "custom" && (
                <input value={inviteCustomRole} onChange={e => setInviteCustomRole(e.target.value)} placeholder="e.g. Mother of the Bride"
                  className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Access Level</p>
              <select value={invitePermission} onChange={e => setInvitePermission(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none">
                {Object.entries(PERMISSION_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
              </select>
              <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{PERMISSION_META[invitePermission]?.desc}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={resetInviteForm}
              className="text-sm text-muted-foreground px-3 py-2 rounded-xl hover:bg-muted">Cancel</button>
            <button type="button" onClick={handleInvite} disabled={!inviteFirst.trim() || !inviteEmail.trim() || inviting}
              className="text-sm font-semibold px-5 py-2 rounded-xl text-white disabled:opacity-50 flex items-center gap-2"
              style={{ background: ROSE }}>
              {inviting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</> : "Send Invitation 💗"}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setShowInvite(true)}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed py-4 text-sm font-medium transition-colors hover:bg-muted/30"
          style={{ borderColor: `${ROSE}50`, color: ROSE_DEEP }}>
          <Plus className="h-4 w-4" /> Invite Someone
        </button>
      )}

      {/* Activity feed */}
      {activity.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">✨ Recent Activity</p>
          <div className="space-y-2.5">
            {activity.map(a => (
              <div key={a.id} className="flex items-start gap-2.5">
                <span className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0" style={{ background: ROSE }} />
                <p className="flex-1 text-xs text-heading leading-relaxed">{a.detailText}</p>
                <p className="text-[10px] text-muted-foreground shrink-0 pl-2">{relativeTime(a.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Venue transparency note */}
      <p className="text-[10px] text-muted-foreground text-center leading-relaxed px-4">
        Your venue can see who has access to your workspace, but cannot view your private planning content or modify your team.
      </p>
    </div>
  );
}

// ── Website Section ───────────────────────────────────────────────────────────

function WebsiteSection({ token, context }: { token: string; context: PortalContext }) {
  const [site, setSite] = React.useState<import("@/lib/wedding-website/types").CoupleWebsite | null>(null);
  const [loading, setLoading] = React.useState(true);
  // Hooks must all be before any early returns (Rules of Hooks)
  const [guestData, setGuestData] = React.useState<{ guests: { id: string; firstName: string; lastName: string | null; email: string | null; rsvpStatus: string; rsvpSentAt?: string | null }[] } | null>(null);
  const defaultSlug = [context.client.firstName, context.client.partnerFirstName]
    .filter(Boolean).join("-and-").toLowerCase().replace(/[^a-z0-9-]/g, "") + "-wedding";

  React.useEffect(() => {
    fetch(`/api/portal/website?token=${token}`)
      .then(r => r.json())
      .then((d: import("@/lib/wedding-website/types").CoupleWebsite) => {
        if (!d.exists || !d.slug) {
          fetch("/api/portal/website", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, slug: defaultSlug }) })
            .then(r => r.json())
            .then(() => fetch(`/api/portal/website?token=${token}`).then(r => r.json()).then(setSite));
        } else {
          setSite(d);
        }
      })
      .finally(() => setLoading(false));
  }, [token, defaultSlug]);

  React.useEffect(() => {
    fetch(`/api/portal/guests?token=${token}`)
      .then(r => r.json())
      .then(setGuestData);
  }, [token]);

  if (loading || !site) {
    return <div className="py-12 text-center"><p className="text-sm text-muted-foreground">Loading your website…</p></div>;
  }

  const { WebsiteStudio } = require("@/components/portal/website-studio");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="h-full overflow-hidden">
      <WebsiteStudio token={token} initialSite={site} origin={origin} initialGuests={guestData?.guests} context={context} />
    </div>
  );
}

// ── Guest section (lazy) ──────────────────────────────────────────────────────

function GuestPortalSection({ token }: { token: string }) {
  const { GuestSection } = require("@/components/portal/guest-section") as { GuestSection: React.ComponentType<{ token: string }> };
  return <GuestSection token={token} />;
}

// ── Vendor recommendations ────────────────────────────────────────────────────

function VendorPortalSection({ token, context }: { token: string; context: PortalContext }) {
  const { VendorSection } = require("@/components/portal/vendor-section") as { VendorSection: React.ComponentType<{ token: string; clientId: string; venueName: string }> };
  return <VendorSection token={token} clientId={context.client.id} venueName={context.venue.name} />;
}

// ── Budget planner ────────────────────────────────────────────────────────────

function BudgetPortalSection({ token }: { token: string }) {
  const { BudgetSection } = require("@/components/portal/budget-section") as { BudgetSection: React.ComponentType<{ token: string }> };
  return <BudgetSection token={token} />;
}

// ── Seating chart ────────────────────────────────────────────────────────────

function SeatingPortalSection({ token }: { token: string }) {
  const SeatingSection = require("@/components/portal/seating-section").default as React.ComponentType<{ token: string }>;
  return <SeatingSection token={token} />;
}

// ── Couple documents ──────────────────────────────────────────────────────────

function CoupleDocumentsPortalSection({ token, onNavigate }: { token: string; onNavigate: (s: PortalSection) => void }) {
  const CoupleDocumentsSection = require("@/components/portal/couple-documents-section").default as React.ComponentType<{ token: string; onNavigate: (s: PortalSection) => void }>;
  return <CoupleDocumentsSection token={token} onNavigate={onNavigate} />;
}

// ── Client Timeline (same Booking Timeline, visibility-filtered) ──────────────

function TimelinePortalSection({
  token, clientId, initialSections, initialEntries, initialLastSubmittedAt, initialHasUnpublishedChanges,
}: {
  token: string; clientId: string;
  initialSections: PortalTimelineSection[]; initialEntries: PortalTimelineEntry[];
  initialLastSubmittedAt: string | null; initialHasUnpublishedChanges: boolean;
}) {
  const { TimelineSection } = require("@/components/portal/timeline-section") as {
    TimelineSection: React.ComponentType<{
      token: string; clientId: string;
      initialSections: PortalTimelineSection[]; initialEntries: PortalTimelineEntry[];
      initialLastSubmittedAt: string | null; initialHasUnpublishedChanges: boolean;
    }>;
  };
  return (
    <TimelineSection
      token={token} clientId={clientId}
      initialSections={initialSections} initialEntries={initialEntries}
      initialLastSubmittedAt={initialLastSubmittedAt} initialHasUnpublishedChanges={initialHasUnpublishedChanges}
    />
  );
}

// ── Ask Luv ───────────────────────────────────────────────────────────────────

function LuvAskPortalSection({ token, onNavigateToGuide }: { token: string; onNavigateToGuide?: () => void }) {
  const { LuvAskSection } = require("@/components/portal/luv-ask-section") as {
    LuvAskSection: React.ComponentType<{ token: string; onNavigateToGuide?: () => void }>;
  };
  return <LuvAskSection token={token} onNavigateToGuide={onNavigateToGuide} />;
}

function VenueGuidePortalSection({ token, context, onNavigate }: { token: string; context: PortalContext; onNavigate: (s: PortalSection) => void }) {
  const { VenueGuideSection } = require("@/components/portal/venue-guide-section") as { VenueGuideSection: React.ComponentType<{ token: string; context: PortalContext; onNavigate: (s: PortalSection) => void }> };
  return <VenueGuideSection token={token} context={context} onNavigate={onNavigate} />;
}

function PortalMessageSection({ token, venueName }: { token: string; venueName: string }) {
  const { PortalMessageSection: MessageSection } = require("@/components/portal/message-section") as { PortalMessageSection: React.ComponentType<{ token: string; venueName: string }> };
  return <MessageSection token={token} venueName={venueName} />;
}

// ── Payments ──────────────────────────────────────────────────────────────────

function PaymentPortalSection({ token }: { token: string }) {
  const { PaymentSection } = require("@/components/portal/payment-section") as { PaymentSection: React.ComponentType<{ token: string }> };
  return <PaymentSection token={token} />;
}

// ── Coming soon ───────────────────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-16 text-center px-6 space-y-2">
      <p className="text-2xl">💗</p>
      <p className="text-sm font-medium text-heading capitalize">{label} coming soon</p>
      <p className="text-xs text-muted-foreground max-w-xs mx-auto">Your coordinator will share access when this section is ready.</p>
    </div>
  );
}

// ── Our Story ─────────────────────────────────────────────────────────────────

const INSPO_CATEGORIES: { key: string; label: string; emoji: string }[] = [
  { key: "florals",     label: "Florals",     emoji: "🌸" },
  { key: "fashion",     label: "Fashion",     emoji: "👗" },
  { key: "cake",        label: "Cake",        emoji: "🎂" },
  { key: "decor",       label: "Décor",       emoji: "✨" },
  { key: "photography", label: "Photography", emoji: "📷" },
  { key: "colors",      label: "Colors",      emoji: "🎨" },
  { key: "stationery",  label: "Stationery",  emoji: "💌" },
  { key: "inspiration", label: "Other",       emoji: "🌟" },
];

function EngagementPhotoGrid({
  photos, heroPhotoId, uploading, onUpload, onSetHero, onDelete, deletingId,
}: {
  photos: ClientMedia[];
  heroPhotoId?: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  onSetHero: (id: string, url: string) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      {photos.length === 0 ? (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full rounded-2xl border-2 border-dashed py-12 flex flex-col items-center gap-3 transition-colors hover:bg-muted/20"
          style={{ borderColor: `${ROSE}40` }}>
          {uploading
            ? <div className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
            : <span className="text-4xl">📸</span>}
          <p className="text-sm text-heading font-medium">Upload your engagement photos</p>
          <p className="text-xs text-muted-foreground">They make this space feel truly yours.</p>
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map(photo => {
            const isHero = heroPhotoId === photo.id;
            return (
              <div key={photo.id} className="relative rounded-2xl overflow-hidden group"
                style={{ aspectRatio: "1 / 1" }}>
                <img src={photo.fileUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors" />
                <button type="button" onClick={() => onDelete(photo.id)} disabled={deletingId === photo.id}
                  aria-label="Delete photo"
                  className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 disabled:opacity-100">
                  {deletingId === photo.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                </button>
                {isHero ? (
                  <div className="absolute bottom-2 inset-x-2 text-center">
                    <span className="inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full text-white"
                      style={{ background: ROSE }}>✦ Hero background</span>
                  </div>
                ) : (
                  <button type="button" onClick={() => onSetHero(photo.id, photo.fileUrl)}
                    className="absolute bottom-2 inset-x-2 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full text-white"
                      style={{ background: "rgba(0,0,0,0.60)" }}>Set as hero →</span>
                  </button>
                )}
              </div>
            );
          })}
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors hover:bg-muted/20"
            style={{ aspectRatio: "1 / 1", borderColor: `${TAUPE}50` }}>
            {uploading
              ? <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
              : <span className="text-2xl text-muted-foreground/50">+</span>}
            <span className="text-[10px] text-muted-foreground font-medium">Add photo</span>
          </button>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*,.heic,.heif" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
    </>
  );
}

function InspirationBoard({
  photos, uploading, onUpload, onDelete, deletingId,
}: {
  photos: ClientMedia[];
  uploading: boolean;
  onUpload: (file: File, category: string) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [activeFilter, setActiveFilter] = React.useState("all");
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);

  function handleFileSelect(file: File) {
    setPendingFile(file);
  }

  function handleCategoryPick(category: string) {
    if (!pendingFile) return;
    onUpload(pendingFile, category);
    setPendingFile(null);
  }

  const filtered = activeFilter === "all"
    ? photos
    : photos.filter(p => p.category === activeFilter);

  const counts: Record<string, number> = {};
  for (const p of photos) counts[p.category ?? "inspiration"] = (counts[p.category ?? "inspiration"] ?? 0) + 1;

  return (
    <div className="space-y-4">
      {/* Category picker overlay when a file is pending */}
      {pendingFile && (
        <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: `${ROSE}30`, background: `${ROSE}06` }}>
          <p className="text-sm font-medium text-heading">What's this photo?</p>
          <div className="flex flex-wrap gap-2">
            {INSPO_CATEGORIES.map(cat => (
              <button key={cat.key} type="button" onClick={() => handleCategoryPick(cat.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors hover:bg-card"
                style={{ borderColor: "#E8E3DC" }}>
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setPendingFile(null)}
            className="text-xs text-muted-foreground hover:text-heading">
            Cancel
          </button>
        </div>
      )}

      {/* Filter tabs */}
      {photos.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
          {[{ key: "all", label: "All", emoji: "🎯" }, ...INSPO_CATEGORIES].map(cat => {
            const count = cat.key === "all" ? photos.length : (counts[cat.key] ?? 0);
            if (cat.key !== "all" && count === 0) return null;
            const isActive = activeFilter === cat.key;
            return (
              <button key={cat.key} type="button" onClick={() => setActiveFilter(cat.key)}
                className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: isActive ? SAGE : "#F0ECE6",
                  color: isActive ? "white" : "#6B6460",
                }}>
                <span className="text-sm leading-none">{cat.emoji}</span>
                <span>{cat.label}</span>
                {count > 0 && (
                  <span className="text-[10px] opacity-70 ml-0.5">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Photo grid */}
      {filtered.length === 0 && photos.length === 0 ? (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full rounded-2xl border-2 border-dashed py-12 flex flex-col items-center gap-3 transition-colors hover:bg-muted/20"
          style={{ borderColor: `color-mix(in srgb, var(--venue-primary) 25%, transparent)` }}>
          {uploading
            ? <div className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
            : <span className="text-4xl">🌸</span>}
          <p className="text-sm text-heading font-medium">Build your inspiration board</p>
          <p className="text-xs text-muted-foreground">Screenshots, color palettes, florals, dress ideas.</p>
        </button>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No photos in this category yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map(photo => {
            const cat = INSPO_CATEGORIES.find(c => c.key === photo.category);
            return (
              <div key={photo.id} className="relative rounded-2xl overflow-hidden group"
                style={{ aspectRatio: "1 / 1" }}>
                <img src={photo.fileUrl} alt={cat?.label ?? ""} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors" />
                <button type="button" onClick={() => onDelete(photo.id)} disabled={deletingId === photo.id}
                  aria-label="Delete photo"
                  className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80 disabled:opacity-100">
                  {deletingId === photo.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                </button>
                {/* Category badge */}
                {cat && activeFilter === "all" && (
                  <div className="absolute top-2 left-2">
                    <span className="text-base leading-none">{cat.emoji}</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add-more tile */}
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors hover:bg-muted/20"
            style={{ aspectRatio: "1 / 1", borderColor: `${TAUPE}50` }}>
            {uploading
              ? <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
              : <span className="text-2xl text-muted-foreground/50">+</span>}
            <span className="text-[10px] text-muted-foreground font-medium">Add photo</span>
          </button>
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*,.heic,.heif" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ""; }} />
    </div>
  );
}

function formatEntryDate(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

// ── Journey Section — chronological keepsake timeline ────────────────────────

function JourneySection({
  token, context, onNavigate,
}: {
  token: string;
  context: PortalContext;
  onNavigate: (s: PortalSection) => void;
}) {
  const [entries, setEntries] = React.useState<JournalEntry[] | null>(null);

  React.useEffect(() => {
    fetch(`/api/portal/journey?token=${token}`)
      .then(r => r.json())
      .then((d: { entries?: JournalEntry[] }) => setEntries(d.entries ?? []));
  }, [token]);

  const du = context.event?.eventDate ? daysUntil(context.event.eventDate) : null;
  const isMarried = du !== null && du <= 0;

  const milestoneMap = Object.fromEntries(JOURNAL_MILESTONES.map(m => [m.key, m]));

  if (entries === null) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
      </div>
    );
  }

  // Insert year-marker items between entries when the year changes
  let seenYear: number | null = null;
  type TimelineItem = { type: "year"; year: number } | { type: "entry"; entry: JournalEntry };
  const timelineItems: TimelineItem[] = [];
  for (const entry of entries) {
    const year = parseInt(entry.entryDate.split("-")[0], 10);
    if (year !== seenYear) {
      timelineItems.push({ type: "year", year });
      seenYear = year;
    }
    timelineItems.push({ type: "entry", entry });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">

      {/* ── Header ── */}
      <div className="space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: ROSE_DEEP }}>
          📖 Your Journey
        </p>
        <h2 className="text-2xl font-bold text-heading">
          {isMarried ? "Your love story." : "Every step of the way."}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isMarried
            ? "The moments that made your wedding year unforgettable."
            : "A chronicle of your engagement, from the very beginning."}
        </p>
      </div>

      {/* ── Empty state ── */}
      {entries.length === 0 && (
        <div className="text-center py-20 space-y-4">
          <div className="text-5xl">📖</div>
          <p className="text-lg font-semibold text-heading">Your story is just beginning.</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Add your first journal entry in Our Story to start building your keepsake timeline.
          </p>
          <button type="button" onClick={() => onNavigate("story")}
            className="mt-2 inline-block px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: ROSE_DEEP }}>
            Write your first memory →
          </button>
        </div>
      )}

      {/* ── Timeline ── */}
      {entries.length > 0 && (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-5 top-2 bottom-2 w-px rounded-full"
            style={{ background: `linear-gradient(to bottom, ${ROSE}00, ${ROSE}40 8%, ${ROSE}40 92%, ${ROSE}00)` }} />

          <div className="space-y-1">
            {timelineItems.map((item, idx) => {
              if (item.type === "year") {
                return (
                  <div key={`y${item.year}-${idx}`} className="flex items-center gap-3 py-3 pl-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 text-[9px] font-bold"
                      style={{ background: LINEN, border: `2px solid ${ROSE}50`, color: ROSE_DEEP }}>
                      {String(item.year).slice(2)}
                    </div>
                    <div className="h-px flex-1 rounded-full" style={{ background: `${ROSE}20` }} />
                    <span className="text-[10px] font-semibold pr-1 shrink-0" style={{ color: ROSE_DEEP }}>
                      {item.year}
                    </span>
                  </div>
                );
              }

              const { entry } = item;
              const milestone = entry.milestone ? milestoneMap[entry.milestone] : null;
              const isAuto = entry.source === "auto";

              return (
                <div key={entry.id} className="flex gap-3 items-start pl-2 group pb-3">
                  {/* Node */}
                  <div className="w-7 h-7 mt-3.5 rounded-full flex items-center justify-center text-[13px] shrink-0 z-10 transition-transform group-hover:scale-110"
                    style={{
                      background: isAuto ? `${TAUPE}25` : `${ROSE}22`,
                      border: `2px solid ${isAuto ? TAUPE + "50" : ROSE + "55"}`,
                    }}>
                    {milestone ? milestone.emoji : isAuto ? "✦" : "💗"}
                  </div>

                  {/* Card */}
                  <div className="flex-1 min-w-0 rounded-2xl overflow-hidden transition-all group-hover:shadow-sm"
                    style={{
                      background: isAuto ? "#FAF8F6" : LINEN,
                      border: `1px solid ${isAuto ? TAUPE + "40" : ROSE + "30"}`,
                      opacity: isAuto ? 0.92 : 1,
                    }}>

                    {/* Full-bleed scrapbook photo */}
                    {entry.mediaUrl && (
                      <img src={entry.mediaUrl} alt={entry.title ?? ""}
                        className="w-full object-cover" style={{ maxHeight: "320px" }} />
                    )}

                    <div className="p-4 space-y-1.5">
                      {isAuto ? (
                        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: TAUPE }}>
                          ✦ Luv noticed
                        </p>
                      ) : milestone ? (
                        <p className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: ROSE_DEEP }}>
                          {milestone.emoji} {milestone.label}
                        </p>
                      ) : null}

                      {entry.title && (
                        <p className="text-sm font-semibold text-heading leading-snug">{entry.title}</p>
                      )}

                      <p className="text-[13px] text-muted-foreground leading-relaxed">{entry.body}</p>

                      <p className="text-[10px] text-muted-foreground/60 pt-0.5">
                        {formatEntryDate(entry.entryDate)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Post-wedding: your story continues ── */}
      {isMarried && (
        <div className="rounded-3xl p-8 text-center space-y-3"
          style={{ background: `${ROSE}08`, border: `1px solid ${ROSE}25` }}>
          <p className="text-3xl">💗</p>
          <p className="text-base font-semibold text-heading">Your story continues.</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            Add honeymoon memories, anniversary reflections, and the moments that follow — this keepsake is yours to keep forever.
          </p>
          <button type="button" onClick={() => onNavigate("story")}
            className="mt-1 inline-block px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: ROSE_DEEP }}>
            Add a memory →
          </button>
        </div>
      )}

    </div>
  );
}

function OurStorySection({
  token, profile, onProfileChange,
}: {
  token: string;
  profile: CoupleProfile | null;
  onProfileChange: (p: CoupleProfile) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [hashtag, setHashtag] = React.useState(profile?.weddingHashtag ?? "");
  const [story, setStory] = React.useState(profile?.ourStory ?? "");
  const [saving, setSaving] = React.useState(false);
  const [uploadingCategory, setUploadingCategory] = React.useState<string | null>(null);

  // Journal state
  const [journalEntries, setJournalEntries] = React.useState<JournalEntry[]>([]);
  const [loadingJournal, setLoadingJournal]   = React.useState(true);
  const [addingEntry, setAddingEntry]         = React.useState(false);
  const [entryDate, setEntryDate]             = React.useState(new Date().toISOString().split("T")[0]);
  const [entryTitle, setEntryTitle]           = React.useState("");
  const [entryBody, setEntryBody]             = React.useState("");
  const [entryMilestone, setEntryMilestone]   = React.useState<string | null>(null);
  const [savingEntry, setSavingEntry]         = React.useState(false);
  const [entryMediaId, setEntryMediaId]       = React.useState<string | null>(null);
  const [entryMediaUrl, setEntryMediaUrl]     = React.useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto]   = React.useState(false);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setLoadingJournal(true);
    fetch(`/api/portal/journal?token=${token}`)
      .then(r => r.json())
      .then((d: { entries?: JournalEntry[] }) => setJournalEntries(d.entries ?? []))
      .catch(() => {})
      .finally(() => setLoadingJournal(false));
  }, [token]);

  async function saveJournalEntry() {
    if (!entryBody.trim()) return;
    setSavingEntry(true);
    try {
      const res = await fetch("/api/portal/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token, date: entryDate, title: entryTitle.trim() || undefined,
          body: entryBody.trim(), milestone: entryMilestone ?? undefined,
          mediaId: entryMediaId ?? undefined,
        }),
      });
      const data = await res.json() as { ok: boolean; entryId?: string };
      if (data.ok && data.entryId) {
        const newEntry: JournalEntry = {
          id: data.entryId, entryDate, title: entryTitle.trim() || null,
          body: entryBody.trim(), milestone: entryMilestone, source: "manual",
          mediaId: entryMediaId, mediaUrl: entryMediaUrl,
          createdAt: new Date().toISOString(),
        };
        setJournalEntries(prev => [newEntry, ...prev]);
        // Bubble the new entry up so the memory strip on the overview updates
        onProfileChange({ ...(profile ?? emptyProfile), latestJournalEntry: newEntry });
        setAddingEntry(false);
        setEntryTitle(""); setEntryBody(""); setEntryMilestone(null);
        setEntryMediaId(null); setEntryMediaUrl(null);
        setEntryDate(new Date().toISOString().split("T")[0]);
      }
    } finally {
      setSavingEntry(false);
    }
  }

  async function deleteJournalEntry(entryId: string) {
    setJournalEntries(prev => prev.filter(e => e.id !== entryId));
    await fetch("/api/portal/journal", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, entryId }),
    });
  }

  async function uploadEntryPhoto(file: File) {
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("token", token); fd.append("file", file);
      fd.append("category", "memory"); fd.append("visibility", "private");
      const res  = await fetch("/api/portal/media", { method: "POST", body: fd });
      const data = await res.json() as { ok: boolean; mediaId?: string; fileUrl?: string };
      if (data.ok && data.mediaId && data.fileUrl) {
        setEntryMediaId(data.mediaId);
        setEntryMediaUrl(data.fileUrl);
      } else {
        toast.error("Photo upload failed — please try again.");
      }
    } catch {
      toast.error("Photo upload failed — please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  const engPhotos   = profile?.engagementPhotos  ?? [];
  const inspoPhotos = profile?.inspirationPhotos ?? [];

  const emptyProfile: CoupleProfile = {
    weddingHashtag: null, ourStory: null,
    heroPhotoId: null, heroPhotoUrl: null,
    couplePhotoId: null, couplePhotoUrl: null,
    engagementPhotos: [], inspirationPhotos: [], memoryPhotos: [],
    latestJournalEntry: null,
  };

  async function uploadPhoto(file: File, category: string) {
    setUploadingCategory(category);
    try {
      const fd = new FormData();
      fd.append("token",      token);
      fd.append("file",       file);
      fd.append("category",   category);
      fd.append("visibility", "private");
      const res  = await fetch("/api/portal/media", { method: "POST", body: fd });
      const data = await res.json() as { ok: boolean; mediaId?: string; fileUrl?: string };
      if (data.ok && data.fileUrl && data.mediaId) {
        const newMedia: ClientMedia = {
          id: data.mediaId, fileUrl: data.fileUrl, mediaType: "image",
          category: category as ClientMedia["category"], visibility: "private",
          caption: null, createdAt: new Date().toISOString(),
        };
        const base = profile ?? emptyProfile;
        const isInspo = category !== "engagement";
        onProfileChange({
          ...base,
          engagementPhotos:  !isInspo ? [newMedia, ...base.engagementPhotos] : base.engagementPhotos,
          inspirationPhotos: isInspo  ? [newMedia, ...base.inspirationPhotos] : base.inspirationPhotos,
        });
      } else {
        toast.error("Upload failed — please try again.");
      }
    } catch {
      toast.error("Upload failed — please try again.");
    } finally {
      setUploadingCategory(null);
    }
  }

  // delete_couple_media already existed server-side with no caller anywhere
  // in the app — every photo grid only ever let a couple add photos, never
  // remove one they changed their mind about (client portal feedback,
  // 2026-07-22). Optimistic removal, reverted if the delete call fails.
  const [deletingPhotoId, setDeletingPhotoId] = React.useState<string | null>(null);
  async function deletePhoto(mediaId: string) {
    const base = profile ?? emptyProfile;
    setDeletingPhotoId(mediaId);
    try {
      const res = await fetch("/api/portal/media", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, mediaId }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (data.ok) {
        onProfileChange({
          ...base,
          engagementPhotos:  base.engagementPhotos.filter(p => p.id !== mediaId),
          inspirationPhotos: base.inspirationPhotos.filter(p => p.id !== mediaId),
        });
      } else {
        toast.error(data.error ?? "Could not delete this photo.");
      }
    } catch {
      toast.error("Could not delete this photo.");
    } finally {
      setDeletingPhotoId(null);
    }
  }

  async function setHeroPhoto(mediaId: string, fileUrl: string) {
    const res  = await fetch("/api/portal/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, heroPhotoId: mediaId }),
    });
    if ((await res.json() as { ok?: boolean }).ok) {
      onProfileChange({ ...(profile ?? emptyProfile), heroPhotoId: mediaId, heroPhotoUrl: fileUrl });
      toast.success("Hero background updated. Head to Home to see it.");
    }
  }

  async function saveText() {
    setSaving(true);
    try {
      const res  = await fetch("/api/portal/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, weddingHashtag: hashtag.trim(), ourStory: story.trim() }),
      });
      if ((await res.json() as { ok?: boolean }).ok) {
        onProfileChange({ ...(profile ?? emptyProfile), weddingHashtag: hashtag.trim() || null, ourStory: story.trim() || null });
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-10">

      {/* ── Header ── */}
      <div>
        <h2 className="font-heading text-2xl text-heading">Your Story</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Make this space feel like home. Photos, hashtag, your love story.
        </p>
      </div>

      {/* ── Hashtag + Our Story ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: ROSE_DEEP }}>
            💍 Who You Are
          </p>
          {!editing && (
            <button type="button" onClick={() => {
              setHashtag(profile?.weddingHashtag ?? "");
              setStory(profile?.ourStory ?? "");
              setEditing(true);
            }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted/30 transition-colors">
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-heading mb-1.5">Wedding Hashtag</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">#</span>
                <input type="text"
                  value={hashtag.replace(/^#/, "")}
                  onChange={e => setHashtag("#" + e.target.value.replace(/^#/, "").replace(/\s/g, ""))}
                  placeholder="EmmaAndJames2026"
                  maxLength={79}
                  className="w-full pl-7 pr-3 py-2.5 text-sm rounded-xl border border-border bg-background outline-none focus:border-ring" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-heading mb-1.5">Our Story</label>
              <textarea
                value={story}
                onChange={e => setStory(e.target.value)}
                maxLength={400} rows={4}
                placeholder="Tell your story in a sentence or two. This will appear on your wedding website."
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background outline-none focus:border-ring resize-none" />
              <p className="text-right text-[10px] text-muted-foreground mt-1">{story.length}/400</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={saveText} disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-white rounded-xl transition-opacity disabled:opacity-60"
                style={{ background: SAGE }}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setEditing(false)}
                className="px-4 py-2 text-xs font-medium text-muted-foreground rounded-xl hover:bg-muted/40 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            {profile?.weddingHashtag ? (
              <p className="font-heading text-xl text-heading">{profile.weddingHashtag}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No hashtag yet — add yours above.</p>
            )}
            {profile?.ourStory ? (
              <p className="text-sm text-heading leading-relaxed">{profile.ourStory}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Add your story — it'll appear on your wedding website.</p>
            )}
          </div>
        )}
      </section>

      {/* ── Engagement Photos ── */}
      <section className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: ROSE_DEEP }}>
            📸 Engagement Photos
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hover any photo to set it as your hero background.
          </p>
        </div>
        <EngagementPhotoGrid
          photos={engPhotos}
          heroPhotoId={profile?.heroPhotoId}
          uploading={uploadingCategory === "engagement"}
          onUpload={f => uploadPhoto(f, "engagement")}
          onSetHero={setHeroPhoto}
          onDelete={deletePhoto}
          deletingId={deletingPhotoId}
        />
      </section>

      {/* ── Inspiration Board ── */}
      <section className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: ROSE_DEEP }}>
            🌸 Inspiration Board
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Save what you love — tagged by category so you can find it later.
          </p>
        </div>
        <InspirationBoard
          photos={inspoPhotos}
          uploading={!!uploadingCategory && uploadingCategory !== "engagement"}
          onUpload={(f, cat) => uploadPhoto(f, cat)}
          onDelete={deletePhoto}
          deletingId={deletingPhotoId}
        />
      </section>

      {/* ── Planning Journal ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: ROSE_DEEP }}>
              📖 Planning Journal
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Capture moments as they happen. This becomes your keepsake.
            </p>
          </div>
          {!addingEntry && (
            <button type="button" onClick={() => setAddingEntry(true)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-muted/30 transition-colors shrink-0">
              + Add moment
            </button>
          )}
        </div>

        {/* Add entry form */}
        {addingEntry && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-heading mb-1.5">Date</label>
                <input type="date" value={entryDate}
                  onChange={e => setEntryDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background outline-none focus:border-ring" />
              </div>
              <div>
                <label className="block text-xs font-medium text-heading mb-1.5">
                  Title <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input type="text" value={entryTitle}
                  onChange={e => setEntryTitle(e.target.value)}
                  placeholder="Venue Walk-Through"
                  maxLength={120}
                  className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background outline-none focus:border-ring" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-heading mb-1.5">Your note</label>
              <textarea value={entryBody}
                onChange={e => setEntryBody(e.target.value)}
                maxLength={500} rows={4}
                placeholder="The light through the windows was magical. We both knew immediately."
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-background outline-none focus:border-ring resize-none" />
              <p className="text-right text-[10px] text-muted-foreground mt-1">{entryBody.length}/500</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-heading mb-2">
                What kind of moment? <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {JOURNAL_MILESTONES.map(m => {
                  const isActive = entryMilestone === m.key;
                  return (
                    <button key={m.key} type="button"
                      onClick={() => setEntryMilestone(isActive ? null : m.key)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all"
                      style={{
                        background: isActive ? SAGE : "transparent",
                        color: isActive ? "white" : "#6B6460",
                        borderColor: isActive ? SAGE : "#E8E3DC",
                      }}>
                      <span>{m.emoji}</span>
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Photo attachment */}
            <div>
              <label className="block text-xs font-medium text-heading mb-2">
                Photo <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              {entryMediaUrl ? (
                <div className="relative inline-block">
                  <img src={entryMediaUrl} alt="" className="rounded-xl h-28 w-28 object-cover" />
                  <button type="button" onClick={() => { setEntryMediaId(null); setEntryMediaUrl(null); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-border flex items-center justify-center text-[10px] text-muted-foreground hover:text-heading shadow-sm">
                    ×
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => photoInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed text-xs text-muted-foreground hover:text-heading hover:bg-muted/20 transition-colors"
                  style={{ borderColor: `${ROSE}40` }}>
                  {uploadingPhoto
                    ? <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground animate-spin" />
                    : <span>📸</span>}
                  {uploadingPhoto ? "Uploading…" : "Add a photo"}
                </button>
              )}
              <input ref={photoInputRef} type="file" accept="image/*,.heic,.heif" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadEntryPhoto(f); e.target.value = ""; }} />
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={saveJournalEntry}
                disabled={!entryBody.trim() || savingEntry || uploadingPhoto}
                className="px-4 py-2 text-xs font-semibold text-white rounded-xl transition-opacity disabled:opacity-50"
                style={{ background: SAGE }}>
                {savingEntry ? "Saving…" : "Save moment"}
              </button>
              <button type="button" onClick={() => {
                setAddingEntry(false);
                setEntryTitle(""); setEntryBody(""); setEntryMilestone(null);
                setEntryMediaId(null); setEntryMediaUrl(null);
              }}
                className="px-4 py-2 text-xs font-medium text-muted-foreground rounded-xl hover:bg-muted/40 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Entries list */}
        {loadingJournal ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground animate-spin" />
          </div>
        ) : journalEntries.length === 0 && !addingEntry ? (
          <button type="button" onClick={() => setAddingEntry(true)}
            className="w-full rounded-2xl border-2 border-dashed py-10 flex flex-col items-center gap-3 transition-colors hover:bg-muted/20"
            style={{ borderColor: `${ROSE}30` }}>
            <span className="text-4xl">📖</span>
            <p className="text-sm text-heading font-medium">Start your planning journal</p>
            <p className="text-xs text-muted-foreground">Your first entry becomes the opening page of your keepsake.</p>
          </button>
        ) : (
          <div className="space-y-3">
            {journalEntries.map(entry => {
              const ms   = JOURNAL_MILESTONES.find(m => m.key === entry.milestone);
              const isAuto = entry.source === "auto";
              return (
                <div key={entry.id}
                  className={`rounded-2xl border p-5 space-y-2 ${isAuto ? "" : "group relative"}`}
                  style={{
                    background: isAuto ? "#FAF8F6" : "#FDFCFA",
                    borderColor: isAuto ? `${TAUPE}40` : "#E8E3DC",
                    opacity: isAuto ? 0.88 : 1,
                  }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatEntryDate(entry.entryDate)}
                      </span>
                      {isAuto ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: `${TAUPE}20`, color: TAUPE }}>
                          ✦ Luv noticed
                        </span>
                      ) : ms && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: `${ROSE}15`, color: ROSE_DEEP }}>
                          {ms.emoji} {ms.label}
                        </span>
                      )}
                    </div>
                    {!isAuto && (
                      <button type="button" onClick={() => deleteJournalEntry(entry.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-muted-foreground shrink-0 text-base leading-none pt-0.5">
                        ×
                      </button>
                    )}
                  </div>
                  {entry.title && (
                    <p className={`text-lg leading-snug ${isAuto ? "text-heading/75" : "font-heading text-heading"}`}>
                      {entry.title}
                    </p>
                  )}
                  <p className={`text-sm leading-relaxed ${isAuto ? "text-muted-foreground" : "text-heading"}`}>
                    {entry.body}
                  </p>
                  {entry.mediaUrl && (
                    <img src={entry.mediaUrl} alt="" className="rounded-xl w-full max-h-44 object-cover mt-1" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}

// ── Account — password, sessions, temporary venue support access ────────────

const SUPPORT_ACCESS_DURATIONS = [
  { hours: 1,  label: "1 hour" },
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
];

function AccountSettingsPanel({ venueName }: { venueName: string }) {
  const [state, setState] = React.useState<AccountState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [savingPassword, setSavingPassword] = React.useState(false);
  const [revokingSessionId, setRevokingSessionId] = React.useState<string | null>(null);
  const [grantHours, setGrantHours] = React.useState(24);
  const [granting, setGranting] = React.useState(false);
  const [revokingGrantId, setRevokingGrantId] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    getAccountStateAction().then((s) => { setState(s); setLoading(false); });
  }, []);

  React.useEffect(() => { refresh(); }, [refresh]);

  async function handleChangePassword() {
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match."); return; }
    setSavingPassword(true);
    const result = await changePasswordAction(newPassword);
    setSavingPassword(false);
    if (result.ok) { toast.success("Password updated."); setNewPassword(""); setConfirmPassword(""); }
    else toast.error(result.error);
  }

  async function handleRevokeSession(sessionId: string) {
    setRevokingSessionId(sessionId);
    const result = await revokeSessionAction(sessionId);
    setRevokingSessionId(null);
    if (result.ok) { toast.success("Session signed out."); refresh(); }
    else toast.error(result.error);
  }

  async function handleGrantAccess() {
    setGranting(true);
    const result = await grantSupportAccessAction(grantHours);
    setGranting(false);
    if (result.ok) { toast.success("Temporary support access granted."); refresh(); }
    else toast.error(result.error);
  }

  async function handleRevokeGrant(grantId: string) {
    setRevokingGrantId(grantId);
    const result = await revokeSupportGrantAction(grantId);
    setRevokingGrantId(null);
    if (result.ok) { toast.success("Support access revoked."); refresh(); }
    else toast.error(result.error);
  }

  if (loading) {
    return <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></div>;
  }

  if (!state?.loggedIn) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-3">
        <p className="text-sm font-semibold text-heading">Sign in to manage your account</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Account settings — password, sessions, and support access — require signing in with your own account.
        </p>
        <a href="/client/login" className="inline-block text-xs font-semibold px-4 py-2 rounded-xl text-white" style={{ background: SAGE }}>
          Sign In
        </a>
      </div>
    );
  }

  const activeGrant = state.grants.find((g) => !g.revokedAt && new Date(g.expiresAt) > new Date()) ?? null;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl p-6" style={{ background: `linear-gradient(135deg, ${ROSE}10 0%, #FAF8F5 100%)`, border: `1px solid ${ROSE}25` }}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-1.5" style={{ color: ROSE_DEEP }}>⚙️ Account</p>
        <p className="font-heading text-xl text-heading leading-snug">Your account, your workspace</p>
        <p className="text-sm text-muted-foreground mt-1">You own this account. {venueName} can invite, resend, or revoke access, but never sign in as you.</p>
      </div>

      {/* Password */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-heading">Password</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium text-heading">New password</p>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm" minLength={8} />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-heading">Confirm password</p>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm" minLength={8} />
          </div>
        </div>
        <button type="button" onClick={handleChangePassword} disabled={savingPassword}
          className="text-xs font-semibold px-4 py-2 rounded-xl text-white disabled:opacity-60" style={{ background: SAGE }}>
          {savingPassword ? "Saving…" : "Update Password"}
        </button>
      </div>

      {/* Active sessions */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-heading">Active Sessions</p>
        {state.sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No other active sessions.</p>
        ) : (
          <div className="space-y-2">
            {state.sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-heading truncate">{s.userAgent ?? "Unknown device"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Signed in {new Date(s.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {s.isCurrent ? " · This device" : ""}
                  </p>
                </div>
                {!s.isCurrent && (
                  <button type="button" onClick={() => handleRevokeSession(s.id)} disabled={revokingSessionId === s.id}
                    className="text-[11px] text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-50">
                    {revokingSessionId === s.id ? "Signing out…" : "Sign out"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Temporary support access */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold text-heading">Support Access</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {venueName} cannot open your workspace unless you explicitly grant temporary access. Access expires
          automatically, and every visit is logged here.
        </p>
        {activeGrant ? (
          <div className="rounded-xl border border-border/60 px-3 py-2.5 flex items-center justify-between gap-2">
            <p className="text-xs text-heading">
              Active until {new Date(activeGrant.expiresAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
            <button type="button" onClick={() => handleRevokeGrant(activeGrant.id)} disabled={revokingGrantId === activeGrant.id}
              className="text-[11px] text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-50">
              {revokingGrantId === activeGrant.id ? "Revoking…" : "Revoke now"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <select value={grantHours} onChange={(e) => setGrantHours(Number(e.target.value))}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs">
              {SUPPORT_ACCESS_DURATIONS.map((d) => <option key={d.hours} value={d.hours}>{d.label}</option>)}
            </select>
            <button type="button" onClick={handleGrantAccess} disabled={granting}
              className="text-xs font-semibold px-4 py-2 rounded-xl text-white disabled:opacity-60" style={{ background: ROSE_DEEP }}>
              {granting ? "Granting…" : "Grant Temporary Access"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Program 4, Initiative D, Phase 1 (2026-07-23) — "People" (inviting
// collaborators) isn't named in either of the directive's two nav lists;
// it's access management, not venue-planning or wedding-personalization,
// so it folds in here as a second tab rather than keeping its own
// top-level nav slot. Same tab-switch pattern already used for Story/Journey.
function AccountSection({ token, context, venueName }: { token: string; context: PortalContext; venueName: string }) {
  const [tab, setTab] = React.useState<"account" | "people">("account");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 w-fit">
        {(["account", "people"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg transition-all"
            style={{
              color: tab === t ? SAGE : "#6A6460",
              background: tab === t ? "var(--card)" : "transparent",
              fontWeight: tab === t ? 600 : 400,
            }}>
            {t === "account" ? "Account" : "People"}
          </button>
        ))}
      </div>
      {tab === "account"
        ? <AccountSettingsPanel venueName={venueName} />
        : <OurPeopleSection token={token} context={context} />}
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

// Our Story and Journey were two separate nav destinations covering the same
// idea (the couple's own narrative) — merged into one tab-switching entry
// point so the primary nav can stay focused on the collaborative workspace.
// Reuses both section components unchanged.
function StoryAndJourneySection({
  token, context, profile, onProfileChange, onNavigate, initialTab,
}: {
  token: string;
  context: PortalContext;
  profile: CoupleProfile | null;
  onProfileChange: (p: CoupleProfile) => void;
  onNavigate: (s: PortalSection) => void;
  initialTab: "story" | "journey";
}) {
  const [tab, setTab] = React.useState<"story" | "journey">(initialTab);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1 w-fit">
        {(["story", "journey"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
            style={{
              color: tab === t ? SAGE : "#6A6460",
              background: tab === t ? "var(--card)" : "transparent",
              fontWeight: tab === t ? 600 : 400,
            }}>
            {t === "story" ? "Our Story" : "Journey"}
          </button>
        ))}
      </div>
      {tab === "story"
        ? <OurStorySection token={token} profile={profile} onProfileChange={onProfileChange} />
        : <JourneySection token={token} context={context} onNavigate={onNavigate} />}
    </div>
  );
}

// Program 4, Initiative D, Phase 1 (2026-07-23) — "This is not a redesign
// ... this is strictly about reorganizing and presenting the existing
// experience correctly." Two groups, not one list with a label: "Your
// Venue" (the collaborative planning relationship with the venue, always
// first) and "Your Wedding" (personal planning tools, intentionally
// secondary, after a visible divider). Order within each group is the
// directive's own list verbatim. "People" (inviting collaborators) isn't
// named in either of the directive's two lists — it's not a venue-planning
// destination or a wedding-personalization tool, it's access management,
// so it folds into Account as a second tab there (same move already made
// for Story/Journey) rather than getting its own top-level slot outside
// the two sanctioned categories.
const NAV_ITEMS: { id: PortalSection; icon: string; label: string; shortLabel?: string; available: boolean; group: "venue" | "wedding" }[] = [
  { id: "overview",  icon: "🏠", label: "Home",              available: true, group: "venue" },
  { id: "tasks",     icon: "✅", label: "Tasks",             available: true, group: "venue" },
  { id: "timeline",  icon: "🕒", label: "Timeline",          available: true, group: "venue" },
  { id: "documents", icon: "📁", label: "Documents",         available: true, group: "venue" },
  { id: "payments",  icon: "💳", label: "Payments",          available: true, group: "venue" },
  { id: "messages",  icon: "💬", label: "Messages",          available: true, group: "venue" },
  { id: "guide",     icon: "🏛️", label: "Venue Guide",       shortLabel: "Guide",   available: true, group: "venue" },
  { id: "vendors",   icon: "🤝", label: "Preferred Vendors", shortLabel: "Vendors", available: true, group: "venue" },
  { id: "website",   icon: "🌐", label: "Website",     available: true, group: "wedding" },
  { id: "guests",    icon: "👥", label: "Guests",      available: true, group: "wedding" },
  { id: "seating",   icon: "🪑", label: "Seating",     available: true, group: "wedding" },
  { id: "budget",    icon: "💰", label: "Budget",      available: true, group: "wedding" },
  { id: "story",     icon: "💍", label: "Our Story",   shortLabel: "Story", available: true, group: "wedding" },
  { id: "todos",     icon: "✨", label: "Plans",       available: true, group: "wedding" },
  { id: "ask",       icon: "💗", label: "Ask Luv",     shortLabel: "Luv",   available: true, group: "wedding" },
  { id: "account",   icon: "⚙️", label: "Account",     available: true, group: "wedding" },
];

export function PortalShell({
  token, context, initialTasks, initialTimelineSections = [], initialTimelineEntries = [],
  initialTimelineLastSubmittedAt = null, initialTimelineHasUnpublishedChanges = false,
}: {
  token: string;
  context: PortalContext;
  initialTasks: PortalTask[];
  initialTimelineSections?: PortalTimelineSection[];
  initialTimelineEntries?: PortalTimelineEntry[];
  initialTimelineLastSubmittedAt?: string | null;
  initialTimelineHasUnpublishedChanges?: boolean;
}) {
  const [activeSection, setActiveSection] = React.useState<PortalSection>("overview");
  const [guestStats, setGuestStats] = React.useState<GuestStats | null>(null);
  const [todoCount, setTodoCount] = React.useState(0);
  const [profile, setProfile] = React.useState<CoupleProfile | null>(null);
  const [recentActivity, setRecentActivity] = React.useState<RecentActivity | null>(null);
  const [showLuvIntro, setShowLuvIntro] = React.useState(false);

  // Deep-linkable by #hash (e.g. #guests, #seating) — same pattern the
  // Booking Workspace's own tabs already use — so the venue-side Event
  // Readiness card's "open in the couple's portal" links land on the
  // relevant section instead of always Overview (Event Readiness — Phase 1).
  React.useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) setActiveSection(hash as PortalSection);
    };
    syncFromHash();
  }, []);

  React.useEffect(() => {
    fetch(`/api/portal/guests?token=${token}`)
      .then(r => r.json())
      .then((d: { stats?: GuestStats }) => setGuestStats(d.stats ?? null))
      .catch(() => {});
    fetch(`/api/portal/profile?token=${token}`)
      .then(r => r.json())
      .then((d: { profile?: CoupleProfile }) => setProfile(d.profile ?? null))
      .catch(() => {});
    fetch(`/api/portal/activity?token=${token}`)
      .then(r => r.json())
      .then((d: RecentActivity) => setRecentActivity(d))
      .catch(() => {});
    // Luv Experience Completion, Work Stream 5 — one-time intro card.
    fetch(`/api/portal/luv-intro?token=${token}`)
      .then(r => r.json())
      .then((d: { seen?: boolean }) => setShowLuvIntro(d.seen === false))
      .catch(() => {});
  }, [token]);

  function dismissLuvIntro() {
    setShowLuvIntro(false);
    void fetch("/api/portal/luv-intro", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
  }

  const firstName = context.client.firstName;
  const partnerName = context.client.partnerFirstName;
  const coupleName = [firstName, partnerName].filter(Boolean).join(" & ");
  const actionCount = initialTasks.filter(t => t.canComplete && t.status !== "complete").length;
  const isOverview = activeSection === "overview";

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background: "var(--venue-neutral)",
        // Venue Brand Experience Phase 1 — the venue's own brand, cascading
        // to every nested portal component via CSS custom properties, so
        // ~16 section files can each reference var(--venue-*) in their own
        // inline styles without needing this data threaded through props.
        // Luv's own dusty-rose identity and every functional/status color
        // (paid/overdue, RSVP state) are deliberately untouched — not brand
        // targets, per the governing "a couple should remember the venue,
        // not the software" review.
        "--venue-primary": context.venue.primaryColor,
        "--venue-secondary": context.venue.secondaryColor,
        "--venue-accent": context.venue.accentColor,
        "--venue-neutral": context.venue.neutralColor,
      } as React.CSSProperties}
    >

      {/* ── Sticky Header ── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-[#DED6CA]">
        {/* Venue + couple identity */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {context.venue.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={context.venue.logoUrl} alt={context.venue.name} className="h-7 w-7 rounded-full object-cover shrink-0" />
            )}
            <p className="text-sm font-semibold text-heading leading-tight font-heading">{coupleName}</p>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <p className="text-xs text-muted-foreground">{context.venue.name}</p>
          </div>
          <div className="flex items-center gap-3">
            {context.event && (
              <p className="text-xs text-muted-foreground hidden sm:block">
                {new Date(context.event.eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
            <a
              href={`/api/portal/export?token=${encodeURIComponent(token)}`}
              download
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground underline decoration-dotted underline-offset-2"
              title="Download a copy of your guest list, budget, and seating data"
            >
              Export my data
            </a>
          </div>
        </div>

        {/* Navigation — Program 4, Initiative D, Phase 1 (2026-07-23):
            "Create two clearly separated navigation groups... Do not
            intermingle these two categories. The distinction should be
            visually obvious." Two stacked rows, not one row with a label —
            "Your Venue" always first and full-weight (this is the
            collaborative planning relationship), "Your Wedding" second,
            after a real horizontal rule, in a visibly quieter register
            (smaller, lighter) — personal planning tools, intentionally
            secondary. */}
        <div className="max-w-4xl mx-auto px-2 sm:px-4">
          {/* Your Venue */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 shrink-0 hidden sm:inline" style={{ color: SAGE }}>
              Your Venue
            </span>
            {NAV_ITEMS.filter(i => i.group === "venue").map(item => {
              const isActive = activeSection === item.id;
              const badge = item.id === "tasks" && actionCount > 0 ? actionCount : 0;
              return (
                <button key={item.id} type="button"
                  onClick={() => item.available && setActiveSection(item.id)}
                  className="relative flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-all rounded-lg"
                  style={{
                    color: !item.available ? "#8A837D" : isActive ? SAGE : "#3D3833",
                    background: isActive ? `color-mix(in srgb, var(--venue-primary) 9%, transparent)` : "transparent",
                    fontWeight: isActive ? 700 : 500,
                  }}>
                  <span className="text-sm">{item.icon}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden text-[11px]">{item.shortLabel ?? item.label}</span>
                  {badge > 0 && (
                    <span className="h-4 w-4 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
                      style={{ background: ROSE }}>{badge}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Visible divider between the two groups */}
          <div className="h-px w-full" style={{ background: "#E0D8D0" }} />

          {/* Your Wedding — intentionally quieter: smaller text, lighter weight, no active tint */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-0.5">
            <span className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/45 px-1.5 shrink-0 hidden sm:inline">
              Your Wedding
            </span>
            {NAV_ITEMS.filter(i => i.group === "wedding").map(item => {
              const isActive = activeSection === item.id;
              return (
                <button key={item.id} type="button"
                  onClick={() => item.available && setActiveSection(item.id)}
                  className="relative flex-shrink-0 flex items-center gap-1.5 px-2.5 py-2 text-xs font-normal transition-all rounded-lg"
                  style={{
                    color: isActive ? SAGE : "#6A6460",
                    background: isActive ? `color-mix(in srgb, var(--venue-primary) 6%, transparent)` : "transparent",
                    fontWeight: isActive ? 600 : 400,
                    opacity: isActive ? 1 : 0.82,
                  }}>
                  <span className="text-xs">{item.icon}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sm:hidden text-[10px]">{item.shortLabel ?? item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 min-h-0 w-full overflow-y-auto flex flex-col">
        {/* Overview gets a full-canvas layout */}
        {isOverview ? (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
            {/* Desktop: 2-column hero layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
              {/* Left: Hero + planning journey */}
              <OverviewSection token={token} context={context} tasks={initialTasks} guestStats={guestStats} todoCount={todoCount} latestJournalEntry={profile?.latestJournalEntry ?? null} onNavigate={setActiveSection} />
              {/* Right: Quick actions sidebar (desktop only) */}
              <div className="hidden lg:flex flex-col gap-4">
                <QuickActionsSidebar token={token} context={context} onNavigate={setActiveSection} recentActivity={recentActivity} showLuvIntro={showLuvIntro} onDismissLuvIntro={dismissLuvIntro} />
              </div>
            </div>
          </div>
        ) : activeSection === "website" ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <WebsiteSection token={token} context={context} />
          </div>
        ) : activeSection === "seating" ? (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <SeatingPortalSection token={token} />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
            {activeSection === "guests"    && <GuestPortalSection token={token} />}
            {activeSection === "todos"     && <TodoSection token={token} onCountChange={setTodoCount} eventDate={context.event?.eventDate} />}
            {(activeSection === "story" || activeSection === "journey") && (
              <StoryAndJourneySection token={token} context={context} profile={profile} onProfileChange={setProfile} onNavigate={setActiveSection} initialTab={activeSection === "journey" ? "journey" : "story"} />
            )}
            {activeSection === "people"    && <OurPeopleSection token={token} context={context} />}
            {activeSection === "guide"     && <VenueGuidePortalSection token={token} context={context} onNavigate={setActiveSection} />}
            {activeSection === "tasks"     && <UnifiedTasksSection token={token} initialTasks={initialTasks} venueName={context.venue.name} onNavigate={setActiveSection} />}
            {activeSection === "questionnaire" && <QuestionnairePortalSection token={token} />}
            {activeSection === "timeline"  && <TimelinePortalSection token={token} clientId={context.client.id} initialSections={initialTimelineSections} initialEntries={initialTimelineEntries} initialLastSubmittedAt={initialTimelineLastSubmittedAt} initialHasUnpublishedChanges={initialTimelineHasUnpublishedChanges} />}
            {activeSection === "vendors"   && <VendorPortalSection token={token} context={context} />}
            {activeSection === "budget"    && <BudgetPortalSection token={token} />}
            {activeSection === "ask"       && <LuvAskPortalSection token={token} onNavigateToGuide={() => setActiveSection("guide")} />}
            {activeSection === "documents" && <CoupleDocumentsPortalSection token={token} onNavigate={setActiveSection} />}
            {activeSection === "payments"  && <PaymentPortalSection token={token} />}
            {activeSection === "messages"  && <PortalMessageSection token={token} venueName={context.venue.name} />}
            {activeSection === "account"   && <AccountSection token={token} context={context} venueName={context.venue.name} />}
            {activeSection === "requests"  && <RequestsPortalSection token={token} onNavigate={setActiveSection} />}
          </div>
        )}
      </main>

      {/* Venue Brand Experience Phase 1: "Powered by Hello to Cheers" removed — the
          venue is the only visible brand on this customer-facing surface. */}
      <footer className="text-center py-4 text-[10px] border-t border-border/30" style={{ color: TAUPE }}>
        {context.venue.name}
      </footer>
    </div>
  );
}

// ── Desktop Quick Actions Sidebar ─────────────────────────────────────────────

// ── Key Dates card — venue-authored (Program 4, Initiative C, Phase 3):
// "the couple should feel that the venue has already prepared everything
// for them." Self-fetching like RequestsSummaryCard; renders nothing until
// the venue has actually set at least one date.
function KeyDatesCard({ token }: { token: string }) {
  const [keyDates, setKeyDates] = React.useState<PortalKeyDate[] | null>(null);

  React.useEffect(() => {
    fetch(`/api/portal/key-dates?token=${token}`)
      .then((r) => r.json())
      .then((d: { keyDates?: PortalKeyDate[] }) => setKeyDates(d.keyDates ?? []));
  }, [token]);

  if (!keyDates || keyDates.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const next = keyDates.find((k) => k.date >= today) ?? keyDates[0];
  const upcoming = keyDates.filter((k) => k.id !== next.id).slice(0, 3);

  return (
    <div className="w-full rounded-2xl border bg-card p-5" style={{ borderColor: "#E8E3DC" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">📅</span>
      </div>
      <p className="text-sm font-semibold text-heading leading-snug">{next.label}</p>
      <p className="text-[11px] text-muted-foreground mt-1">
        {new Date(next.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>
      {next.note && <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{next.note}</p>}
      {upcoming.length > 0 && (
        <div className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: "#E8E3DC" }}>
          {upcoming.map((k) => (
            <div key={k.id} className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{k.label}</span>
              <span className="text-[11px] font-medium text-heading">
                {new Date(k.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Program 4, Initiative D, Phase 4 (2026-07-23) — the four cards that sit
// "immediately below the hero" and "represent the operational relationship
// with the venue": Your Venue Team, Your Next Steps, Payments, Timeline.
// Each is a small, self-contained card in the same visual language as the
// sidebar cards above, so they read as one family. ─────────────────────────

const ROLE_LABEL: Record<string, string> = { owner: "Owner", manager: "Venue Manager", coordinator: "Coordinator", staff: "Team" };

function VenueTeamCard({ token, onNavigate }: { token: string; onNavigate: (s: PortalSection) => void }) {
  const [team, setTeam] = React.useState<PortalVenueTeamMember[] | null>(null);

  React.useEffect(() => {
    fetch(`/api/portal/venue-team?token=${token}`)
      .then((r) => r.json())
      .then((d: { team?: PortalVenueTeamMember[] }) => setTeam(d.team ?? []));
  }, [token]);

  if (!team) return null;
  const shown = team.slice(0, 3);

  // "Meet Your Venue Team" — 2026-07-23: "It feels dramatically more
  // welcoming" than a single name. Each member gets their own row with
  // role and a real Email action (venue_staff.email); Message stays one
  // shared button since messaging is a single venue-wide thread, not
  // per-staff-member.
  return (
    <div className="rounded-2xl border bg-card p-5" style={{ borderColor: "#E8E3DC" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: SAGE }}>👋 Meet Your Venue Team</p>
      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground">Your venue team will appear here.</p>
      ) : (
        <div className="space-y-2.5">
          {shown.map((m) => (
            <div key={m.id} className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: SAGE }}>
                {m.fullName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-heading truncate">{m.fullName}</p>
                <p className="text-[11px] text-muted-foreground">{m.title || ROLE_LABEL[m.role] || "Team"}</p>
              </div>
              {m.email && (
                <a href={`mailto:${m.email}`} title={`Email ${m.fullName}`}
                  className="shrink-0 h-7 w-7 rounded-lg border flex items-center justify-center hover:opacity-80"
                  style={{ borderColor: "#E8E3DC", color: SAGE }}>
                  ✉️
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => onNavigate("messages")}
        className="mt-3.5 w-full text-xs font-semibold py-2 rounded-xl text-white transition-opacity hover:opacity-90"
        style={{ background: SAGE }}>
        💬 Message
      </button>
    </div>
  );
}

// "The single most important dashboard card... it should never simply show
// 'tasks.' It should answer: what do I need to do next?" (2026-07-23) —
// reuses the exact same cross-system synthesis (buildUnifiedTaskList) the
// Tasks page itself uses, so "Sign Contract"/"Pay Deposit"/"Complete
// Questionnaire" all show up here even though none of them live in the
// venue_tasks table. Everything already existed; it just wasn't surfaced
// on the dashboard yet.
function NextStepsCard({ token, tasks, onNavigate }: { token: string; tasks: PortalTask[]; onNavigate: (s: PortalSection) => void }) {
  const [requests, setRequests] = React.useState<PortalRequestSummary[]>([]);
  const [paymentSchedules, setPaymentSchedules] = React.useState<PaymentScheduleLite[]>([]);
  const [questionnaire, setQuestionnaire] = React.useState<{ status: string } | null>(null);
  const [documents, setDocuments] = React.useState<{ id: string; docType: string; name: string; status: string | null; signToken?: string | null }[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    Promise.all([
      fetch(`/api/portal/requests?token=${token}`).then((r) => r.json()).catch(() => ({ requests: [] })),
      fetch(`/api/portal/payments?token=${token}`).then((r) => r.json()).catch(() => ({ schedules: [] })),
      fetch(`/api/portal/questionnaire?token=${token}`).then((r) => r.json()).catch(() => ({ questionnaire: null })),
      fetch(`/api/portal/documents?token=${token}`).then((r) => r.json()).catch(() => ({ documents: [] })),
    ]).then(([requestsRes, paymentsRes, questionnaireRes, documentsRes]) => {
      setRequests(requestsRes.requests ?? []);
      setPaymentSchedules(paymentsRes.schedules ?? []);
      setQuestionnaire(questionnaireRes.questionnaire ? { status: questionnaireRes.questionnaire.status } : null);
      setDocuments(documentsRes.documents ?? []);
      setLoaded(true);
    });
  }, [token]);

  const required = tasks.filter((t) => t.isRequired);
  const readiness = required.length > 0
    ? Math.round((required.filter((t) => t.status === "complete").length / required.length) * 100)
    : 0;

  const items = loaded ? buildUnifiedTaskList({
    venueTasks: tasks, requests, paymentSchedules, questionnaire, documents,
    timelineHasUnpublishedChanges: false,
  }).slice(0, 5) : [];

  return (
    <div className="rounded-2xl border bg-card p-5" style={{ borderColor: "#E8E3DC" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: SAGE }}>✅ Your Next Steps</p>
        {required.length > 0 && <span className="text-[11px] font-semibold text-muted-foreground">{readiness}%</span>}
      </div>
      {required.length > 0 && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
          <div className="h-full rounded-full" style={{ width: `${readiness}%`, background: SAGE }} />
        </div>
      )}
      {!loaded ? (
        <div className="space-y-1.5">
          {[1, 2].map((i) => <div key={i} className="h-3.5 rounded-full bg-muted animate-pulse" style={{ width: `${70 - i * 10}%` }} />)}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">You&apos;re all caught up — nothing due right now.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((t) => (
            <p key={t.id} className="text-xs text-heading truncate flex items-center gap-1.5">
              <Check className="h-3 w-3 shrink-0 opacity-40" /> {t.title}
            </p>
          ))}
        </div>
      )}
      <button type="button" onClick={() => onNavigate("tasks")}
        className="mt-3.5 w-full text-xs font-semibold py-2 rounded-xl text-white transition-opacity hover:opacity-90"
        style={{ background: SAGE }}>
        Open Tasks
      </button>
    </div>
  );
}

type PaymentScheduleLite = { title: string; lineItems: { id: string; label: string; amount: number; dueDate: string | null; status: string }[] };

function PaymentsCard({ token, onNavigate }: { token: string; onNavigate: (s: PortalSection) => void }) {
  const [schedules, setSchedules] = React.useState<PaymentScheduleLite[] | null>(null);

  React.useEffect(() => {
    fetch(`/api/portal/payments?token=${token}`)
      .then((r) => r.json())
      .then((d: { schedules?: PaymentScheduleLite[] }) => setSchedules(d.schedules ?? []));
  }, [token]);

  if (!schedules) return null;
  const lineItems = schedules.flatMap((s) => s.lineItems);
  const outstanding = lineItems.filter((li) => li.status !== "paid");
  const remaining = outstanding.reduce((sum, li) => sum + li.amount, 0);
  const total = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const paidPct = total > 0 ? Math.round(((total - remaining) / total) * 100) : 0;
  const next = outstanding.filter((li) => li.dueDate).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))[0] ?? null;
  const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  // Payments deserves prominence — "couples worry about money" (2026-07-23)
  // — Remaining Balance, Next Payment + Due Date, Payment Plan Progress,
  // Pay Now, all in one place.
  return (
    <div className="rounded-2xl border bg-card p-5" style={{ borderColor: "#E8E3DC" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: SAGE }}>💳 Payments</p>
      {lineItems.length === 0 ? (
        <p className="text-xs text-muted-foreground">Your payment schedule will appear here.</p>
      ) : outstanding.length === 0 ? (
        <p className="text-sm font-semibold text-heading">All paid up ✦</p>
      ) : (
        <>
          <p className="font-heading text-2xl font-bold text-heading">{fmt(remaining)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">remaining balance</p>
          {next && (
            <p className="text-[11px] text-muted-foreground mt-2">
              Next payment: {next.label} — due {new Date(next.dueDate! + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          )}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Payment plan progress</span>
              <span className="text-[10px] font-semibold text-muted-foreground">{paidPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${paidPct}%`, background: SAGE }} />
            </div>
          </div>
        </>
      )}
      <button type="button" onClick={() => onNavigate("payments")}
        className="mt-3.5 w-full text-xs font-semibold py-2 rounded-xl text-white transition-opacity hover:opacity-90"
        style={{ background: SAGE }}>
        {outstanding.length > 0 ? "Pay Now" : "View Payments"}
      </button>
    </div>
  );
}

function TimelineCard({ token, onNavigate }: { token: string; onNavigate: (s: PortalSection) => void }) {
  const [entries, setEntries] = React.useState<PortalTimelineEntry[] | null>(null);

  React.useEffect(() => {
    fetch(`/api/portal/timeline?token=${token}`)
      .then((r) => r.json())
      .then((d: { entries?: PortalTimelineEntry[] }) => setEntries(d.entries ?? []));
  }, [token]);

  if (!entries) return null;
  const upcoming = [...entries].filter((e) => e.entryTime).sort((a, b) => (a.entryTime! < b.entryTime! ? -1 : 1)).slice(0, 2);

  return (
    <div className="rounded-2xl border bg-card p-5" style={{ borderColor: "#E8E3DC" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: SAGE }}>🕒 Timeline</p>
      {upcoming.length === 0 ? (
        <p className="text-xs text-muted-foreground">Your day-of schedule is being built with your venue.</p>
      ) : (
        <div className="space-y-1.5">
          {upcoming.map((e) => (
            <p key={e.id} className="text-xs text-heading">
              <span className="font-semibold">{e.entryTime}</span> — {e.title}
            </p>
          ))}
        </div>
      )}
      <button type="button" onClick={() => onNavigate("timeline")}
        className="mt-3.5 w-full text-xs font-semibold py-2 rounded-xl text-white transition-opacity hover:opacity-90"
        style={{ background: SAGE }}>
        View Timeline
      </button>
    </div>
  );
}

// The four cards together, as one grid — "these four cards should
// represent the operational relationship with the venue," placed
// immediately below the hero on both mobile and desktop (not sidebar-only).
// "A single large planning progress bar... every completed task moves it,
// every upload moves it, every payment moves it, every questionnaire moves
// it. This becomes addictive." (2026-07-23) — one composite percentage
// across every system that already tracks completion, not a new metric:
// required venue tasks, payment line items, the questionnaire, and sent
// contracts. Placed directly below the hero, above the four venue cards.
function WeddingPlanningProgressCard({ token, tasks }: { token: string; tasks: PortalTask[] }) {
  const [paymentSchedules, setPaymentSchedules] = React.useState<PaymentScheduleLite[] | null>(null);
  const [questionnaire, setQuestionnaire] = React.useState<{ status: string } | null | undefined>(undefined);
  const [documents, setDocuments] = React.useState<{ docType: string; status: string | null }[] | null>(null);

  React.useEffect(() => {
    fetch(`/api/portal/payments?token=${token}`).then((r) => r.json())
      .then((d: { schedules?: PaymentScheduleLite[] }) => setPaymentSchedules(d.schedules ?? [])).catch(() => setPaymentSchedules([]));
    fetch(`/api/portal/questionnaire?token=${token}`).then((r) => r.json())
      .then((d: { questionnaire?: { status: string } | null }) => setQuestionnaire(d.questionnaire ?? null)).catch(() => setQuestionnaire(null));
    fetch(`/api/portal/documents?token=${token}`).then((r) => r.json())
      .then((d: { documents?: { docType: string; status: string | null }[] }) => setDocuments(d.documents ?? [])).catch(() => setDocuments([]));
  }, [token]);

  if (paymentSchedules === null || questionnaire === undefined || documents === null) return null;

  const required = tasks.filter((t) => t.isRequired);
  const paymentItems = paymentSchedules.flatMap((s) => s.lineItems);
  const contracts = documents.filter((d) => d.docType === "contract" && (d.status === "sent" || d.status === "signed"));

  let completed = 0;
  let total = 0;
  completed += required.filter((t) => t.status === "complete").length; total += required.length;
  completed += paymentItems.filter((li) => li.status === "paid").length; total += paymentItems.length;
  completed += contracts.filter((c) => c.status === "signed").length; total += contracts.length;
  if (questionnaire) { total += 1; if (questionnaire.status === "submitted" || questionnaire.status === "completed") completed += 1; }

  if (total === 0) return null;
  const pct = Math.round((completed / total) * 100);

  return (
    <div className="rounded-2xl border bg-card p-5" style={{ borderColor: "#E8E3DC" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-heading">Wedding Planning Progress</p>
        <span className="font-heading text-xl font-bold" style={{ color: SAGE }}>{pct}%</span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, var(--venue-primary), var(--venue-secondary))` }} />
      </div>
    </div>
  );
}

function YourVenueCards({ token, tasks, onNavigate }: { token: string; tasks: PortalTask[]; onNavigate: (s: PortalSection) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: SAGE }}>Your Venue</p>
      <WeddingPlanningProgressCard token={token} tasks={tasks} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <VenueTeamCard token={token} onNavigate={onNavigate} />
        <NextStepsCard token={token} tasks={tasks} onNavigate={onNavigate} />
        <PaymentsCard token={token} onNavigate={onNavigate} />
        <TimelineCard token={token} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

// Program 4, Initiative D, Phase 5 (2026-07-23) — "Only after the venue
// section should the couple's own planning appear... These are engagement
// tools. They should not compete visually with the venue relationship."
// Quieter than YourVenueCards: smaller cards, muted icons, no white filled
// buttons — a tap target, not an operational status card.
const WEDDING_CARDS: { id: PortalSection; icon: string; label: string }[] = [
  { id: "website", icon: "🌐", label: "Wedding Website" },
  { id: "guests",  icon: "👥", label: "Guest List" },
  { id: "budget",  icon: "💰", label: "Budget" },
  { id: "seating", icon: "🪑", label: "Seating" },
  { id: "todos",   icon: "✨", label: "Plans" },
  { id: "story",   icon: "💍", label: "Our Story" },
  { id: "ask",     icon: "💗", label: "Luv" },
];

// "I wouldn't leave Luv buried. Instead I'd give Luv one small card every
// day... Tiny. Never overwhelming." (2026-07-23) — promoted out of the
// desktop-only sidebar into the main dashboard flow. Tries specific,
// real signals first (an upcoming key date within the week, an
// unstarted questionnaire), then falls back to the existing mood-based
// getLuvMessage() — never a blank or generic-feeling card.
function LuvDailyCard({ token, du, guestTotal, readiness }: { token: string; du: number | null; guestTotal: number; readiness: number }) {
  const [keyDates, setKeyDates] = React.useState<PortalKeyDate[] | null>(null);
  const [questionnaire, setQuestionnaire] = React.useState<{ status: string } | null | undefined>(undefined);

  React.useEffect(() => {
    fetch(`/api/portal/key-dates?token=${token}`).then((r) => r.json())
      .then((d: { keyDates?: PortalKeyDate[] }) => setKeyDates(d.keyDates ?? [])).catch(() => setKeyDates([]));
    fetch(`/api/portal/questionnaire?token=${token}`).then((r) => r.json())
      .then((d: { questionnaire?: { status: string } | null }) => setQuestionnaire(d.questionnaire ?? null)).catch(() => setQuestionnaire(null));
  }, [token]);

  if (keyDates === null || questionnaire === undefined) return null;

  const today = new Date();
  const inSevenDays = new Date(today.getTime() + 7 * 86400000);
  const soonKeyDate = keyDates
    .filter((k) => { const d = new Date(k.date + "T12:00:00"); return d >= today && d <= inSevenDays; })
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0] ?? null;

  let message: string;
  if (soonKeyDate) {
    const weekday = new Date(soonKeyDate.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
    message = `Your ${soonKeyDate.label.toLowerCase()} is ${weekday}.`;
  } else if (questionnaire && questionnaire.status !== "submitted" && questionnaire.status !== "completed") {
    message = "Your questionnaire is ready whenever you'd like to fill it out.";
  } else {
    message = getLuvMessage(du, guestTotal, readiness);
  }

  return (
    <div className="rounded-2xl px-4 py-3.5 flex items-start gap-2.5"
      style={{ background: `${ROSE}08`, border: `1px solid ${ROSE}25` }}>
      <span style={{ color: ROSE, fontSize: 15 }}>💗</span>
      <p className="text-xs leading-relaxed" style={{ color: "#5A3235" }}>
        <span className="font-semibold">Luv says…</span> "{message}"
      </p>
    </div>
  );
}

function YourWeddingSection({ guestStats, todoCount, onNavigate }: { guestStats: GuestStats | null; todoCount: number; onNavigate: (s: PortalSection) => void }) {
  const previewFor = (id: PortalSection): string | null => {
    if (id === "guests" && guestStats?.total) return `${guestStats.total} guests`;
    if (id === "todos" && todoCount > 0) return `${todoCount} on your list`;
    return null;
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/50">Your Wedding</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {WEDDING_CARDS.map((c) => (
          <button key={c.id} type="button" onClick={() => onNavigate(c.id)}
            className="rounded-xl border bg-card/60 px-3 py-3.5 text-left hover:bg-card hover:shadow-sm transition-all"
            style={{ borderColor: "#EDE8E1" }}>
            <p className="text-lg opacity-80">{c.icon}</p>
            <p className="text-[11px] font-medium text-heading/85 mt-1.5 leading-snug">{c.label}</p>
            {previewFor(c.id) && <p className="text-[10px] text-muted-foreground mt-0.5">{previewFor(c.id)}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}

function QuickActionsSidebar({
  token, context, onNavigate, recentActivity,
  showLuvIntro, onDismissLuvIntro,
}: {
  token: string; context: PortalContext;
  onNavigate: (s: PortalSection) => void;
  recentActivity: RecentActivity | null;
  showLuvIntro: boolean; onDismissLuvIntro: () => void;
}) {
  const du = context.event ? daysUntil(context.event.eventDate) : null;
  const bracket = getSuggestionBracket(du);

  return (
    <>
      {/* ── Requests summary (Wedding Workspace – Request Experience, Phase 1) ── */}
      <RequestsSummaryCard token={token} onNavigate={onNavigate} />

      {/* ── Key Dates — venue-authored, Program 4 Initiative C Phase 3 ── */}
      <KeyDatesCard token={token} />

      {/* Program 4, Initiative D, Phase 8/9 (2026-07-23): the Guest List,
          Planning, and Venue Tasks cards that used to live here were
          removed — YourVenueCards' Next Steps card and YourWeddingSection
          (both now in the main column, on every breakpoint, not
          desktop-sidebar-gated) already cover Tasks/Guests/Plans. Showing
          the same status twice reads as clutter, not hospitality; this
          sidebar's job now is purely the supplementary, inspirational
          layer beneath that. */}

      {/* Coming Up */}
      <ComingUpCard bracket={bracket} onNavigate={onNavigate} />

      {/* Venue Note */}
      <VenueNoteCard venueName={context.venue.name} />

      {/* Most Couples Like You */}
      <MostCouplesCard bracket={bracket} />

      {/* This Week — live activity feed */}
      <YourWeekCard activity={recentActivity} />

      {/* Luv's one-time intro — shown once, ever, only to genuinely new
          couples (Luv Experience Completion, Work Stream 5). */}
      {showLuvIntro && (
        <LuvIntroCard
          body="I'll help you stay organized throughout your planning."
          ctaLabel="Let's start with your first task"
          onCtaClick={() => onNavigate("tasks")}
          onDismiss={onDismissLuvIntro}
        />
      )}

      {/* 2026-07-23: the sidebar's own "From Luv" quote card was removed —
          LuvDailyCard now gives Luv one small, contextual card in the main
          dashboard flow (every breakpoint, not desktop-sidebar-only);
          showing the same getLuvMessage() text twice on desktop was
          exactly the kind of clutter trimmed elsewhere on this pass. */}

      {/* Inspiration */}
      <InspirationCard bracket={bracket} />
    </>
  );
}
