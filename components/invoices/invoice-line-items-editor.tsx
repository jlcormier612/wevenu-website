"use client";

import * as React from "react";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { addLineItemAction, removeLineItemAction } from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, LINE_ITEM_TYPES } from "@/lib/invoices/constants";
import type { InvoiceLineItem, InvoiceLineItemInput, InvoiceLineItemType } from "@/lib/invoices/types";
import type { Package } from "@/lib/packages/types";

const EMPTY_INPUT: InvoiceLineItemInput = {
  type: "item", description: "", quantity: "1", unitPrice: "", packageId: "",
  discountType: "fixed", discountValue: "",
};

function LineItemRow({
  item, onRemove, removing,
}: { item: InvoiceLineItem; onRemove: () => void; removing: boolean }) {
  return (
    <div className="group grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center py-2 border-b border-border last:border-0 text-sm">
      <span className="text-foreground">{item.description}</span>
      <span className="text-muted-foreground text-right w-12">{item.quantity}×</span>
      <span className="text-muted-foreground text-right w-20">{formatCurrency(item.unitPrice)}</span>
      <span className="font-medium text-right w-20">{formatCurrency(item.amount)}</span>
      <button type="button" onClick={onRemove} disabled={removing}
        className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity" aria-label="Remove">
        {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function InvoiceLineItemsEditor({
  invoiceId, initialItems, packages, invoiceStatus,
}: {
  invoiceId: string;
  initialItems: InvoiceLineItem[];
  packages: Package[];
  invoiceStatus: string;
}) {
  const [items, setItems] = React.useState(initialItems);
  const [showAdd, setShowAdd] = React.useState(false);
  const [input, setInput] = React.useState<InvoiceLineItemInput>(EMPTY_INPUT);
  const [addPending, startAdd] = React.useTransition();
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const isEditable = invoiceStatus === "draft";

  function handlePackagePick(pkg: Package) {
    setInput({ type: "package", description: pkg.name, quantity: "1", unitPrice: String(pkg.basePrice), packageId: pkg.id });
  }

  function handleAdd() {
    startAdd(async () => {
      const result = await addLineItemAction(invoiceId, input);
      if (result.ok) {
        setItems((p) => [...p, result.item]);
        setInput(EMPTY_INPUT);
        setShowAdd(false);
      } else toast.error(result.message ?? "Could not add line item.");
    });
  }

  async function handleRemove(itemId: string) {
    setRemovingId(itemId);
    const result = await removeLineItemAction(invoiceId, itemId);
    setRemovingId(null);
    if (result.ok) setItems((p) => p.filter((i) => i.id !== itemId));
    else toast.error(result.message ?? "Could not remove.");
  }

  const total = items.reduce((s, i) => {
    if (i.type === "discount" || i.type === "deposit") return s - i.amount;
    return s + i.amount;
  }, 0);

  return (
    <div className="space-y-4">
      {/* Package picker shortcuts */}
      {isEditable && packages.length > 0 && !showAdd && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Add from catalog</p>
          <div className="flex flex-wrap gap-2">
            {packages.filter((p) => p.isActive).map((pkg) => (
              <button key={pkg.id} type="button"
                onClick={() => { handlePackagePick(pkg); setShowAdd(true); }}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-muted/40 transition-colors">
                {pkg.name} — {formatCurrency(pkg.basePrice)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Line items list */}
      {items.length > 0 && (
        <div>
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-1 border-b border-border">
            <span>Description</span>
            <span className="w-12 text-right">Qty</span>
            <span className="w-20 text-right">Unit Price</span>
            <span className="w-20 text-right">Amount</span>
            <span className="w-7" />
          </div>
          {items.map((item) => (
            <LineItemRow key={item.id} item={item}
              onRemove={() => handleRemove(item.id)}
              removing={removingId === item.id} />
          ))}
        </div>
      )}

      {items.length === 0 && !showAdd && (
        <p className="text-sm text-muted-foreground py-4 text-center">No line items yet. Add packages or custom items below.</p>
      )}

      {/* Add form */}
      {isEditable && showAdd && (
        <div className="rounded-lg border border-ring bg-card p-4 space-y-3">
          {/* Discount type toggle — only for discount/deposit items */}
          {(() => {
            const isDiscount = input.type === "discount" || input.type === "deposit";
            return (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <Select
                    value={input.type}
                    onValueChange={(v) => setInput((p) => ({ ...p, type: v as InvoiceLineItemType, discountType: "fixed", discountValue: "", unitPrice: "" }))}
                    items={LINE_ITEM_TYPES}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LINE_ITEM_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Description *</label>
                  <Input value={input.description} onChange={(e) => setInput((p) => ({ ...p, description: e.target.value }))} placeholder="Item description…" autoFocus />
                </div>
                {!isDiscount && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Quantity</label>
                      <Input type="number" value={input.quantity} onChange={(e) => setInput((p) => ({ ...p, quantity: e.target.value }))} min="0" step="0.01" className="w-24" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Unit price</label>
                      <Input value={input.unitPrice} onChange={(e) => setInput((p) => ({ ...p, unitPrice: e.target.value }))} placeholder="8,500" />
                    </div>
                  </>
                )}
                {isDiscount && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Discount type</label>
                      <div className="flex gap-1">
                        {([["fixed","$ Amount"],["percent","% of Subtotal"]] as const).map(([val, label]) => (
                          <button key={val} type="button" onClick={() => setInput((p) => ({ ...p, discountType: val, unitPrice: "", discountValue: "" }))}
                            className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${input.discountType === val ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary/40"}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">
                        {input.discountType === "percent" ? "Percentage (%)" : "Amount ($)"}
                      </label>
                      <Input
                        value={input.discountType === "percent" ? (input.discountValue ?? "") : input.unitPrice}
                        onChange={(e) => input.discountType === "percent"
                          ? setInput((p) => ({ ...p, discountValue: e.target.value }))
                          : setInput((p) => ({ ...p, unitPrice: e.target.value }))}
                        placeholder={input.discountType === "percent" ? "10" : "1,000"}
                      />
                      {input.discountType === "percent" && (
                        <p className="text-xs text-muted-foreground">Applied to current invoice subtotal at time of adding.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })()}
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setShowAdd(false); setInput(EMPTY_INPUT); }} disabled={addPending}>Cancel</Button>
            <Button type="button" size="sm" disabled={!input.description.trim() || (input.type !== "discount" && input.type !== "deposit" && !input.unitPrice) || ((input.type === "discount" || input.type === "deposit") && input.discountType === "percent" && !input.discountValue) || ((input.type === "discount" || input.type === "deposit") && input.discountType === "fixed" && !input.unitPrice) || addPending} onClick={handleAdd}>
              {addPending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Adding…</> : "Add Line Item"}
            </Button>
          </div>
        </div>
      )}

      {isEditable && !showAdd && (
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Line Item
        </Button>
      )}

      {/* Totals */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="space-y-1 text-sm min-w-48">
            <div className="flex justify-between font-semibold text-heading pt-2 border-t border-border">
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
