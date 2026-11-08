/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_GOVERNING_LAW,
  LEGAL_NOT_ADVICE_NOTE,
  LEGAL_OPERATOR_DESCRIPTION,
  LEGAL_OPERATOR_NAME,
  LEGAL_SITE_NAME,
} from "./constants";
import {
  LegalLayout,
  LegalOperatorSection,
  LegalSection,
} from "./LegalLayout";

describe("LegalLayout", () => {
  afterEach(cleanup);

  it("renders the title as the page heading", () => {
    render(<LegalLayout title="Privacy Policy">body</LegalLayout>);
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeInTheDocument();
  });

  it("shows the effective date", () => {
    render(<LegalLayout title="Terms">x</LegalLayout>);
    expect(
      screen.getByText(`Effective date: ${LEGAL_EFFECTIVE_DATE}`),
    ).toBeInTheDocument();
    expect(LEGAL_EFFECTIVE_DATE).toBe("8 November 2026");
  });

  it("shows the not-legal-advice note as a note", () => {
    render(<LegalLayout title="Terms">x</LegalLayout>);
    expect(screen.getByRole("note")).toHaveTextContent(
      "This page is not legal advice.",
    );
    expect(LEGAL_NOT_ADVICE_NOTE).toContain("not legal advice");
  });

  it("links back home with the site name", () => {
    render(<LegalLayout title="Terms">x</LegalLayout>);
    const link = screen.getByRole("link", { name: "Back to Requestr" });
    expect(link).toHaveAttribute("href", "/");
    expect(LEGAL_SITE_NAME).toBe("Requestr");
  });

  it("renders children inside the main landmark", () => {
    render(
      <LegalLayout title="Terms">
        <p>child content</p>
      </LegalLayout>,
    );
    expect(screen.getByRole("main")).toContainElement(
      screen.getByText("child content"),
    );
  });
});

describe("LegalSection", () => {
  afterEach(cleanup);

  it("renders heading and body", () => {
    render(
      <LegalSection heading="Data flow">
        <p>Requests go directly to your target.</p>
      </LegalSection>,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Data flow" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Requests go directly to your target."),
    ).toBeInTheDocument();
  });
});

describe("LegalOperatorSection", () => {
  afterEach(cleanup);

  it("names the operator, governing law of India and description", () => {
    render(<LegalOperatorSection />);
    expect(
      screen.getByRole("heading", { name: "Who we are" }),
    ).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text).toContain("Requestr is operated by Deepak Dewani");
    expect(text).toContain("an individual developer (no company)");
    expect(text).toContain("Governing law: India.");
    expect(LEGAL_OPERATOR_NAME).toBe("Deepak Dewani");
    expect(LEGAL_OPERATOR_DESCRIPTION).toContain("individual");
    expect(LEGAL_GOVERNING_LAW).toBe("India");
  });

  it("exposes the contact email as a mailto link", () => {
    render(<LegalOperatorSection />);
    const link = screen.getByRole("link", { name: LEGAL_CONTACT_EMAIL });
    expect(link).toHaveAttribute("href", `mailto:${LEGAL_CONTACT_EMAIL}`);
    expect(LEGAL_CONTACT_EMAIL).toBe("deepakkumardewani@gmail.com");
  });
});
