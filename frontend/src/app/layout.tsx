import type { Metadata } from "next";
import "./globals.css";

import { ShellProvider } from "@/components/layout/shell-context";
import { RootChrome } from "@/components/layout/root-chrome";

export const metadata: Metadata = {
  title: "tradeJournaling",
  description: "Trading journal & performance dashboard",
};

// apply stored theme before first paint (no flash)
const themeBoot = `(function(){try{var t=localStorage.getItem('tj-theme');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <ShellProvider>
          <RootChrome>{children}</RootChrome>
        </ShellProvider>
      </body>
    </html>
  );
}