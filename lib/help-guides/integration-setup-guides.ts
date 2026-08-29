/**
 * Backward-compatible exports for integration-specific setup guides.
 * The complete setup library now lives in setup-guides.ts so Setup Hub and
 * integration onboarding share one source of truth.
 */
export {
  INTEGRATION_SETUP_GUIDES,
  getIntegrationSetupGuide,
} from "@/lib/help-guides/setup-guides";
export type {
  SetupGuideStep as IntegrationGuideStep,
  SetupGuide as IntegrationSetupGuide,
} from "@/lib/help-guides/setup-guides";
