import type { Metadata } from "next";
import { Instrument_Sans, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/query-provider";
import { SafetyBanner } from "@/components/ui/safety-banner";

const display = Instrument_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "TwinRx Digital Twin",
  description: "AI-assisted chronic-care and medication-safety decision support.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <QueryProvider>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <SafetyBanner />
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
