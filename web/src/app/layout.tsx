import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], axes: ["opsz"], display: "swap", variable: "--font-inter" });
const geistMono = Geist_Mono({ subsets: ["latin"], display: "swap", variable: "--font-geist-mono" });

const description = "Clear what a group of businesses owe each other with the least cash, in one settlement.";

export const metadata: Metadata = {
  // Makes share-image and canonical URLs absolute.
  metadataBase: new URL(SITE_URL),
  title: { default: "Salda", template: "%s | Salda" },
  description,
  applicationName: "Salda",
  openGraph: { type: "website", siteName: "Salda", locale: "en_US", url: "/", description },
  twitter: { card: "summary_large_image", description },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/*
 * Turns landing page motion on before first paint, for viewers who allow motion. If the page's
 * scripts have not started within 3.5 seconds, it turns motion off again so nothing stays hidden.
 */
const motionScript = `(function(){try{if(!matchMedia("(prefers-reduced-motion: no-preference)").matches)return;var d=document.documentElement;d.setAttribute("data-motion","");setTimeout(function(){if(!window.__saldaMotion)d.removeAttribute("data-motion")},3500)}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
