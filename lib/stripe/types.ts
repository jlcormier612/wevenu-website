export type StripeActionResult =
  | { ok: true; message?: string; url?: string; chargesEnabled?: boolean }
  | { ok: false; message: string };

export type CreateCheckoutSessionResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; message: string };
