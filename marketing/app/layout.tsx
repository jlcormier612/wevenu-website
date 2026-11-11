import type { Metadata } from "next";
import { Cormorant_Garamond, Great_Vibes, Inter } from "next/font/google";
import { Suspense } from "react";

import { MarketingGa4Provider } from "@/components/marketing/ga4-provider";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const greatVibes = Great_Vibes({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
});

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_MARKETING_URL?.trim() ||
  "https://hellotocheers.com"
).replace(/\/$/, "");

const defaultDescription =
  "Hello to Cheers — wedding and event venue management software with big capabilities and beautiful simplicity. Run your venue, plan exceptional events, and keep your team, clients, and vendors connected.";

/** Dedicated 1200×630 share image (not the logo). New filename busts Facebook image-URL cache. */
const ogImage = {
  url: "/marketing/og-share-hospitality-prep.jpg",
  width: 1200,
  height: 630,
  alt: "A venue coordinator preparing a wedding reception tablescape before guests arrive",
  type: "image/jpeg" as const,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Hello to Cheers",
    template: "%s · Hello to Cheers",
  },
  description: defaultDescription,
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Hello to Cheers",
    title: "Hello to Cheers",
    description: defaultDescription,
    url: "/",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hello to Cheers",
    description: defaultDescription,
    images: [ogImage.url],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${greatVibes.variable} h-full`}
    >
      <body className="min-h-full">
        <div className="marketing-surface min-h-full">
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </div>
        <Suspense fallback={null}>
          <MarketingGa4Provider />
        </Suspense>
      </body>
    </html>
  );
}
