import type { Metadata } from "next";
import { ReactNode } from "react";

import NavBar from "@/components/nav-bar";
import Providers from "@/components/providers";
import SiteFooter from "@/components/site-footer";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "UniBOOK",
  description: "UniBOOK - track university marks, transcripts, friends, and social study feed"
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="overflow-x-hidden">
        <Providers>
          <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -left-16 top-28 rotate-[-18deg] rounded-[2rem] border border-white/40 bg-white/25 px-8 py-5 text-6xl font-black uppercase tracking-[0.36em] text-brand-200/35 shadow-[0_24px_60px_rgba(16,74,60,0.08)] backdrop-blur-sm">
              UniBOOK
            </div>
            <div className="absolute -right-12 bottom-16 rotate-[14deg] rounded-[2rem] border border-brand-200/40 bg-white/25 px-8 py-5 text-5xl font-black uppercase tracking-[0.32em] text-brand-300/30 backdrop-blur-sm">
              Official
            </div>
          </div>
          <div className="relative z-10 flex min-h-screen flex-col">
            <NavBar />
            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-6">{children}</main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
