/**
 * Migration Center CSV column auto-match.
 *
 * Exact label/key match alone misses real provider exports (Tripleseat
 * `first_name`, HoneyBook-adjacent `Full Name`, third-party `E-mail Address`).
 * Normalize by stripping non-alphanumerics, then apply a small alias table.
 * Never invents mappings for ambiguous headers — leaves them unmapped.
 */

export type MappableField = { key: string; label: string };

/** Compact form for comparison: "First Name" / "first_name" / "firstName" → "firstname". */
export function compactHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Extra aliases beyond field key + compacted label.
 * Keys are canonical Migration Center field keys; values are compacted header forms.
 */
const FIELD_ALIASES: Record<string, readonly string[]> = {
  firstName: ["firstname", "first", "fname", "givenname", "clientfirstname", "contactfirstname"],
  lastName: ["lastname", "last", "lname", "surname", "familyname", "clientlastname", "contactlastname"],
  name: [
    "name",
    "fullname",
    "full_name",
    "clientname",
    "clientfullname",
    "contactname",
    "couplename",
    "bridegroom",
    "primarycontact",
  ],
  partnerFirstName: ["partnerfirstname", "partnerfirst", "spousefirstname", "bridefirstname", "groomfirstname"],
  partnerLastName: ["partnerlastname", "partnerlast", "spouselastname", "bridelastname", "groomlastname"],
  email: ["email", "emailaddress", "e-mail", "mail", "contactemail", "primaryemail"],
  phone: ["phone", "phonenumber", "mobile", "mobilephone", "cellphone", "tel", "telephone", "contactphone"],
  eventDate: ["eventdate", "weddingdate", "date", "eventday", "ceremonydate"],
  eventType: ["eventtype", "type", "occasion"],
  guestCount: ["guestcount", "guests", "estimatedguests", "headcount"],
  internalNotes: ["internalnotes", "notes", "note", "comments", "comment", "notescomments"],
  sourceId: ["sourceid", "id", "recordid", "accountid", "contactid", "externalid"],
};

export function autoMapHeaders(
  headers: string[],
  fields: MappableField[],
): Record<string, string> {
  const usedHeaders = new Set<string>();
  const mapping: Record<string, string> = {};

  for (const field of fields) {
    const wanted = new Set<string>([
      compactHeader(field.key),
      compactHeader(field.label),
      ...(FIELD_ALIASES[field.key] ?? []).map(compactHeader),
    ]);
    // Drop empty compact forms
    for (const w of [...wanted]) {
      if (!w) wanted.delete(w);
    }

    const found = headers.find((h) => {
      if (usedHeaders.has(h)) return false;
      return wanted.has(compactHeader(h));
    });
    if (found) {
      mapping[field.key] = found;
      usedHeaders.add(found);
    }
  }

  return mapping;
}
