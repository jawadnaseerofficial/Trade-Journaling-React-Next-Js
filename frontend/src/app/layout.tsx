import type { Metadata } from "next";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}