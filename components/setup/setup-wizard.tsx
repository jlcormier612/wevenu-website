"use client";

import * as React from "react";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { saveSetupProgressAction, submitVenueSetupAction } from "@/app/setup/actions";
import {
  BrandStep,
  BusinessHoursStep,
  LeadCaptureStep,
  OwnerStep,
  PathChoiceStep,
  ReviewStep,
  STEP_META,
  VenueDetailsStep,
  VenueInfoStep,
} from "@/components/setup/setup-steps";
import {
  BringYourBusinessStep,
  BusinessToolsStep,
  YourOfferingsStep,
  YourPeopleStep,
} from "@/components/setup/setup-migration-steps";
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
  SETUP_STAGES,
  SETUP_STEPS,
  STAGE_FOR_STEP,
  type SetupStepId,
  validateStep,
  validateVenueSetup,
} from "@/lib/venue/validation";

const SCREENS = ["welcome", ...SETUP_STEPS] as const;
type ScreenId = (typeof SCREENS)[number];

/**
 * Luv's own voice narrating the journey, not a generic banner — this is the
 * one place "Let's get Willow Creek ready" actually lives. Shown once the
 * venue has a name, above every step from "venue-details" onward.
 */
function journeyLine(name: string, persona: OnboardingPersona | null): string {
  const trimmed = name.trim();
  if (persona === "weven_returning") {
    return `Welcome back — let's get ${trimmed} ready to welcome its next couple.`;
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
  // Guided Setup — this inline flag shows the short completion moment
  // before handing off to the dashboard, rather than a separate route.
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

  const [progressSaving, setProgressSaving] = React.useState(false);

  /**
   * Guided Setup — await progress save before advancing so Continue never
   * implies the step was persisted when it was not.
   */
  async function saveProgress(data: VenueSetupInput, completedStep: SetupStepId): Promise<boolean> {
    if (!data.name.trim()) return true;
    setProgressSaving(true);
    try {
      const result = await saveSetupProgressAction(data, completedStep);
      if (!result.ok) {
        toast.error("Could not save your progress. Please try Continue again.");
        return false;
      }
      return true;
    } finally {
      setProgressSaving(false);
    }
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

  /** Shared by the footer's Continue button and by stages that advance
   * themselves internally (Bring Your Business drives its own sub-screens
   * before handing control back). */
  async function advanceFromStep(step: SetupStepId) {
    const ok = await saveProgress(input, step);
    if (!ok) return;
    setStepIndex((i) => i + 1);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  function handleContinue() {
    if (screen === "welcome") {
      // PathChoiceStep advances itself via onChoose — nothing to do here.
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
    void advanceFromStep(step);
  }

  if (complete) {
    const ownerFirstName = input.ownerFullName.trim().split(/\s+/)[0] ?? "";
    return (
      <div className="mx-auto max-w-xl space-y-8 py-16 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCircle2 className="h-8 w-8" />
        </span>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-medium tracking-tight text-heading">
            {ownerFirstName ? `Great start, ${ownerFirstName}!` : "Great start!"}
          </h1>
          <p className="text-sm text-muted-foreground">
            We&apos;re ready for the next step — we&apos;ll keep walking you through the
            rest of your setup, one step at a time.
          </p>
        </div>
        <Button size="lg" onClick={() => { router.push("/dashboard"); router.refresh(); }}>
          Go to my workspace
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    );
  }

  if (screen === "welcome") {
    return (
      <PathChoiceStep
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
  const stage = STAGE_FOR_STEP[step];
  const stageIndex = SETUP_STAGES.findIndex((s) => s.id === stage);

  const stepProps = { input, errors, set, setHour, goToStep };

  return (
    <div className="space-y-6 py-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Stage {stageIndex + 1} of {SETUP_STAGES.length} · {SETUP_STAGES[stageIndex].label}
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
        <CardContent className="space-y-6">
          {/* Shared onboarding guidance (2026-08-17) — every step answers
              the same four questions, rendered once here by the wizard
              shell rather than ad hoc per step. */}
          <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-medium text-heading">What we&apos;re doing</p>
              <p className="text-muted-foreground">{meta.whatWereDoing}</p>
            </div>
            <div>
              <p className="font-medium text-heading">Why it matters</p>
              <p className="text-muted-foreground">{meta.whyItMatters}</p>
            </div>
            <div>
              <p className="font-medium text-heading">What you need</p>
              <p className="text-muted-foreground">{meta.whatYouNeed}</p>
            </div>
            <div>
              <p className="font-medium text-heading">What happens next</p>
              <p className="text-muted-foreground">{meta.whatHappensNext}</p>
            </div>
          </div>

          {step === "venue-info" && <VenueInfoStep {...stepProps} />}
          {step === "venue-details" && <VenueDetailsStep {...stepProps} />}
          {step === "business-hours" && <BusinessHoursStep {...stepProps} />}
          {step === "brand" && <BrandStep {...stepProps} />}
          {step === "owner" && <OwnerStep {...stepProps} />}
          {step === "bring-your-business" && (
            <BringYourBusinessStep
              onAdvance={() => { void advanceFromStep("bring-your-business"); }}
              onPersonaHint={(persona) => set("onboardingPersona", persona)}
            />
          )}
          {step === "your-offerings" && <YourOfferingsStep goToStep={goToStep} />}
          {step === "business-tools" && <BusinessToolsStep goToStep={goToStep} />}
          {step === "lead-capture" && <LeadCaptureStep />}
          {step === "your-people" && <YourPeopleStep goToStep={goToStep} />}
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
          disabled={pending || progressSaving}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <Button type="button" onClick={handleContinue} disabled={pending || progressSaving}>
          {pending || progressSaving ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              {progressSaving ? "Saving…" : "Creating…"}
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
