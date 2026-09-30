"use client";

import { useEffect } from "react";

import {
  consumeSkewReload,
  shouldAutoRecoverFromFatal,
} from "@/lib/deploy/client-skew-recovery";

/**
 * Root GlobalError — replaces Next DefaultGlobalError.
 *
 * Deploy/client–server skew must not leave customers on "This page couldn't load".
 * Skew signatures and digest-less client fatals trigger one automatic hard reload.
 * Persistent failures still show a controlled Reload / Back surface.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const path =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/";
    if (!shouldAutoRecoverFromFatal(error)) return;
    if (!consumeSkewReload(path)) return;
    window.location.reload();
  }, [error]);

  const digest = error?.digest;
  const isServerError = !!digest;
  const message = isServerError
    ? "A server error occurred. Reload to try again."
    : "Reload to try again, or go back.";

  return (
    <html lang="en" id="__next_error__">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>This page couldn’t load</title>
        <style>{`
          :root { color-scheme: light dark; }
          body {
            margin: 0;
            font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
            background: #fafafa;
            color: #171717;
          }
          @media (prefers-color-scheme: dark) {
            body { background: #0a0a0a; color: #ededed; }
          }
          .wrap {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
          }
          .card {
            max-width: 28rem;
            width: 100%;
            border: 1px solid #e5e5e5;
            border-radius: 12px;
            padding: 24px;
            background: #fff;
          }
          @media (prefers-color-scheme: dark) {
            .card { background: #171717; border-color: #333; }
          }
          h1 { font-size: 1.25rem; margin: 0 0 8px; }
          p { margin: 0 0 16px; font-size: 0.875rem; opacity: 0.8; }
          .actions { display: flex; gap: 8px; flex-wrap: wrap; }
          button, a.btn {
            appearance: none;
            border: 1px solid #171717;
            background: #171717;
            color: #fff;
            border-radius: 8px;
            padding: 8px 14px;
            font-size: 0.875rem;
            cursor: pointer;
            text-decoration: none;
          }
          button.secondary, a.secondary {
            background: transparent;
            color: inherit;
            border-color: #ccc;
          }
          .digest { margin-top: 16px; font-size: 0.75rem; opacity: 0.55; }
        `}</style>
      </head>
      <body>
        <div className="wrap">
          <div className="card">
            <h1>This page couldn’t load</h1>
            <p>{message}</p>
            <div className="actions">
              <form>
                <button type="submit">Reload</button>
              </form>
              {!isServerError ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    if (window.history.length > 1) {
                      window.history.back();
                    } else {
                      window.location.href = "/";
                    }
                  }}
                >
                  Back
                </button>
              ) : null}
            </div>
            {digest ? <p className="digest">ERROR {digest}</p> : null}
          </div>
        </div>
      </body>
    </html>
  );
}
