import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { HtmlLangSetter } from "@/components/layout/HtmlLangSetter";
import { cn } from "@/lib/utils";
import { AppProviders } from "@/providers/AppProviders";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Requestr",
  description: "Browser-native API testing tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          inter.variable,
          geistMono.variable,
          "font-sans antialiased",
        )}
      >
        <AppProviders>
          <HtmlLangSetter />
          <a
            href="#app-main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
          >
            Skip to main content
          </a>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
