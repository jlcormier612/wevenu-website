"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { submitVenueSetupAction } from "@/app/setup/actions";
import {
  BrandStep,
  BusinessHoursStep,
  OwnerStep,
  PaymentsStep,
  ReviewStep,
  STEP_META,
  VenueDetailsStep,
  VenueInfoStep,
  WelcomeStep,
} from "@/components/setup/setup-steps";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createInitialSetupInput } from "@/lib/venue/constants";
import type {
  BusinessHourInput,
  VenueSetupErrors,
  VenueSetupInput,
} from "@/lib/venue/types";
import {
  SETUP_STEPS,
  type SetupStepId,
  validateStep,
  validateVenueSetup,
} from "@/lib/venue/validation";

const SCREENS = ["welcome", ...SETUP_STEPS] as const;
type ScreenId = (typeof SCREENS)[number];

export function SetupWizard({ ownerEmail }: { ownerEmail: string }) {
  const router = useRouter();
  const [input, setInput] = React.useState<VenueSetupInput>(() =>
    createInitialSetupInput(ownerEmail),
  );
  const [stepIndex, setStepIndex] = React.useState(0);
  const [errors, setErrors] = React.useState<VenueSetupErrors>({});
  const [pending, startTransition] = React.useTransition();

  const set = React.useCallback(
    <K extends keyof VenueSetupInput>(key: K, value: VenueSetupInput[K]) => {
      setInput((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key as string];
        return next;
      });
    },
    [],
  );

  const setHour = React.useCallback(
    (dayOfWeek: number, patch: Partial<BusinessHourInput>) => {
      setInput((prev) => ({
        ...prev,
        businessHours: prev.businessHours.map((h) =>
          h.dayOfWeek === dayOfWeek ? { ...h, ...patch } : h,
        ),
      }));
      setErrors((prev) => {
        const key = `hours.${dayOfWeek}`;
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [],
  );

  const goToStep = React.useCallback((step: SetupStepId) => {
    setStepIndex(SCREENS.indexOf(step));
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }, []);

  const screen: ScreenId = SCREENS[stepIndex];

  const firstInvalidStep = React.useCallback(
    (data: VenueSetupInput): SetupStepId | undefined =>
      SETUP_STEPS.find((s) => Object.keys(validateStep(s, data)).length > 0),
    [],
  );

  function handleSubmit() {
    const allErrors = validateVenueSetup(input);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      const step = firstInvalidStep(input);
      if (step) goToStep(step);
      toast.error("Some details need attention before we can create your venue.");
      return;
    }
    startTransition(async () => {
      const result = await submitVenueSetupAction(input);
      if (result.ok) {
        // Financial Setup (QuickBooks/Stripe connect) needs a real venue_id
        // to exist, so it lives as its own post-creation route rather than a
        // client-state screen here — see app/setup/page.tsx.
        router.push("/setup?financial=1");
        return;
      }
      if (result.errors && Object.keys(result.errors).length > 0) {
        setErrors(result.errors);
        const step = firstInvalidStep(input);
        if (step) goToStep(step);
        toast.error("Please review the highlighted fields.");
        return;
      }
      toast.error(result.message ?? "We couldn't create your venue. Please try again.");
    });
  }

  function handleContinue() {
    if (screen === "welcome") {
      setStepIndex(1);
      return;
    }
    const step = screen as SetupStepId;
    const stepErrors = validateStep(step, input);
    if (Object.keys(stepErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...stepErrors }));
      toast.error("Please fix the highlighted fields.");
      return;
    }
    if (step === "review") {
      handleSubmit();
      return;
    }
    setStepIndex((i) => i + 1);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  if (screen === "welcome") {
    return <WelcomeStep onStart={() => setStepIndex(1)} />;
  }

  const step = screen as SetupStepId;
  const meta = STEP_META[step];
  const totalSteps = SETUP_STEPS.length;
  const stepNumber = stepIndex; // welcome is 0, so setup steps are 1..N
  const progress = Math.round((stepNumber / totalSteps) * 100);
  const isReview = step === "review";

  const stepProps = { input, errors, set, setHour, goToStep };

  return (
    <div className="space-y-6 py-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Step {stepNumber} of {totalSteps}
          </span>
          <span>{progress}%</span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{meta.title}</CardTitle>
          <CardDescription>{meta.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === "venue-info" && <VenueInfoStep {...stepProps} />}
          {step === "venue-details" && <VenueDetailsStep {...stepProps} />}
          {step === "business-hours" && <BusinessHoursStep {...stepProps} />}
          {step === "brand" && <BrandStep {...stepProps} />}
          {step === "owner" && <OwnerStep {...stepProps} />}
          {step === "payments" && <PaymentsStep />}
          {step === "review" && <ReviewStep {...stepProps} />}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setStepIndex((i) => Math.max(0, i - 1));
            if (typeof window !== "undefined") window.scrollTo({ top: 0 });
          }}
          disabled={pending}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button type="button" onClick={handleContinue} disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Creating…
            </>
          ) : isReview ? (
            "Create venue"
          ) : (
            <>
              Continue
              <ArrowRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
