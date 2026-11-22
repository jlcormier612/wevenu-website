import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import localFont from "next/font/local";

import { ThemeProvider } from "@/components/providers/theme-provider";

import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/**
 * Heading face is vendored so Docker/CI builds do not call fonts.google.com.
 * next/font/google multi-weight Cormorant fails intermittently in ECS image
 * builds ("queries have exactly one entry"). Same file and variable as venue-app.
 */
const cormorant = localFont({
  src: "./fonts/CormorantGaramond[wght].ttf",
  variable: "--font-heading",
  weight: "400 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Relationship Workspace",
    template: "%s · Relationship Workspace",
  },
  description:
    "Hello to Cheers internal Relationship Workspace — one relationship, one timeline.",
  robots: { index: false, follow: false },
};

/**
 * next-themes persists `theme` in localStorage (default storageKey).
 * Founder decision: Workspace is light-only. This blocking script runs before
 * paint so a previously saved `dark` preference cannot flash dark UI, and
 * rewrites storage to `light` without touching auth cookies.
 */
const FORCE_LIGHT_SCRIPT = `(function(){try{localStorage.setItem("theme","light");}catch(e){}var r=document.documentElement;r.classList.remove("dark");r.classList.add("light");r.style.colorScheme="light";})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sourceSans.variable} ${cormorant.variable} light h-full`}
      style={{ colorScheme: "light" }}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: FORCE_LIGHT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
