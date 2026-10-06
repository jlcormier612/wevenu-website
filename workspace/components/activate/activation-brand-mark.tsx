import { HTC_LOGO_ALT, HTC_LOGO_PUBLIC_PATH } from "@shared/brand/logo";

/** Canonical HTC logo for the customer activation chrome. Logo only — no text wordmark. */
export function ActivationBrandMark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={HTC_LOGO_PUBLIC_PATH}
      alt={HTC_LOGO_ALT}
      width={200}
      className="h-auto w-full max-w-[200px] object-contain"
    />
  );
}
