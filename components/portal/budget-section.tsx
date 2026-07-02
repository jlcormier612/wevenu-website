"use client";

import * as React from "react";
import { Pencil, Plus, Trash2, X, Check, ChevronDown, ChevronUp } from "lucide-react";
import type { BudgetCategory, BudgetContributor, CoupleBudget } from "@/lib/portal/types";
import { getBudgetObservations } from "@/lib/luv/portal-observations";

// ── Constants ─────────────────────────────────────────────────────────────────

const BUDGET_CATS = [
  { key: "venue",          label: "Venue & Space",       emoji: "🏛️", suggestedPct: 0.30 },
  { key: "catering",       label: "Catering & Bar",      emoji: "🍽️", suggestedPct: 0.08 },
  { key: "photography",    label: "Photography",          emoji: "📷", suggestedPct: 0.12 },
  { key: "videography",    label: "Videography",          emoji: "🎬", suggestedPct: 0.06 },
  { key: "florist",        label: "Flowers & Décor",     emoji: "💐", suggestedPct: 0.08 },
  { key: "music",          label: "Entertainment",        emoji: "🎵", suggestedPct: 0.05 },
  { key: "hair_makeup",    label: "Hair & Makeup",        emoji: "💄", suggestedPct: 0.03 },
  { key: "officiant",      label: "Officiant",            emoji: "💍", suggestedPct: 0.01 },
  { key: "transportation", label: "Transportation",       emoji: "🚗", suggestedPct: 0.02 },
  { key: "attire",         label: "Attire & Accessories", emoji: "👗", suggestedPct: 0.08 },
  { key: "stationery",     label: "Stationery",           emoji: "✉️", suggestedPct: 0.02 },
  { key: "cake",           label: "Cake & Desserts",     emoji: "🎂", suggestedPct: 0.02 },
  { key: "favors",         label: "Favors & Gifts",      emoji: "🎁", suggestedPct: 0.02 },
  { key: "misc",           label: "Miscellaneous",        emoji: "✨", suggestedPct: 0.05 },
] as const;

type CatKey = typeof BUDGET_CATS[number]["key"];

const QUICK_CONTRIBUTORS = ["The Couple", "Her Parents", "His Parents", "Both Families"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtShort = (n: number) => {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return fmt(n);
};

const parseAmt = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return isNaN(n) || n < 0 ? 0 : n;
};

function catDef(key: string) {
  return BUDGET_CATS.find(c => c.key === key) ?? { key, label: key, emoji: "✨", suggestedPct: 0 };
}

// ── Progress ring ─────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 96, stroke = 10, color = "#5D6F5D" }: {
  pct: number; size?: number; stroke?: number; color?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const overColor = "#DC6A6A";
  const displayColor = pct > 100 ? overColor : color;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EAE6E1" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={displayColor} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease" }} />
    </svg>
  );
}

// ── Insights engine ───────────────────────────────────────────────────────────

function computeInsights(budget: CoupleBudget): { type: "info" | "warn" | "good"; text: string }[] {
  const insights: { type: "info" | "warn" | "good"; text: string }[] = [];
  const totalBudgeted = budget.categories.reduce((s, c) => s + c.budgetedAmount, 0);
  const totalActual   = budget.categories.reduce((s, c) => s + c.actualAmount, 0);
  const unallocated   = budget.totalBudget - totalBudgeted;
  const pctSpent      = budget.totalBudget > 0 ? (totalActual / budget.totalBudget) * 100 : 0;

  if (totalActual > budget.totalBudget) {
    insights.push({ type: "warn", text: `You're ${fmt(totalActual - budget.totalBudget)} over your total budget.` });
  } else if (pctSpent >= 90) {
    insights.push({ type: "warn", text: `You've used ${pctSpent.toFixed(0)}% of your budget — watch the final details.` });
  }

  const overCats = budget.categories.filter(c => c.actualAmount > c.budgetedAmount && c.budgetedAmount > 0);
  for (const cat of overCats.slice(0, 2)) {
    const label = cat.customName ?? catDef(cat.categoryKey).label;
    insights.push({ type: "warn", text: `${label} is ${fmt(cat.actualAmount - cat.budgetedAmount)} over budget.` });
  }

  if (unallocated > 100) {
    insights.push({ type: "info", text: `${fmt(unallocated)} is unallocated — room to add categories or keep as buffer.` });
  }

  if (insights.length === 0 && totalActual > 0) {
    insights.push({ type: "good", text: `Looking good — every category is on track!` });
  }

  return insights;
}

// ── Category card ─────────────────────────────────────────────────────────────

function CategoryCard({ cat, dbCat, totalBudget, token, onSaved }: {
  cat: typeof BUDGET_CATS[number];
  dbCat: BudgetCategory | undefined;
  totalBudget: number;
  token: string;
  onSaved: (categoryKey: string, budgeted: number, actual: number) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [budgetStr, setBudgetStr] = React.useState("");
  const [actualStr, setActualStr] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const budgeted = dbCat?.budgetedAmount ?? 0;
  const actual   = dbCat?.actualAmount  ?? 0;
  const pct      = budgeted > 0 ? (actual / budgeted) * 100 : 0;
  const suggested = Math.round(totalBudget * cat.suggestedPct);

  function startEdit() {
    setBudgetStr(budgeted > 0 ? String(budgeted) : "");
    setActualStr(actual > 0 ? String(actual) : "");
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    const b = parseAmt(budgetStr);
    const a = parseAmt(actualStr);
    await fetch("/api/portal/budget/category", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, categoryKey: cat.key, budgetedAmount: b, actualAmount: a, displayOrder: BUDGET_CATS.findIndex(c => c.key === cat.key) }),
    });
    onSaved(cat.key, b, a);
    setSaving(false);
    setEditing(false);
  }

  const statusColor = actual === 0 && budgeted === 0
    ? "#9CA3AF"
    : actual > budgeted && budgeted > 0
    ? "#DC6A6A"
    : pct >= 80
    ? "#D97706"
    : "#5D6F5D";

  return (
    <div className={`bg-card border rounded-2xl overflow-hidden transition-shadow ${editing ? "border-[#5D6F5D]/40 shadow-md" : "border-border hover:shadow-sm"}`}>
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{cat.emoji}</span>
            <span className="font-medium text-sm truncate">{dbCat?.customName ?? cat.label}</span>
          </div>
          {!editing && (
            <button onClick={startEdit}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {!editing ? (
          <>
            {/* Amounts row */}
            <div className="flex items-end justify-between text-sm">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Budget</p>
                <p className="font-semibold" style={{ color: budgeted === 0 ? "#9CA3AF" : "inherit" }}>
                  {budgeted === 0 ? "Not set" : fmtShort(budgeted)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Actual</p>
                <p className="font-semibold" style={{ color: statusColor }}>
                  {actual === 0 ? "—" : fmtShort(actual)}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            {budgeted > 0 && (
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: statusColor }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{pct.toFixed(0)}% spent</span>
                  {actual > budgeted
                    ? <span style={{ color: "#DC6A6A" }}>{fmt(actual - budgeted)} over</span>
                    : <span>{fmt(budgeted - actual)} left</span>
                  }
                </div>
              </div>
            )}

            {budgeted === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Suggested: {fmt(suggested)} ({Math.round(cat.suggestedPct * 100)}%)
              </p>
            )}
          </>
        ) : (
          // Edit mode
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Budget</span>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input type="number" min="0" step="100" value={budgetStr}
                    onChange={e => setBudgetStr(e.target.value)}
                    placeholder="0"
                    className="w-full pl-6 pr-2 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#5D6F5D]/30 focus:border-[#5D6F5D]" />
                </div>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Actual Spent</span>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input type="number" min="0" step="100" value={actualStr}
                    onChange={e => setActualStr(e.target.value)}
                    placeholder="0"
                    className="w-full pl-6 pr-2 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-[#5D6F5D]/30 focus:border-[#5D6F5D]" />
                </div>
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Industry avg: {fmt(suggested)} ({Math.round(cat.suggestedPct * 100)}% of total)
            </p>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)}
                className="flex-1 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 py-1.5 text-xs rounded-lg font-medium text-white transition-colors"
                style={{ backgroundColor: "#5D6F5D" }}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Setup view ────────────────────────────────────────────────────────────────

function SetupView({ token, onComplete }: { token: string; onComplete: () => void }) {
  const [total, setTotal] = React.useState("");
  const [contributors, setContributors] = React.useState<{ name: string; amount: string }[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<"budget" | "contributors">("budget");

  function addContributor(name: string) {
    if (!contributors.find(c => c.name === name)) {
      setContributors(p => [...p, { name, amount: "" }]);
    }
  }

  function removeContributor(i: number) {
    setContributors(p => p.filter((_, idx) => idx !== i));
  }

  async function submit(applySuggested: boolean) {
    const totalAmt = parseAmt(total);
    if (totalAmt <= 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/portal/budget", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          totalBudget: totalAmt,
          applySuggested,
          contributors: contributors
            .filter(c => c.name.trim())
            .map(c => ({ name: c.name, amount: parseAmt(c.amount) })),
        }),
      });
      if (!res.ok) {
        setSaveError("We couldn't save your budget right now. Please refresh and try again.");
        return;
      }
      onComplete();
    } catch {
      setSaveError("Connection error. Please check your internet and try again.");
    } finally {
      setSaving(false);
    }
  }

  const totalAmt = parseAmt(total);
  const isValidTotal = totalAmt > 0;

  if (step === "budget") {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div className="text-center space-y-2">
          <p className="text-4xl">💰</p>
          <h2 className="text-xl font-semibold text-heading">Set your wedding budget</h2>
          <p className="text-sm text-muted-foreground">
            Start with your total, then we'll help you allocate it across categories.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-heading">Total wedding budget</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-muted-foreground font-light">$</span>
            <input
              type="number" min="0" step="500"
              value={total}
              onChange={e => setTotal(e.target.value)}
              placeholder="45,000"
              className="w-full pl-10 pr-4 py-4 text-2xl font-light border border-border rounded-2xl bg-background focus:outline-none focus:ring-2 focus:ring-[#5D6F5D]/30 focus:border-[#5D6F5D]"
              autoFocus
            />
          </div>
          {isValidTotal && (
            <p className="text-xs text-muted-foreground pl-1">
              Industry average for weddings in this range is around 12% for photography ({fmt(Math.round(totalAmt * 0.12))}), 30% for venue ({fmt(Math.round(totalAmt * 0.30))}).
            </p>
          )}
        </div>

        {saveError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
            {saveError}
          </p>
        )}
        <button
          onClick={() => setStep("contributors")}
          disabled={!isValidTotal}
          className="w-full py-3.5 rounded-2xl font-medium text-white transition-opacity disabled:opacity-40"
          style={{ backgroundColor: "#5D6F5D" }}>
          Continue →
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setStep("budget")} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-heading">Who's contributing?</h2>
          <p className="text-sm text-muted-foreground">Optional — helps track where funds are coming from</p>
        </div>
      </div>

      {/* Quick-add pills */}
      <div className="flex flex-wrap gap-2">
        {QUICK_CONTRIBUTORS.map(name => (
          <button key={name}
            onClick={() => addContributor(name)}
            disabled={!!contributors.find(c => c.name === name)}
            className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            + {name}
          </button>
        ))}
        <button
          onClick={() => setContributors(p => [...p, { name: "", amount: "" }])}
          className="text-xs px-3 py-1.5 rounded-full border border-dashed border-border hover:bg-muted transition-colors">
          + Other
        </button>
      </div>

      {/* Contributor rows */}
      {contributors.length > 0 && (
        <div className="space-y-2">
          {contributors.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text" value={c.name}
                onChange={e => setContributors(p => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                placeholder="Name"
                className="flex-1 px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-[#5D6F5D]/30 focus:border-[#5D6F5D]"
              />
              <div className="relative w-32 shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <input
                  type="number" min="0" value={c.amount}
                  onChange={e => setContributors(p => p.map((x, idx) => idx === i ? { ...x, amount: e.target.value } : x))}
                  placeholder="0"
                  className="w-full pl-7 pr-2 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-[#5D6F5D]/30 focus:border-[#5D6F5D]"
                />
              </div>
              <button onClick={() => removeContributor(i)}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {contributors.length > 0 && (
            <p className="text-xs text-muted-foreground pl-1">
              Total contributions: {fmt(contributors.reduce((s, c) => s + parseAmt(c.amount), 0))} of {fmt(totalAmt)}
            </p>
          )}
        </div>
      )}

      {saveError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
          {saveError}
        </p>
      )}
      <div className="pt-2 space-y-3">
        <p className="text-sm font-medium text-heading">How would you like to set up categories?</p>
        <button
          onClick={() => submit(true)} disabled={saving}
          className="w-full py-3.5 rounded-2xl font-medium text-white transition-opacity disabled:opacity-40 text-left px-5"
          style={{ backgroundColor: "#5D6F5D" }}>
          <span className="block text-sm font-semibold">Apply suggested allocations</span>
          <span className="block text-xs opacity-75 mt-0.5">We'll pre-fill 14 categories based on typical wedding budgets</span>
        </button>
        <button
          onClick={() => submit(false)} disabled={saving}
          className="w-full py-3 rounded-2xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
          Set up categories manually
        </button>
      </div>
    </div>
  );
}

// ── Contributors panel ────────────────────────────────────────────────────────

function ContributorsPanel({ budget, token, onUpdate }: {
  budget: CoupleBudget; token: string; onUpdate: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newAmt, setNewAmt] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function addContributor() {
    if (!newName.trim()) return;
    setBusy(true);
    await fetch("/api/portal/budget/contributor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, name: newName.trim(), amount: parseAmt(newAmt) }),
    });
    setNewName(""); setNewAmt(""); setAdding(false);
    setBusy(false);
    onUpdate();
  }

  async function deleteContributor(id: string) {
    setBusy(true);
    await fetch("/api/portal/budget/contributor", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, contributorId: id }),
    });
    setBusy(false);
    onUpdate();
  }

  const total = budget.contributors.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-heading">Contributors</span>
          {budget.contributors.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {budget.contributors.length} · {fmt(total)}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 space-y-3 pt-3">
          {budget.contributors.map(c => (
            <div key={c.id} className="flex items-center gap-3">
              <span className="flex-1 text-sm">{c.name}</span>
              <span className="text-sm font-medium">{fmt(c.amount)}</span>
              <button onClick={() => deleteContributor(c.id)} disabled={busy}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {adding ? (
            <div className="flex gap-2 items-center">
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Name" onKeyDown={e => e.key === "Enter" && addContributor()}
                className="flex-1 px-3 py-1.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-[#5D6F5D]/30 focus:border-[#5D6F5D]" />
              <div className="relative w-28 shrink-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <input type="number" min="0" value={newAmt} onChange={e => setNewAmt(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addContributor()}
                  placeholder="0"
                  className="w-full pl-6 pr-2 py-1.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-[#5D6F5D]/30 focus:border-[#5D6F5D]" />
              </div>
              <button onClick={addContributor} disabled={busy || !newName.trim()}
                className="p-1.5 rounded-lg text-white disabled:opacity-40 transition-colors"
                style={{ backgroundColor: "#5D6F5D" }}>
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => { setAdding(false); setNewName(""); setNewAmt(""); }}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" />
              Add contributor
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Edit total budget ─────────────────────────────────────────────────────────

function EditTotalBudget({ budget, token, onUpdate }: {
  budget: CoupleBudget; token: string; onUpdate: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(String(budget.totalBudget));
  const [saving, setSaving] = React.useState(false);

  async function save() {
    const amt = parseAmt(val);
    if (amt <= 0) return;
    setSaving(true);
    await fetch("/api/portal/budget", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, totalBudget: amt }),
    });
    setSaving(false);
    setEditing(false);
    onUpdate();
  }

  if (!editing) {
    return (
      <button onClick={() => { setVal(String(budget.totalBudget)); setEditing(true); }}
        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
        Edit total
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
        <input autoFocus type="number" min="0" step="500" value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="pl-7 pr-3 py-1.5 text-sm border border-[#5D6F5D] rounded-xl bg-background focus:outline-none w-32" />
      </div>
      <button onClick={save} disabled={saving}
        className="p-1.5 rounded-lg text-white disabled:opacity-40"
        style={{ backgroundColor: "#5D6F5D" }}>
        <Check className="h-4 w-4" />
      </button>
      <button onClick={() => setEditing(false)}
        className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Dashboard view ────────────────────────────────────────────────────────────

function DashboardView({ budget, token, onUpdate }: {
  budget: CoupleBudget; token: string; onUpdate: () => void;
}) {
  const totalBudgeted = budget.categories.reduce((s, c) => s + c.budgetedAmount, 0);
  const totalActual   = budget.categories.reduce((s, c) => s + c.actualAmount, 0);
  const remaining     = budget.totalBudget - totalActual;
  const pctSpent      = budget.totalBudget > 0 ? (totalActual / budget.totalBudget) * 100 : 0;
  const insights      = computeInsights(budget);
  const luvObs        = getBudgetObservations(
    budget.categories.map(c => ({ name: c.customName ?? c.categoryKey, budgetedAmount: c.budgetedAmount })),
    budget.totalBudget,
  );

  // Build a lookup for quick access
  const catMap = React.useMemo(() => {
    const m = new Map<string, BudgetCategory>();
    for (const c of budget.categories) m.set(c.categoryKey, c);
    return m;
  }, [budget.categories]);

  function handleCategorySaved(key: string, budgeted: number, actual: number) {
    onUpdate();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">

      {/* Summary bar */}
      <section className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-5">
          <div className="relative shrink-0">
            <ProgressRing pct={pctSpent} size={88} stroke={9} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold leading-none">{Math.round(pctSpent)}%</span>
              <span className="text-[9px] text-muted-foreground leading-none mt-0.5">spent</span>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-2xl font-light">{fmt(budget.totalBudget)}</span>
              <span className="text-sm text-muted-foreground">total budget</span>
              <EditTotalBudget budget={budget} token={token} onUpdate={onUpdate} />
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Budgeted</p>
                <p className="font-semibold">{fmtShort(totalBudgeted)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Actual</p>
                <p className="font-semibold" style={{ color: totalActual > budget.totalBudget ? "#DC6A6A" : "inherit" }}>
                  {fmtShort(totalActual)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Remaining</p>
                <p className="font-semibold" style={{ color: remaining < 0 ? "#DC6A6A" : "#5D6F5D" }}>
                  {remaining < 0 ? `-${fmtShort(Math.abs(remaining))}` : fmtShort(remaining)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Insights */}
      {insights.length > 0 && (
        <section className="space-y-2">
          {insights.map((ins, i) => (
            <div key={i} className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${
              ins.type === "warn" ? "bg-amber-50 text-amber-800 border border-amber-100" :
              ins.type === "good" ? "bg-[#5D6F5D]/8 text-[#3D5040] border border-[#5D6F5D]/15" :
              "bg-blue-50 text-blue-800 border border-blue-100"
            }`}>
              <span className="shrink-0 mt-0.5">
                {ins.type === "warn" ? "⚠️" : ins.type === "good" ? "✅" : "💡"}
              </span>
              <span>{ins.text}</span>
            </div>
          ))}
        </section>
      )}

      {/* Luv observations */}
      {luvObs.length > 0 && (
        <section className="space-y-2">
          {luvObs.map(o => (
            <div key={o.id} className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm"
              style={{ background: "#FDF5F5", border: "1px solid #D8A7AA30", color: "#5A3235" }}>
              <span className="shrink-0 mt-0.5 text-base">💗</span>
              <span className="leading-relaxed">{o.text}</span>
            </div>
          ))}
        </section>
      )}

      {/* Category grid */}
      <section className="space-y-3">
        <p className="font-semibold text-heading">Categories</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BUDGET_CATS.map(cat => (
            <CategoryCard
              key={cat.key}
              cat={cat}
              dbCat={catMap.get(cat.key)}
              totalBudget={budget.totalBudget}
              token={token}
              onSaved={handleCategorySaved}
            />
          ))}
        </div>
      </section>

      {/* Contributors */}
      <section>
        <ContributorsPanel budget={budget} token={token} onUpdate={onUpdate} />
      </section>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function BudgetSection({ token }: { token: string }) {
  const [budget, setBudget] = React.useState<CoupleBudget | null | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);

  async function load() {
    const res = await fetch(`/api/portal/budget?token=${token}`);
    const d = await res.json() as { budget?: CoupleBudget | null; error?: string };
    setBudget(d.budget ?? null);
    setLoading(false);
  }

  React.useEffect(() => { load(); }, [token]);

  async function reload() {
    const res = await fetch(`/api/portal/budget?token=${token}`);
    const d = await res.json() as { budget?: CoupleBudget | null };
    setBudget(d.budget ?? null);
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-muted-foreground">Loading your budget…</p>
      </div>
    );
  }

  if (budget === null) {
    return <SetupView token={token} onComplete={load} />;
  }

  return <DashboardView budget={budget!} token={token} onUpdate={reload} />;
}
