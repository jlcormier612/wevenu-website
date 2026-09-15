"use client";

import { useRouter } from "next/navigation";

import { OnboardingIntakeForm, type IntakePrefill } from "@/components/onboarding/onboarding-intake-form";
import type { OnboardingIntakeInput } from "@/lib/onboarding/types";
import { submitSelfSetupIntakeAction } from "@/app/(app)/onboarding/actions";
import { bringBusinessMigrationHref } from "@/lib/onboarding/types";

export function SelfSetupIntakeClient({ prefill }: { prefill: IntakePrefill }) {
  const router = useRouter();

  async function onSubmit(intake: OnboardingIntakeInput) {
    const result = await submitSelfSetupIntakeAction(intake);
    if (!result.ok) {
      throw new Error(result.error || "Could not save intake");
    }
    const migrationHref = bringBusinessMigrationHref(intake.bringBusinessChoice);
    if (migrationHref) {
      router.push(migrationHref);
      return;
    }
    router.push("/setup-hub");
  }

  return (
    <OnboardingIntakeForm
      mode="self_setup"
      prefill={prefill}
      submitLabel="Continue"
      onSubmit={onSubmit}
    />
  );
}
