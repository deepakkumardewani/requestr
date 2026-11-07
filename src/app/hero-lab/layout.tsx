import type { Metadata } from "next";

// Private review surface for hero concepts: never indexed, never linked from
// the public landing nav (FR-36).
export const metadata: Metadata = {
  title: "Hero lab",
  robots: { index: false, follow: false },
};

export default function HeroLabLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
