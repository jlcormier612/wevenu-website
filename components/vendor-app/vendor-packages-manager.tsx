"use client";

import * as React from "react";
import { Loader2, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createVendorPackageAction,
  deleteVendorPackageAction,
  toggleVendorPackageAction,
  updateVendorPackageAction,
} from "@/app/vendor/packages/actions";
import type { VendorPackage, VendorPackageInput } from "@/lib/vendors/types";

const PRICE_TYPE_LABELS: Record<VendorPackageInput["priceType"], string> = {
  fixed:      "Fixed price",
  starting_at: "Starting at",
  custom:     "Custom quote",
  contact:    "Contact for pricing",
};

const EMPTY_INPUT: VendorPackageInput = {
  name: "", description: "", price: "", priceType: "fixed", isActive: true,
};

function formatPrice(pkg: VendorPackage): string {
  if (pkg.priceType === "custom")  return "Custom quote";
  if (pkg.priceType === "contact") return "Contact for pricing";
  if (!pkg.price) return "—";
  const formatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(pkg.price);
  return pkg.priceType === "starting_at" ? `Starting at ${formatted}` : formatted;
}

function PackageForm({
  initial = EMPTY_INPUT,
  onSave,
  onCancel,
  saving,
}: {
  initial?: VendorPackageInput;
  onSave: (input: VendorPackageInput) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = React.useState<VendorPackageInput>(initial);
  const set = <K extends keyof VendorPackageInput>(k: K, v: VendorPackageInput[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const showPrice = form.priceType === "fixed" || form.priceType === "starting_at";

  return (
    <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pkg-name">Package name <span className="text-destructive">*</span></Label>
          <Input id="pkg-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Full Day Coverage" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pkg-price-type">Pricing type</Label>
          <Select value={form.priceType} onValueChange={(v) => set("priceType", v as VendorPackageInput["priceType"])} items={PRICE_TYPE_LABELS}>
            <SelectTrigger id="pkg-price-type"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(PRICE_TYPE_LABELS) as [VendorPackageInput["priceType"], string][]).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showPrice && (
        <div className="space-y-1.5">
          <Label htmlFor="pkg-price">Price (USD)</Label>
          <Input
            id="pkg-price"
            type="number"
            min="0"
            step="1"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
            placeholder="e.g. 1200"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="pkg-desc">Description</Label>
        <Textarea
          id="pkg-desc"
          rows={2}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What's included in this package…"
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch id="pkg-active" checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
        <Label htmlFor="pkg-active" className="cursor-pointer">Active (visible to venues)</Label>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button
          type="button"
          size="sm"
          onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
        >
          {saving ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : "Save Package"}
        </Button>
      </div>
    </div>
  );
}

export function VendorPackagesManager({ packages: initial }: { packages: VendorPackage[] }) {
  const [packages, setPackages] = React.useState<VendorPackage[]>(initial);
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [addingSaving, setAddingSaving] = React.useState(false);

  async function handleCreate(input: VendorPackageInput) {
    setAddingSaving(true);
    try {
      const result = await createVendorPackageAction(input);
      if (!result.ok) {
        toast.error("errors" in result ? Object.values(result.errors ?? {})[0] : (result.message ?? "Could not create package."));
        return;
      }
      toast.success("Package created.");
      setShowAdd(false);
      // Refresh optimistically with a placeholder until real data
      const newPkg: VendorPackage = {
        id:          crypto.randomUUID(),
        vendorId:    "",
        name:        input.name,
        description: input.description || null,
        price:       input.price ? Number(input.price) : null,
        priceType:   input.priceType,
        isActive:    input.isActive,
        sortOrder:   packages.length,
        createdAt:   new Date().toISOString(),
        updatedAt:   new Date().toISOString(),
      };
      setPackages((p) => [...p, newPkg]);
    } finally {
      setAddingSaving(false);
    }
  }

  async function handleUpdate(id: string, input: VendorPackageInput) {
    setSavingId(id);
    try {
      const result = await updateVendorPackageAction(id, input);
      if (!result.ok) {
        toast.error("errors" in result ? Object.values(result.errors ?? {})[0] : (result.message ?? "Could not update package."));
        return;
      }
      toast.success("Package updated.");
      setEditingId(null);
      setPackages((pkgs) => pkgs.map((p) =>
        p.id === id
          ? { ...p, name: input.name, description: input.description || null, price: input.price ? Number(input.price) : null, priceType: input.priceType, isActive: input.isActive }
          : p,
      ));
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggle(id: string, isActive: boolean) {
    setSavingId(id);
    try {
      const result = await toggleVendorPackageAction(id, isActive);
      if (!result.ok) { toast.error(result.message ?? "Could not update."); return; }
      setPackages((pkgs) => pkgs.map((p) => p.id === id ? { ...p, isActive } : p));
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    setSavingId(id);
    try {
      const result = await deleteVendorPackageAction(id);
      if (!result.ok) { toast.error(result.message ?? "Could not delete."); return; }
      toast.success("Package deleted.");
      setPackages((pkgs) => pkgs.filter((p) => p.id !== id));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {packages.length === 0 && !showAdd ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">No packages yet</p>
          <p className="text-xs mt-1 text-muted-foreground mb-4">
            Add packages to show venues what you offer.
          </p>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />Add Package
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {packages.map((pkg) => (
              editingId === pkg.id ? (
                <PackageForm
                  key={pkg.id}
                  initial={{
                    name: pkg.name,
                    description: pkg.description ?? "",
                    price: pkg.price != null ? String(pkg.price) : "",
                    priceType: pkg.priceType,
                    isActive: pkg.isActive,
                  }}
                  onSave={(input) => handleUpdate(pkg.id, input)}
                  onCancel={() => setEditingId(null)}
                  saving={savingId === pkg.id}
                />
              ) : (
                <div
                  key={pkg.id}
                  className={`flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-opacity ${pkg.isActive ? "" : "opacity-60"}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{pkg.name}</p>
                      <Badge variant={pkg.isActive ? "default" : "outline"} className="text-xs">
                        {pkg.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {pkg.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{pkg.description}</p>
                    )}
                    <p className="text-sm font-medium text-foreground mt-1">{formatPrice(pkg)}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Switch
                      checked={pkg.isActive}
                      onCheckedChange={(v) => handleToggle(pkg.id, v)}
                      disabled={savingId === pkg.id}
                      aria-label={pkg.isActive ? "Deactivate" : "Activate"}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingId(pkg.id)}
                      disabled={savingId === pkg.id}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(pkg.id)}
                      disabled={savingId === pkg.id}
                    >
                      {savingId === pkg.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />
                      }
                    </Button>
                  </div>
                </div>
              )
            ))}
          </div>

          {showAdd ? (
            <PackageForm
              onSave={handleCreate}
              onCancel={() => setShowAdd(false)}
              saving={addingSaving}
            />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />Add Package
            </Button>
          )}
        </>
      )}
    </div>
  );
}
