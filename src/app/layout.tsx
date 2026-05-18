import type { Metadata, Viewport } from "next";
import { Nunito, DM_Sans } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "HydraBlue — Smart Water Tracker",
  description:
    "A premium mobile water tracker with smart reminders and animated sloshing water.",
  // Next 16 emits the `<link rel="manifest">` automatically from
  // app/manifest.ts; including the app/apple-touch-icon hint here helps
  // iOS Safari pick up the home-screen icon on "Add to Home Screen".
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HydraBlue",
  },
  // Security-related meta tags. Static export rules out HTTP response
  // headers (HSTS, X-Frame-Options), so this is the strongest variant
  // available to us. The CSP is intentionally tight: same-origin only
  // for scripts, fonts come from Google Fonts (next/font), images may
  // be base64 data URIs (icons), and we ban every other origin.
  other: {
    "Content-Security-Policy":
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--app-bg)] text-[var(--ink)]">
        {children}
      </body>
    </html>
  );
}
