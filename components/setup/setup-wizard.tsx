"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveSetupProgressAction, submitVenueSetupAction } from "@/app/setup/actions";
import {
  BrandStep,
  BusinessHoursStep,
  OriginStep,
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
  OnboardingPersona,
  VenueSetupErrors,
  VenueSetupInput,
} from "@/lib/venue/types";
import {
  SETUP_STEPS,
  type SetupStepId,
  validateStep,
  validateVenueSetup,
} from "@/lib/venue/validation";

const SCREENS = ["welcome", "origin", ...SETUP_STEPS] as const;
type ScreenId = (typeof SCREENS)[number];

/**
 * Luv's own voice narrating the journey, not a generic banner — this is the
 * one place "Let's get Willow Creek ready" actually lives. Shown once the
 * venue has a name, above every step from "venue-details" onward.
 */
function journeyLine(name: string, persona: OnboardingPersona | null): string {
  const trimmed = name.trim();
  if (persona === "weven_returning") {
    return `Welcome back — let's get ${trimmed} moved over and ready to welcome its next couple.`;
  }
  if (persona === "switching") {
    return `Let's get ${trimmed} moved over and ready to welcome its next couple.`;
  }
  return `Let's get ${trimmed} ready to welcome its next couple.`;
}

export function SetupWizard({
  ownerEmail,
  initialInput,
  resumeStep,
}: {
  ownerEmail: string;
  /** Present when resuming a partially-completed venue (Guided Setup, Phase 1). */
  initialInput?: VenueSetupInput;
  resumeStep?: SetupStepId;
}) {
  const router = useRouter();
  const [input, setInput] = React.useState<VenueSetupInput>(
    () => initialInput ?? createInitialSetupInput(ownerEmail),
  );
  // Guided Setup §1.2 (2026-07-22) — Financial Setup folded into the
  // "payments" step, so the separate post-creation ?financial=1 screen is
  // gone; this inline flag is what shows the short completion moment that
  // used to live there before handing off to the dashboard.
  const [complete, setComplete] = React.useState(false);
  const [stepIndex, setStepIndex] = React.useState(() =>
    initialInput ? SCREENS.indexOf(resumeStep ?? "venue-info") : 0,
  );
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

  /**
   * Guided Setup, Phase 1 — fire-and-forget progress save. Called every time
   * a real setup step (not welcome/origin) is left, so an abandoned wizard
   * resumes instead of starting over. Never awaited by the caller and never
   * surfaces an error to the venue — a failed progress save just means the
   * next one (or the final authoritative submit) tries again.
   */
  function saveProgress(data: VenueSetupInput, completedStep: SetupStepId) {
    if (!data.name.trim()) return;
    void saveSetupProgressAction(data, completedStep);
  }

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
        setComplete(true);
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
      setStepIndex(SCREENS.indexOf("origin"));
      return;
    }
    if (screen === "origin") {
      // OriginStep advances itself via onChoose — nothing to do here.
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
    saveProgress(input, step);
    setStepIndex((i) => i + 1);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  if (complete) {
    return (
      <div className="mx-auto max-w-xl space-y-8 py-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-medium tracking-tight text-heading">Your venue is ready</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{input.name}</span> is set up and your workspace is live.
          </p>
        </div>
        <Button size="lg" onClick={() => { router.push("/dashboard"); router.refresh(); }}>
          Enter your workspace
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (screen === "welcome") {
    return <WelcomeStep onStart={() => setStepIndex(SCREENS.indexOf("origin"))} />;
  }

  if (screen === "origin") {
    return (
      <OriginStep
        onChoose={(persona) => {
          set("onboardingPersona", persona);
          setStepIndex(SCREENS.indexOf("venue-info"));
          if (typeof window !== "undefined") window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  const step = screen as SetupStepId;
  const meta = STEP_META[step];
  const totalSteps = SETUP_STEPS.length;
  const stepNumber = SETUP_STEPS.indexOf(step) + 1;
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

      {input.name.trim() && step !== "venue-info" && (
        <p className="text-sm font-medium text-primary">
          💗 {journeyLine(input.name, input.onboardingPersona)}
        </p>
      )}

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
