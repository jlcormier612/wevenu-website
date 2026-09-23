import type { Metadata } from "next";
import { Geist_Mono, Inter, Source_Sans_3 } from "next/font/google";
import localFont from "next/font/local";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

/** Staff UI (venue + vendor) only — applied under `.htc-staff`, not client portal. */
const sourceSans = Source_Sans_3({
  variable: "--font-staff-sans",
  subsets: ["latin"],
});

/**
 * Heading face is vendored under app/fonts so Docker/CI builds do not depend on
 * fonts.google.com (next/font/google multi-weight Cormorant fails intermittently
 * in ECS image builds).
 */
const cormorant = localFont({
  src: "./fonts/CormorantGaramond[wght].ttf",
  variable: "--font-heading",
  weight: "400 700",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Hello to Cheers",
    template: "%s · Hello to Cheers",
  },
  description: "The operating system for independent wedding and event venues.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${sourceSans.variable} ${cormorant.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
