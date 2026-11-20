/**
 * Booking Workspace identity helpers.
 * Client/couple name is primary; event name is never used as the H1.
 */
import { clientDisplayName } from "@/lib/clients/constants";

export type BookingRelationshipContact = {
  firstName: string | null;
  lastName: string | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  phone?: string | null;
  email?: string | null;
  partnerEmail?: string | null;
  partnerPhone?: string | null;
};

/**
 * Primary heading for the Booking Workspace: the client record's display name.
 * Falls back to event.clientName, then event.name — never parses the event title.
 */
export function bookingClientHeadingName(input: {
  contact?: BookingRelationshipContact | null;
  clientName?: string | null;
  eventName: string;
}): string {
  const c = input.contact;
  if (c) {
    const fromRecord = clientDisplayName(
      c.firstName ?? "",
      c.lastName ?? "",
      c.partnerFirstName,
      c.partnerLastName,
    ).trim();
    if (fromRecord) return fromRecord;
  }
  const stored = input.clientName?.trim();
  if (stored) return stored;
  return input.eventName;
}

export type BookingContactPerson = {
  name: string;
  email?: string;
  phone?: string;
};

/**
 * Compact header contact people: individual names only (not the combined couple H1).
 * Omits empty email/phone. Omits a person with no name and no contact fields.
 */
export function bookingContactPeople(
  contact: BookingRelationshipContact,
): BookingContactPerson[] {
  const people: BookingContactPerson[] = [];

  const primaryName = [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
  const primaryEmail = contact.email?.trim() || undefined;
  const primaryPhone = contact.phone?.trim() || undefined;
  if (primaryName || primaryEmail || primaryPhone) {
    people.push({
      name: primaryName,
      email: primaryEmail,
      phone: primaryPhone,
    });
  }

  const partnerName = [contact.partnerFirstName, contact.partnerLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const partnerEmail = contact.partnerEmail?.trim() || undefined;
  const partnerPhone = contact.partnerPhone?.trim() || undefined;
  if (partnerName || partnerEmail || partnerPhone) {
    people.push({
      name: partnerName,
      email: partnerEmail,
      phone: partnerPhone,
    });
  }

  return people;
}
