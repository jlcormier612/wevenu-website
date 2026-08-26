/**
 * Stripe Connect OAuth authorize URL.
 * Prefers runtime STRIPE_CLIENT_ID (ECS secret) then NEXT_PUBLIC_STRIPE_CLIENT_ID.
 */

export function buildStripeConnectUrl(
  venueId: string,
  returnTo: "settings" | "onboarding" = "settings",
): string | null {
  const clientId =
    process.env.STRIPE_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_STRIPE_CLIENT_ID?.trim() ||
    "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  if (!clientId || clientId === "CHANGE_ME" || !venueId.trim()) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "read_write",
    redirect_uri: `${appUrl}/api/stripe/callback`,
    state: `${venueId}:${returnTo}`,
  });

  return `https://connect.stripe.com/oauth/authorize?${params}`;
}
