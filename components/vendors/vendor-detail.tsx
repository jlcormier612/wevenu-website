"use client";

import * as React from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Globe, Mail, Pencil, Phone, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteVendorAction } from "@/app/(app)/vendors/actions";
import { DocumentsSection } from "@/components/documents/documents-section";
import { VendorCategoryBadge } from "@/components/vendors/vendor-category-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTime } from "@/lib/vendors/constants";
import type { VendorWithEvents } from "@/lib/vendors/types";
import type { Document } from "@/lib/documents/types";

export function VendorDetail({ vendor, documents = [] }: { vendor: VendorWithEvents; documents?: Document[] }) {
  const router = useRouter();
  const [deletePending, startDelete] = React.useTransition();

  function handleDelete() {
    if (!confirm(`Remove ${vendor.name} from your vendor directory?`)) return;
    startDelete(async () => {
      const result = await deleteVendorAction(vendor.id);
      if (result.ok) { toast.success("Vendor removed."); router.push("/vendors"); router.refresh(); }
      else toast.error(result.message ?? "Could not remove vendor.");
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground"
            render={<Link href="/vendors" />}>
            <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Vendors
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-medium text-heading">{vendor.name}</h1>
            {vendor.isPreferred && (
              <Badge variant="default" className="gap-1">
                <Star className="h-3 w-3" /> Preferred
              </Badge>
            )}
          </div>
          <VendorCategoryBadge category={vendor.category} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" render={<Link href={`/vendors/${vendor.id}/edit`} />}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
            onClick={handleDelete} disabled={deletePending}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            {deletePending ? "Removing…" : "Remove"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            {documents.length > 0 && <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{documents.length}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Contact information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {/* Website URL — primary, shown prominently before other contact fields */}
            {vendor.website && (
              <a
                href={vendor.website.startsWith("http") ? vendor.website : `https://${vendor.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm font-medium text-primary hover:border-primary/40 hover:bg-muted/60 transition-colors"
              >
                <Globe className="h-4 w-4 shrink-0" />
                <span className="truncate">{vendor.website}</span>
                <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
            )}
            {[
              { icon: Mail, label: "Email", value: vendor.email, href: vendor.email ? `mailto:${vendor.email}` : null },
              { icon: Phone, label: "Phone", value: vendor.phone, href: vendor.phone ? `tel:${vendor.phone}` : null },
            ].map(({ icon: Icon, label, value, href }) =>
              value ? (
                <div key={label} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground mt-0.5">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    {href ? (
                      <a href={href} className="text-sm font-medium text-primary hover:underline" target="_blank" rel="noopener noreferrer">{value}</a>
                    ) : (
                      <p className="text-sm font-medium text-foreground">{value}</p>
                    )}
                  </div>
                </div>
              ) : null,
            )}
            {vendor.contactName && (
              <div>
                <p className="text-xs text-muted-foreground">Primary contact</p>
                <p className="text-sm font-medium text-foreground">{vendor.contactName}</p>
              </div>
            )}
            {/* Social media links */}
            {[
              { label: "Instagram", value: vendor.instagramUrl },
              { label: "Facebook",  value: vendor.facebookUrl  },
              { label: "Pinterest", value: vendor.pinterestUrl },
              { label: "TikTok",   value: vendor.tiktokUrl    },
            ].filter((s) => s.value).map(({ label, value }) => {
              const href = value!.startsWith("http") ? value! : `https://${value}`;
              return (
                <div key={label} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground mt-0.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <a href={href} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline break-all">
                      {value}
                    </a>
                  </div>
                </div>
              );
            })}
            {!vendor.website && !vendor.email && !vendor.phone && !vendor.contactName && !vendor.instagramUrl && (
              <p className="text-sm text-muted-foreground">No contact details recorded.</p>
            )}
          </CardContent>
        </Card>

        {/* Notes */}
        {vendor.notes && (
          <Card>
            <CardHeader><CardTitle className="text-base">Internal notes</CardTitle></CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-foreground">{vendor.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Event history */}
      {vendor.assignments.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Event history</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {vendor.assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/events/${a.eventId}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {a.eventName}
                    </Link>
                    {a.eventDate && (
                      <p className="text-xs text-muted-foreground">{formatDate(a.eventDate)}</p>
                    )}
                  </div>
                  {a.arrivalTime && (
                    <p className="shrink-0 text-xs text-muted-foreground">
                      Arrival {formatTime(a.arrivalTime)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
              <CardDescription>Contracts, insurance certificates, menus, and other vendor files.</CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentsSection
                entityType="vendor"
                entityId={vendor.id}
                venueId={vendor.venueId}
                initialDocuments={documents}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}
