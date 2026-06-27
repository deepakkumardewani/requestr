import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { HtmlLangSetter } from "@/components/layout/HtmlLangSetter";
import { cn } from "@/lib/utils";
import { AppProviders } from "@/providers/AppProviders";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const geistDisplay = Geist({
  variable: "--font-geist-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Requestr",
  description: "Browser-native API testing tool",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className="motion-safe:scroll-smooth"
    >
      <body
        suppressHydrationWarning
        className={cn(
          inter.variable,
          geistMono.variable,
          geistDisplay.variable,
          "font-sans antialiased",
        )}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
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
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
