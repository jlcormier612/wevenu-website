"use client";

import { useEffect } from "react";

/**
 * Legacy Wevenu path — keep so old bookmarks and links still resolve.
 * Preserves hash fragments (e.g. #our-first-friends).
 */
export default function WhyWevenuRedirectPage() {
  useEffect(() => {
    const hash = window.location.hash;
    window.location.replace(`/our-story${hash}`);
  }, []);

  return null;
}
