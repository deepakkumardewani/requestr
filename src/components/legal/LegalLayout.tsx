import Link from "next/link";
import { SECTION_CONTAINER } from "@/components/landing/constants";
import { cn } from "@/lib/utils";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_GOVERNING_LAW,
  LEGAL_NOT_ADVICE_NOTE,
  LEGAL_OPERATOR_DESCRIPTION,
  LEGAL_OPERATOR_NAME,
  LEGAL_SITE_NAME,
} from "./constants";

interface LegalLayoutProps {
  title: string;
  children: React.ReactNode;
}

interface LegalSectionProps {
  heading: string;
  children: React.ReactNode;
}

export function LegalSection({ heading, children }: LegalSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
      <div className="space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}

export function LegalOperatorSection() {
  return (
    <LegalSection heading="Who we are">
      <p>
        {LEGAL_SITE_NAME} is operated by {LEGAL_OPERATOR_NAME},{" "}
        {LEGAL_OPERATOR_DESCRIPTION}. Governing law: {LEGAL_GOVERNING_LAW}.
      </p>
      <p>
        Contact:{" "}
        <a
          href={`mailto:${LEGAL_CONTACT_EMAIL}`}
          className="text-foreground underline underline-offset-4"
        >
          {LEGAL_CONTACT_EMAIL}
        </a>
      </p>
    </LegalSection>
  );
}

export function LegalLayout({ title, children }: LegalLayoutProps) {
  return (
    <main className={cn(SECTION_CONTAINER, "max-w-3xl py-16 sm:py-24")}>
      <Link
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Back to {LEGAL_SITE_NAME}
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Effective date: {LEGAL_EFFECTIVE_DATE}
      </p>
      <p
        role="note"
        className="mt-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
      >
        {LEGAL_NOT_ADVICE_NOTE}
      </p>
      <div className="mt-10 space-y-10 leading-relaxed">{children}</div>
    </main>
  );
}
