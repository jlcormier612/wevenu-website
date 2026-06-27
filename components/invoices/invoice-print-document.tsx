/**
 * Invoice print document — no sidebar, branded with venue logo and colors.
 * Follows the print-via-browser pattern used for day-of sheets and floor plans.
 */

import { formatCurrency, invoiceStatusLabel, lineItemTypeLabel } from "@/lib/invoices/constants";
import type { InvoiceWithLineItems } from "@/lib/invoices/types";
import type { Venue } from "@/lib/venue/types";

export function InvoicePrintDocument({
  invoice,
  venue,
}: {
  invoice: InvoiceWithLineItems;
  venue: Venue;
}) {
  const primaryColor = venue.primaryColor ?? "#5D6F5D";
  const hasDiscount = invoice.discountAmount > 0;
  const hasTax = invoice.taxAmount > 0;

  const addressParts = [
    venue.addressLine1,
    venue.addressLine2,
    venue.city && venue.stateRegion ? `${venue.city}, ${venue.stateRegion} ${venue.postalCode ?? ""}`.trim() : null,
    venue.country !== "United States" ? venue.country : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-white font-sans text-black print:text-black">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: primaryColor }} className="px-12 py-8">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            {venue.logoUrl && (
              <img src={venue.logoUrl} alt={venue.name}
                className="h-12 w-12 rounded-lg object-contain"
                style={{ background: "rgba(255,255,255,0.15)" }} />
            )}
            <div className="text-white">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-70">Invoice</p>
              <p className="mt-0.5 text-2xl font-bold">{venue.name}</p>
            </div>
          </div>
          <div className="text-right text-white">
            <p className="text-2xl font-bold tracking-wide">{invoice.invoiceNumber}</p>
            <p className="text-sm opacity-70 mt-1">{invoiceStatusLabel(invoice.status)}</p>
          </div>
        </div>
      </div>

      {/* ── Meta row ───────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-gray-50 px-12 py-4">
        <div className="grid grid-cols-3 gap-8 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Bill To</p>
            <p className="font-medium">{invoice.clientName ?? "—"}</p>
          </div>
          {invoice.issuedAt && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Issue Date</p>
              <p>{new Date(invoice.issuedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>
          )}
          {invoice.dueDate && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Due Date</p>
              <p className="font-medium">{new Date(invoice.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Line items ─────────────────────────────────────────────────── */}
      <div className="px-12 py-8">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-300">
              <th className="pb-2 text-left font-semibold text-gray-700 w-1/2">Description</th>
              <th className="pb-2 text-center font-semibold text-gray-700 w-20">Type</th>
              <th className="pb-2 text-right font-semibold text-gray-700 w-16">Qty</th>
              <th className="pb-2 text-right font-semibold text-gray-700 w-24">Unit Price</th>
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

        {/* Totals */}
        <div className="mt-6 flex justify-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between text-green-700">
                <span>Discounts / Deposits</span>
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
              <span>Total</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
            <div className={`flex justify-between font-semibold ${invoice.balanceDue > 0 ? "text-red-700" : "text-green-700"}`}>
              <span>Balance Due</span>
              <span>{invoice.balanceDue > 0 ? formatCurrency(invoice.balanceDue) : "Paid in Full"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Notes ──────────────────────────────────────────────────────── */}
      {invoice.notes && (
        <div className="border-t border-gray-200 px-12 py-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">{invoice.notes}</p>
        </div>
      )}

      {/* ── Venue contact footer ────────────────────────────────────────── */}
      <div className="border-t border-gray-200 px-12 py-6 mt-4">
        <div className="text-xs text-gray-500 space-y-0.5">
          <p className="font-medium text-gray-700">{venue.businessName ?? venue.name}</p>
          {addressParts.map((line, i) => <p key={i}>{line}</p>)}
          {venue.email && <p>{venue.email}</p>}
          {venue.phone && <p>{venue.phone}</p>}
          {venue.website && <p>{venue.website}</p>}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
