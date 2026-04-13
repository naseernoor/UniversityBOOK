import type { Metadata } from "next";
import { ReactNode } from "react";

import NavBar from "@/components/nav-bar";
import Providers from "@/components/providers";
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
      <body>
        <Providers>
          <NavBar />
          <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
