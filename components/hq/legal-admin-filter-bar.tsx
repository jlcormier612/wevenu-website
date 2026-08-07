"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LEGAL_ACCEPTANCE_USER_TYPES,
  LEGAL_ACCEPTANCE_USER_TYPE_LABELS,
} from "@/lib/legal/required-documents";
import {
  LEGAL_DOCUMENT_TYPES,
  LEGAL_DOCUMENT_TYPE_TITLES,
} from "@/lib/legal/types";

export function LegalAdminFilterBar({
  showVenue = true,
  showRelationship = true,
}: {
  showVenue?: boolean;
  showRelationship?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [role, setRole] = useState(searchParams.get("role") ?? "");
  const [documentType, setDocumentType] = useState(
    searchParams.get("document") ?? "",
  );
  const [relationshipId, setRelationshipId] = useState(
    searchParams.get("relationship") ?? "",
  );
  const [venueId, setVenueId] = useState(searchParams.get("venue") ?? "");

  function applyFilters() {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (role) params.set("role", role);
    if (documentType) params.set("document", documentType);
    if (showRelationship && relationshipId.trim()) {
      params.set("relationship", relationshipId.trim());
    }
    if (showVenue && venueId.trim()) params.set("venue", venueId.trim());
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function clearFilters() {
    setSearch("");
    setRole("");
    setDocumentType("");
    setRelationshipId("");
    setVenueId("");
    startTransition(() => {
      router.push(pathname);
    });
  }

  return (
    <form
      className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        applyFilters();
      }}
    >
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
        <Label htmlFor="legal-admin-search">Search</Label>
        <Input
          id="legal-admin-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="User, venue, relationship, document, version…"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="legal-admin-role">Role</Label>
        <select
          id="legal-admin-role"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="">All roles</option>
          {LEGAL_ACCEPTANCE_USER_TYPES.map((r) => (
            <option key={r} value={r}>
              {LEGAL_ACCEPTANCE_USER_TYPE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="legal-admin-document">Document</Label>
        <select
          id="legal-admin-document"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
        >
          <option value="">All documents</option>
          {LEGAL_DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {LEGAL_DOCUMENT_TYPE_TITLES[t]}
            </option>
          ))}
        </select>
      </div>
      {showRelationship ? (
        <div className="space-y-1.5">
          <Label htmlFor="legal-admin-relationship">Relationship ID</Label>
          <Input
            id="legal-admin-relationship"
            value={relationshipId}
            onChange={(e) => setRelationshipId(e.target.value)}
            placeholder="Optional UUID"
          />
        </div>
      ) : null}
      {showVenue ? (
        <div className="space-y-1.5">
          <Label htmlFor="legal-admin-venue">Venue ID</Label>
          <Input
            id="legal-admin-venue"
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
            placeholder="Optional UUID"
          />
        </div>
      ) : null}
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Applying…" : "Apply filters"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={clearFilters}
        >
          Clear
        </Button>
      </div>
    </form>
  );
}
