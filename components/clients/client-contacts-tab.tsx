"use client";

/**
 * ClientContactsTab — "People" tab on the client detail page.
 *
 * Shows all contacts associated with this client/event:
 *   - Primary couple (from clients table, read-only here)
 *   - Additional contacts (from client_contacts table)
 *
 * Coordinators can add, edit, and remove contacts.
 * Each contact has a portal role and optional portal link.
 *
 * Architecture: portal access ≠ messaging access (Weven lesson).
 * Portal role lives here. Messaging participants are managed separately.
 */

import * as React from "react";

import { useRouter } from "next/navigation";
import { Copy, Link, Loader2, Mail, Pencil, Phone, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  createContactAction, createContactPortalAction,
  deleteContactAction, updateContactAction,
} from "@/app/(app)/clients/[id]/contact-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ClientContact, ContactPortalRole, ContactRelationship } from "@/lib/contacts/types";
import {
  PORTAL_ROLE_DESCRIPTIONS, PORTAL_ROLE_LABELS, RELATIONSHIP_LABELS,
} from "@/lib/contacts/types";

const ROSE = "#D8A7AA";

type PrimaryPerson = { name: string; email: string | null; phone?: string | null; role: string };

type ContactForm = {
  firstName: string; lastName: string; email: string; phone: string;
  relationship: string; roleLabel: string;
  portalRole: string; receivesReminders: boolean; notes: string;
  isPayer: boolean; isDecisionMaker: boolean; isEmergencyContact: boolean;
};

const EMPTY_FORM: ContactForm = {
  firstName: "", lastName: "", email: "", phone: "",
  relationship: "", roleLabel: "", portalRole: "", receivesReminders: false, notes: "",
  isPayer: false, isDecisionMaker: false, isEmergencyContact: false,
};

function PortalRoleBadge({ role }: { role: ContactPortalRole | null }) {
  if (!role) return <span className="text-xs text-muted-foreground">No portal access</span>;
  const colors: Record<ContactPortalRole, string> = {
    full_access: "bg-green-50 text-green-700 border-green-200",
    planning: "bg-blue-50 text-blue-700 border-blue-200",
    financial: "bg-amber-50 text-amber-700 border-amber-200",
    view_only: "bg-gray-50 text-gray-600 border-gray-200",
    reminders_only: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors[role]}`}>
      {PORTAL_ROLE_LABELS[role]}
    </span>
  );
}

function ContactCard({
  contact, clientId, onEdit, onDelete,
}: { contact: ClientContact; clientId: string; onEdit: () => void; onDelete: () => void }) {
  const [generatingLink, setGeneratingLink] = React.useState(false);

  async function handleCreatePortal() {
    setGeneratingLink(true);
    const label = contact.roleLabel ?? contact.firstName;
    const result = await createContactPortalAction(clientId, contact.id, label);
    setGeneratingLink(false);
    if (result.ok && result.token) {
      const url = `${window.location.origin}/p/${result.token}`;
      await navigator.clipboard.writeText(url);
      toast.success(`Portal link for ${label} copied to clipboard.`);
    } else {
      toast.error("Could not generate portal link.");
    }
  }

  return (
    <div className="group flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-heading">
            {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
          </p>
          {contact.roleLabel && (
            <span className="text-xs text-muted-foreground">· {contact.roleLabel}</span>
          )}
          {contact.relationship && (
            <Badge variant="outline" className="text-[10px]">
              {RELATIONSHIP_LABELS[contact.relationship]}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {contact.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email}</span>}
          {contact.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone}</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {contact.isPayer && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Payer</span>}
          {contact.isDecisionMaker && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Decision maker</span>}
          {contact.isEmergencyContact && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Emergency contact</span>}
          <PortalRoleBadge role={contact.portalRole} />
          {contact.portalRole && contact.portalRole !== "reminders_only" && (
            <button type="button" onClick={handleCreatePortal} disabled={generatingLink}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5">
              {generatingLink ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link className="h-3 w-3" />}
              Generate portal link
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
        <button type="button" onClick={onEdit} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onDelete} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ContactFormPanel({
  initial, onSave, onCancel, pending, label,
}: { initial: ContactForm; onSave: (f: ContactForm) => void; onCancel: () => void; pending: boolean; label: string }) {
  const [f, setF] = React.useState(initial);
  const set = <K extends keyof ContactForm>(k: K, v: ContactForm[K]) => setF(p => ({ ...p, [k]: v }));

  return (
    <div className="rounded-xl border border-ring bg-card p-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">First name *</Label>
          <Input value={f.firstName} onChange={e => set("firstName", e.target.value)} placeholder="Sarah" autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Last name</Label>
          <Input value={f.lastName} onChange={e => set("lastName", e.target.value)} placeholder="Johnson" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input type="email" value={f.email} onChange={e => set("email", e.target.value)} placeholder="sarah@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Phone</Label>
          <Input type="tel" value={f.phone} onChange={e => set("phone", e.target.value)} placeholder="(555) 000-0000" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Relationship</Label>
          <Select value={f.relationship} onValueChange={v => set("relationship", v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {(Object.entries(RELATIONSHIP_LABELS) as [ContactRelationship, string][]).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Role label <span className="font-normal text-muted-foreground">(displayed in portal)</span></Label>
          <Input value={f.roleLabel} onChange={e => set("roleLabel", e.target.value)} placeholder="Dad, MOH, Wedding Planner…" />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <Label className="text-xs">Portal access</Label>
          <Select value={f.portalRole || "__none__"} onValueChange={v => set("portalRole", v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No portal access</SelectItem>
              {(Object.entries(PORTAL_ROLE_LABELS) as [ContactPortalRole, string][]).map(([v, l]) => (
                <SelectItem key={v} value={v}>
                  <div>
                    <p>{l}</p>
                    <p className="text-xs text-muted-foreground">{PORTAL_ROLE_DESCRIPTIONS[v]}</p>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={f.receivesReminders} onCheckedChange={v => set("receivesReminders", v)} />
          <Label className="text-xs cursor-pointer">Receives email reminders</Label>
        </div>
        <div className="sm:col-span-2 grid grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={f.isPayer} onCheckedChange={v => set("isPayer", v)} />
            <Label className="text-xs cursor-pointer">Payer</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={f.isDecisionMaker} onCheckedChange={v => set("isDecisionMaker", v)} />
            <Label className="text-xs cursor-pointer">Decision maker</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={f.isEmergencyContact} onCheckedChange={v => set("isEmergencyContact", v)} />
            <Label className="text-xs cursor-pointer">Emergency contact</Label>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="button" size="sm" disabled={!f.firstName.trim() || pending} onClick={() => onSave(f)}>
          {pending ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />Saving…</> : label}
        </Button>
      </div>
    </div>
  );
}

export function ClientContactsTab({
  clientId, primaryPeople, initialContacts,
}: { clientId: string; primaryPeople: PrimaryPerson[]; initialContacts: ClientContact[] }) {
  const router = useRouter();
  const [contacts, setContacts] = React.useState(initialContacts);
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [addPending, startAdd] = React.useTransition();
  const [editPending, startEdit] = React.useTransition();

  function handleAdd(f: ContactForm) {
    startAdd(async () => {
      const result = await createContactAction(clientId, {
        firstName: f.firstName, lastName: f.lastName || undefined,
        email: f.email || undefined, phone: f.phone || undefined,
        relationship: (f.relationship as ContactRelationship) || undefined,
        roleLabel: f.roleLabel || undefined,
        portalRole: (f.portalRole as ContactPortalRole) || undefined,
        receivesReminders: f.receivesReminders,
        isPayer: f.isPayer, isDecisionMaker: f.isDecisionMaker, isEmergencyContact: f.isEmergencyContact,
      });
      if (result.ok) { toast.success("Contact added."); setShowAdd(false); router.refresh(); }
      else toast.error(result.message ?? "Could not add contact.");
    });
  }

  function handleEdit(contactId: string, f: ContactForm) {
    startEdit(async () => {
      const result = await updateContactAction(clientId, contactId, {
        firstName: f.firstName, lastName: f.lastName || undefined,
        email: f.email || undefined, phone: f.phone || undefined,
        relationship: (f.relationship as ContactRelationship) || undefined,
        roleLabel: f.roleLabel || undefined,
        portalRole: (f.portalRole as ContactPortalRole) || undefined,
        receivesReminders: f.receivesReminders,
        isPayer: f.isPayer, isDecisionMaker: f.isDecisionMaker, isEmergencyContact: f.isEmergencyContact,
      });
      if (result.ok) { toast.success("Contact updated."); setEditingId(null); router.refresh(); }
      else toast.error(result.message ?? "Could not update contact.");
    });
  }

  async function handleDelete(contactId: string, name: string) {
    if (!confirm(`Remove ${name} from this client's contacts?`)) return;
    await deleteContactAction(clientId, contactId);
    setContacts(p => p.filter(c => c.id !== contactId));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {/* Primary couple — read-only display */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Primary Contacts</p>
        <div className="rounded-xl border border-border bg-card divide-y divide-border/50">
          {primaryPeople.map((person, i) => (
            <div key={i} className="flex items-start gap-3 py-3 px-4">
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-sm font-medium text-heading">{person.name}</p>
                <p className="text-xs text-muted-foreground">{person.role}</p>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {person.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{person.email}</span>}
                  {person.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{person.phone}</span>}
                </div>
              </div>
              <PortalRoleBadge role="full_access" />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
          Primary contacts are managed on the Couple tab. They always have full portal access.
        </p>
      </div>

      {/* Additional contacts */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Additional People {contacts.length > 0 && `(${contacts.length})`}
        </p>
        {contacts.length === 0 && !showAdd ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center space-y-2">
            <p className="text-sm font-medium text-heading">No additional contacts yet</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Add parents, wedding party, planners, or anyone else involved in this event.
              Each person gets their own portal access level and notification preferences.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card px-4">
            {contacts.map(contact => (
              editingId === contact.id ? (
                <div key={contact.id} className="py-3 border-b border-border/50 last:border-0">
                  <ContactFormPanel
                    initial={{
                      firstName: contact.firstName, lastName: contact.lastName ?? "",
                      email: contact.email ?? "", phone: contact.phone ?? "",
                      relationship: contact.relationship ?? "", roleLabel: contact.roleLabel ?? "",
                      portalRole: contact.portalRole ?? "", receivesReminders: contact.receivesReminders, notes: contact.notes ?? "",
                      isPayer: contact.isPayer, isDecisionMaker: contact.isDecisionMaker, isEmergencyContact: contact.isEmergencyContact,
                    }}
                    onSave={f => handleEdit(contact.id, f)}
                    onCancel={() => setEditingId(null)}
                    pending={editPending}
                    label="Save contact"
                  />
                </div>
              ) : (
                <ContactCard
                  key={contact.id} contact={contact} clientId={clientId}
                  onEdit={() => setEditingId(contact.id)}
                  onDelete={() => handleDelete(contact.id, [contact.firstName, contact.lastName].filter(Boolean).join(" "))}
                />
              )
            ))}
          </div>
        )}

        {showAdd ? (
          <div className="mt-3">
            <ContactFormPanel
              initial={EMPTY_FORM}
              onSave={handleAdd}
              onCancel={() => setShowAdd(false)}
              pending={addPending}
              label="Add contact"
            />
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add Contact
          </Button>
        )}
      </div>

      {/* Principle note */}
      <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-1">
        <p className="text-[11px] font-semibold text-muted-foreground">Portal access ≠ Messaging access</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Portal access controls what each person can see and do in their planning workspace.
          Messaging participants are managed separately from the Messages tab — someone may have
          portal access but not be included in every conversation thread.
        </p>
      </div>
    </div>
  );
}
