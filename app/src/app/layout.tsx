import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/site";
import { Suspense } from "react";
import { RevealHost } from "@/components/auth/RevealHost";
import "./globals.css";

const schibsted = Schibsted_Grotesk({ variable: "--font-schibsted", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["500"] });

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export const viewport: Viewport = { themeColor: "#08090B" };

// Runs before first paint: sets <html data-intro="pending"> on the first visit of a session,
// so intro elements start hidden instead of flashing in their final state.
const introGate = `(function(){try{
  if(sessionStorage.getItem('intro-seen')==='1'&&!/[?&]freeze=/.test(location.search))return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var r=document.documentElement;r.setAttribute('data-intro','pending');
  setTimeout(function(){if(r.getAttribute('data-intro')==='pending')r.removeAttribute('data-intro')},4000);
}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${schibsted.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: introGate }} />
      </head>
      <body>
        {children}
        <Suspense><RevealHost /></Suspense>
      </body>
    </html>
  );
}
