import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, Clock3, ExternalLink } from "lucide-react";

import type { IntegrationSetupGuide } from "@/lib/help-guides/integration-setup-guides";
import { HELP_GUIDES_HOME_HREF, HELP_GUIDES_TITLE } from "@/lib/help-guides/areas";

export function IntegrationSetupGuideView({ guide }: { guide: IntegrationSetupGuide }) {
  return (
    <div className="max-w-3xl space-y-7">
      <Link
        href={HELP_GUIDES_HOME_HREF}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {HELP_GUIDES_TITLE}
      </Link>

      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your Venue · Setup Guide</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{guide.title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{guide.intro}</p>
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground">
          <Clock3 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          {guide.time}
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Before you begin</h2>
        <ul className="space-y-2">
          {guide.prerequisites.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4" aria-labelledby="setup-steps">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Follow these steps</p>
          <h2 id="setup-steps" className="mt-1 text-lg font-semibold text-foreground">
            We'll tell you exactly what to click.
          </h2>
        </div>

        <div className="space-y-4">
          {guide.steps.map((step) => (
            <article key={step.number} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-start gap-3 border-b border-border bg-muted/25 px-5 py-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {step.number}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step {step.number}</p>
                  <h3 className="mt-0.5 text-base font-semibold text-foreground">{step.title}</h3>
                </div>
              </div>

              <div className="space-y-4 px-5 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Do this</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-foreground">{step.doThis}</p>
                </div>

                <div className="rounded-lg border border-border bg-background px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Checkpoint · what you should see</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{step.lookFor}</p>
                </div>

                {step.dontDo ? (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-destructive">
                      <CircleAlert className="h-3.5 w-3.5" aria-hidden />
                      Don't do this
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-foreground">{step.dontDo}</p>
                  </div>
                ) : null}

                {step.tip ? (
                  <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">Helpful tip</p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-foreground">{step.tip}</p>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">You're done</p>
        <h2 className="text-lg font-semibold text-foreground">{guide.completion}</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          Go back to Financials &amp; Integrations and make sure the integration shows <strong className="text-foreground">Connected</strong> before you leave this page.
        </p>
      </section>

      <section className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">If something goes wrong</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">Don't guess — check these first.</h2>
        </div>
        <ul className="space-y-2.5">
          {guide.troubleshooting.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground">
              <CircleAlert className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {guide.relatedFeatures.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-t border-border pt-5">
          {guide.relatedFeatures.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {feature.label}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
