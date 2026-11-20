import Link from "next/link";
import { Mail, Phone } from "lucide-react";

import {
  bookingContactPeople,
  type BookingRelationshipContact,
} from "@/lib/clients/booking-identity";
import { formatPhoneDisplay } from "@/lib/sms/phone";

/**
 * Green-card Contact information section — Lead-style Mail/Phone icons.
 * Two equal columns on desktop; stacks on mobile. No empty second column.
 */
export function BookingContactSummary({
  contact,
  editHref,
}: {
  contact: BookingRelationshipContact & { clientId: string };
  editHref?: string;
}) {
  const people = bookingContactPeople(contact);
  const href = editHref ?? `/clients/${contact.clientId}/edit`;

  return (
    <div className="space-y-3" data-testid="booking-contact-summary">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-heading">Contact information</h3>
        <Link
          href={href}
          className="htc-record-link shrink-0 text-sm font-medium text-heading"
          data-testid="booking-edit-contact"
        >
          Edit contact
        </Link>
      </div>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contact details on file.</p>
      ) : (
        <div
          className={
            people.length > 1
              ? "grid gap-4 sm:grid-cols-2"
              : "grid gap-4 grid-cols-1"
          }
        >
          {people.map((person) => (
            <div
              key={`${person.name}:${person.email ?? ""}:${person.phone ?? ""}`}
              className="min-w-0 space-y-2"
              data-testid="booking-contact-person"
            >
              {person.name ? (
                <p className="text-sm font-medium text-heading">{person.name}</p>
              ) : null}
              {person.email ? (
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 break-all text-sm text-foreground">{person.email}</span>
                </div>
              ) : null}
              {person.phone ? (
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="text-sm text-foreground">{formatPhoneDisplay(person.phone)}</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
