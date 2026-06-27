export type InvoiceStatus = "draft" | "sent" | "paid" | "void";

export type InvoiceLineItemType =
  | "package" | "addon" | "inventory" | "discount" | "fee" | "tax" | "deposit" | "item";

export type InvoiceLineItem = {
  id: string;
  invoiceId: string;
  venueId: string;
  packageId: string | null;
  type: InvoiceLineItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;  // quantity × unitPrice
  sortOrder: number;
  createdAt: string;
};

export type Invoice = {
  id: string;
  venueId: string;
  clientId: string | null;
  eventId: string | null;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  balanceDue: number;
  notes: string | null;
  dueDate: string | null;
  issuedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Embedded
  clientName: string | null;
  eventDate: string | null;
  eventName: string | null;
};

export type InvoiceWithLineItems = Invoice & {
  lineItems: InvoiceLineItem[];
};

export type InvoiceActivity = {
  id: string;
  venueId: string;
  invoiceId: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
};

export type InvoiceLineItemInput = {
  type: InvoiceLineItemType;
  description: string;
  quantity: string;
  unitPrice: string;
  packageId: string;
};

export type InvoiceInput = {
  clientId: string;
  eventId: string;
  notes: string;
  dueDate: string;
};

export type InvoiceErrors = Record<string, string>;

export type InvoiceActionResult =
  | { ok: true }
  | { ok: false; errors?: InvoiceErrors; message?: string };

export type CreateInvoiceResult =
  | { ok: true; invoiceId: string }
  | { ok: false; errors?: InvoiceErrors; message?: string };

export type AddLineItemResult =
  | { ok: true; item: InvoiceLineItem }
  | { ok: false; errors?: InvoiceErrors; message?: string };
