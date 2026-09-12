/**
 * Legacy SetupWizard removed as a user-facing product experience.
 * Venue setup now uses provisioning + guided intake + Setup Hub.
 * This file remains only so accidental imports fail loudly in tests.
 */
export function SetupWizard(): never {
  throw new Error(
    "SetupWizard has been removed. Use /onboarding/intake and /setup-hub.",
  );
}
