export type StripeActionResult =
  | { ok: true }
  | { ok: false; message: string };

export type CreateCheckoutSessionResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; message: string };
