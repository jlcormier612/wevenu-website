import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SmsConsentOptInForm } from "@/app/sms-consent/[token]/opt-in-form";
import { HtcPlatformMark } from "@/components/brand/htc-platform-mark";
import { getSmsConsentEmailTokenPreview } from "@/lib/communication/sms-consent-email";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = { title: { absolute: "Text message permission" } };

export default async function SmsConsentPage({ params }: Props) {
  const { token } = await params;
  const preview = await getSmsConsentEmailTokenPreview(token);
  if (!preview.ok) notFound();

  return (
    <div className="min-h-screen bg-[#F7F5F1] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-white p-6 shadow-sm">
        <div className="text-center space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {preview.venueName}
          </p>
          <h1 className="text-xl font-semibold text-heading">Text message permission</h1>
        </div>

        {preview.alreadyUsed ? (
          <p className="text-sm text-muted-foreground text-center">
            Thanks — your text permission for {preview.venueName} is already on file.
          </p>
        ) : preview.expired ? (
          <p className="text-sm text-muted-foreground text-center">
            This permission request has expired. Ask {preview.venueName} to send a new one.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {preview.venueName} is asking whether you want to receive text messages. You are{" "}
              <strong className="text-foreground">not opted in yet</strong>. Confirm below only if
              you want texts from them.
            </p>
            <SmsConsentOptInForm token={token} venueName={preview.venueName} />
          </>
        )}
        <HtcPlatformMark className="pt-2" />
      </div>
    </div>
  );
}
