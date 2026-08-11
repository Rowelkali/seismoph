import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/providers/QueryProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SEISMO PH — Real-Time Earthquake Intelligence for the Philippines",
  description:
    "Interactive 3D map, real-time updates, historical explorer, analytics and alerts for Philippine earthquake activity. Data attribution: DOST-PHIVOLCS.",
  applicationName: "SEISMO PH",
  keywords: [
    "Philippines earthquake",
    "PHIVOLCS",
    "seismic",
    "earthquake map",
    "real-time earthquakes",
    "SEISMO PH",
  ],
  authors: [{ name: "SEISMO PH" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "SEISMO PH — Real-Time Earthquake Intelligence",
    description:
      "Interactive 3D map, real-time updates, historical explorer and analytics for Philippine earthquake activity.",
    siteName: "SEISMO PH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SEISMO PH",
    description: "Real-Time Earthquake Intelligence for the Philippines",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0f14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <QueryProvider>
          {children}
          <Toaster />
          <SonnerToaster position="bottom-right" theme="dark" />
        </QueryProvider>
      </body>
    </html>
  );
}
