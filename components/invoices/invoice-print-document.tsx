/**
 * Invoice print document — no sidebar, branded with venue logo and colors.
 * Follows the print-via-browser pattern used for day-of sheets and floor plans.
 * Presentation polish only — totals come from the canonical invoice / payment system.
 */

import { formatCurrency, invoiceStatusLabel, lineItemTypeLabel } from "@/lib/invoices/constants";
import type { InvoiceWithLineItems } from "@/lib/invoices/types";
import { paymentMilestoneDescription } from "@/lib/payments/starters";
import type { PaymentObligationKind } from "@/lib/payments/types";
import { resolvePrintBrandColors } from "@/lib/collateral/print-brand";
import type { Venue } from "@/lib/venue/types";

export type InvoicePrintMilestone = {
  label: string;
  obligationKind: PaymentObligationKind | null;
};

export function InvoicePrintDocument({
  invoice,
  venue,
  milestone = null,
}: {
  invoice: InvoiceWithLineItems;
  venue: Venue;
  /** Next unpaid schedule item, when a linked Payment Plan exists. */
  milestone?: InvoicePrintMilestone | null;
}) {
  // Prefer branding frozen at send time; pre-existing sent invoices without a
  // snapshot fall back to live venue branding (documented — no silent backfill).
  const snap = invoice.brandingSnapshot;
  const brandSource = snap
    ? {
        primaryColor: snap.primaryColor,
        secondaryColor: snap.secondaryColor,
        accentColor: snap.accentColor,
        neutralColor: snap.neutralColor,
      }
    : venue;
  const brand = resolvePrintBrandColors(brandSource);
  const primaryColor = brand.primary;
  const accentColor = brand.accent;
  const neutralColor = brand.neutral;
  const hasDiscount = invoice.discountAmount > 0;
  const hasTax = invoice.taxAmount > 0;
  const paidToDate = Math.max(0, invoice.total - invoice.balanceDue);
  const amountDueNow = invoice.balanceDue;
  const venueDisplayName = snap?.businessName ?? snap?.name ?? venue.businessName ?? venue.name;
  const logoUrl = snap?.logoUrl ?? venue.logoUrl;
  const displayName = snap?.name ?? venue.name;
  const email = snap?.email ?? venue.email;
  const phone = snap?.phone ?? venue.phone;
  const website = snap?.website ?? venue.website;

  const addressParts = snap
    ? [
        snap.addressLine1,
        snap.addressLine2,
        snap.city && snap.stateRegion ? `${snap.city}, ${snap.stateRegion} ${snap.postalCode ?? ""}`.trim() : null,
        snap.country && snap.country !== "United States" ? snap.country : null,
      ].filter(Boolean)
    : [
        venue.addressLine1,
        venue.addressLine2,
        venue.city && venue.stateRegion ? `${venue.city}, ${venue.stateRegion} ${venue.postalCode ?? ""}`.trim() : null,
        venue.country !== "United States" ? venue.country : null,
      ].filter(Boolean);

  const defaultNotes = `Thank you for choosing ${venueDisplayName} for your celebration. If you have any questions about this invoice, please contact our team.`;
  const notes = invoice.notes?.trim() || defaultNotes;

  return (
    <div className="min-h-screen bg-white font-sans text-black print:text-black">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: primaryColor }} className="px-12 py-8">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={displayName}
                className="h-12 w-12 rounded-lg object-contain"
                style={{ background: "rgba(255,255,255,0.15)" }} />
            )}
            <div className="text-white">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Invoice</p>
              <p className="mt-0.5 text-2xl font-bold">{displayName}</p>
            </div>
          </div>
          <div className="text-right text-white">
            <p className="text-2xl font-bold tracking-wide">{invoice.invoiceNumber}</p>
            <p className="text-sm opacity-70 mt-1">{invoiceStatusLabel(invoice.status)}</p>
          </div>
        </div>
      </div>

      {/* ── Amount Due Now ─────────────────────────────────────────────── */}
      {amountDueNow > 0 && (
        <div className="border-b border-gray-200 px-12 py-6" style={{ background: neutralColor }}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Amount Due Now</p>
          <p className="text-3xl font-bold" style={{ color: accentColor }}>{formatCurrency(amountDueNow)}</p>
          {invoice.dueDate && (
            <p className="text-sm text-gray-600 mt-1">
              Due {new Date(invoice.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
          {milestone && (
            <p className="text-sm text-gray-600 mt-2 max-w-xl">
              <span className="font-medium text-gray-800">{milestone.label}. </span>
              {paymentMilestoneDescription(milestone.obligationKind, milestone.label)}
            </p>
          )}
        </div>
      )}

      {/* ── Meta row ───────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-gray-50 px-12 py-4">
        <div className="grid grid-cols-2 gap-8 text-sm md:grid-cols-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Bill To</p>
            <p className="font-medium">{invoice.clientName ?? "—"}</p>
          </div>
          {(invoice.eventName || invoice.eventDate) && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Event</p>
              {invoice.eventName && <p className="font-medium">{invoice.eventName}</p>}
              {invoice.eventDate && (
                <p className="text-gray-600">
                  {new Date(invoice.eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          )}
          {invoice.issuedAt && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Issued</p>
              <p>{new Date(invoice.issuedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>
          )}
          {invoice.dueDate && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Due</p>
              <p className="font-medium">{new Date(invoice.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Line items ─────────────────────────────────────────────────── */}
      <div className="px-12 py-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Charges</p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="pb-2 text-left font-semibold text-gray-700 w-1/2">Description</th>
              <th className="pb-2 text-center font-semibold text-gray-700 w-20">Type</th>
              <th className="pb-2 text-right font-semibold text-gray-700 w-16">Qty</th>
              <th className="pb-2 text-right font-semibold text-gray-700 w-24">Rate</th>
              <th className="pb-2 text-right font-semibold text-gray-700 w-24">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lineItems.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2.5 text-gray-900">{item.description}</td>
                <td className="py-2.5 text-center text-xs text-gray-500">{lineItemTypeLabel(item.type)}</td>
                <td className="py-2.5 text-right text-gray-700">{item.quantity}</td>
                <td className="py-2.5 text-right text-gray-700">{formatCurrency(item.unitPrice)}</td>
                <td className={`py-2.5 text-right font-medium ${item.type === "discount" || item.type === "deposit" ? "text-green-700" : "text-gray-900"}`}>
                  {item.type === "discount" || item.type === "deposit" ? `−${formatCurrency(item.amount)}` : formatCurrency(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals — contracted vs paid vs remaining vs due now */}
        <div className="mt-6 flex justify-end">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between text-green-700">
                <span>Adjustments</span>
                <span>−{formatCurrency(invoice.discountAmount)}</span>
              </div>
            )}
            {hasTax && (
              <div className="flex justify-between text-gray-700">
                <span>Tax</span>
                <span>{formatCurrency(invoice.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-gray-300 pt-2 text-base font-bold text-gray-900">
              <span>Total Contracted</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Paid to Date</span>
              <span>{formatCurrency(paidToDate)}</span>
            </div>
            <div className="flex justify-between text-gray-700">
              <span>Balance Remaining</span>
              <span>{formatCurrency(invoice.balanceDue)}</span>
            </div>
            <div className={`flex justify-between font-semibold pt-1 ${amountDueNow > 0 ? "" : "text-green-700"}`}
              style={amountDueNow > 0 ? { color: accentColor } : undefined}>
              <span>Amount Due Now</span>
              <span>{amountDueNow > 0 ? formatCurrency(amountDueNow) : "Paid in Full"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Notes ──────────────────────────────────────────────────────── */}
      <div className="border-t border-gray-200 px-12 py-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Notes from {venueDisplayName}
        </p>
        <p className="text-sm text-gray-700 whitespace-pre-line">{notes}</p>
      </div>

      {/* ── Venue contact footer ────────────────────────────────────────── */}
      <div className="border-t border-gray-200 px-12 py-6 mt-4">
        <div className="text-xs text-gray-500 space-y-0.5">
          <p className="font-medium text-gray-700">{venueDisplayName}</p>
          {addressParts.map((line, i) => <p key={i}>{line}</p>)}
          {email && <p>{email}</p>}
          {phone && <p>{phone}</p>}
          {website && <p>{website}</p>}
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
