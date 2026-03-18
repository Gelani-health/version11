import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gelani AI Healthcare Assistant v2.0",
  description: "Advanced AI-powered healthcare assistant with Bahmni HIS and Odoo ERP integration. Features clinical decision support, drug interaction checking, voice documentation, and real-time analytics.",
  keywords: ["Healthcare", "AI", "Bahmni", "Odoo", "Clinical Decision Support", "Medical", "FHIR", "EMR"],
  authors: [{ name: "Gelani Healthcare Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "Gelani AI Healthcare Assistant",
    description: "AI-powered healthcare with Bahmni integration",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider defaultTheme="light" storageKey="gelani-theme">
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
