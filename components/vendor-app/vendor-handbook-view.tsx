"use client";

import * as React from "react";
import { MapPin, Phone, Globe, HelpCircle, Users, Car, CloudRain, Hotel, Info } from "lucide-react";

import type { VendorHandbook } from "@/lib/vendor-handbook/service";

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-border bg-card p-4 space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h2>
      <div className="text-sm text-foreground/90 whitespace-pre-wrap">{children}</div>
    </div>
  );
}

/**
 * Vendor Workspace Realignment, Phase 9 — the Vendor Handbook. Reuses
 * venue_operational_info, the same table backing the couple portal's Venue
 * Guide, through get_vendor_handbook(s). Audience visibility + dual copy are
 * resolved in the service layer via projectGuideForAudience(..., "vendors").
 */
export function VendorHandbookView({ handbook }: { handbook: VendorHandbook }) {
  const { venue, operationalInfo: info } = handbook;
  const address = [venue.addressLine1, venue.addressLine2, [venue.city, venue.stateRegion].filter(Boolean).join(", "), venue.postalCode]
    .filter(Boolean).join(", ");

  const hasAnyInfo = !!info && !!(
    info.parkingInfo ||
    info.transportation ||
    info.ceremonyInstructions ||
    info.policies ||
    info.rainPlan ||
    info.nearbyAccommodations ||
    info.hotelBlocks.length ||
    info.thingsToDo ||
    info.importantContacts.length ||
    info.faqs.length
  );

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-border bg-card p-4 space-y-2">
        <h2 className="text-base font-bold text-foreground">{venue.name}</h2>
        <div className="space-y-1 text-sm text-muted-foreground">
          {address && (
            <a href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-primary hover:underline">
              <MapPin className="h-3.5 w-3.5 shrink-0" /> {address}
            </a>
          )}
          {venue.phone && (
            <a href={`tel:${venue.phone}`} className="flex items-center gap-1.5 hover:text-primary hover:underline">
              <Phone className="h-3.5 w-3.5 shrink-0" /> {venue.phone}
            </a>
          )}
          {venue.website && (
            <a href={venue.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary hover:underline">
              <Globe className="h-3.5 w-3.5 shrink-0" /> {venue.website}
            </a>
          )}
        </div>
      </div>

      {!hasAnyInfo ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {venue.name} hasn&apos;t added parking, load-in, or venue-rules details yet.
        </p>
      ) : (
        <>
          {info!.parkingInfo && (
            <Section
              icon={Car}
              title={info!.parkingUsesVendorOverride ? "Parking & Load-in" : "Parking"}
            >
              {info!.parkingInfo}
            </Section>
          )}
          {info!.transportation && <Section icon={MapPin} title="Directions">{info!.transportation}</Section>}
          {info!.ceremonyInstructions && <Section icon={Users} title="Setup Instructions">{info!.ceremonyInstructions}</Section>}
          {info!.policies && <Section icon={HelpCircle} title="Venue Rules">{info!.policies}</Section>}
          {info!.rainPlan && <Section icon={CloudRain} title="Rain Plan">{info!.rainPlan}</Section>}

          {(info!.hotelBlocks.length > 0 || info!.nearbyAccommodations) && (
            <Section icon={Hotel} title="Accommodations">
              <div className="space-y-2">
                {info!.hotelBlocks.map((h, i) => (
                  <div key={i}>
                    <p className="font-medium text-foreground">{h.name}</p>
                    {h.notes && <p className="text-muted-foreground">{h.notes}</p>}
                  </div>
                ))}
                {info!.nearbyAccommodations && <p>{info!.nearbyAccommodations}</p>}
              </div>
            </Section>
          )}

          {info!.thingsToDo && <Section icon={Info} title="Things To Know">{info!.thingsToDo}</Section>}

          {info!.importantContacts.length > 0 && (
            <Section icon={Phone} title="Venue Contacts">
              <div className="space-y-2">
                {info!.importantContacts.map((c, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-foreground">{c.name} <span className="text-muted-foreground font-normal">— {c.role}</span></span>
                    {c.phone && <a href={`tel:${c.phone}`} className="text-primary hover:underline shrink-0">{c.phone}</a>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {info!.faqs.length > 0 && (
            <Section icon={HelpCircle} title="FAQs">
              <div className="space-y-3">
                {info!.faqs.map((f, i) => (
                  <div key={i}>
                    <p className="font-medium text-foreground">{f.question}</p>
                    <p className="text-muted-foreground">{f.answer}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
