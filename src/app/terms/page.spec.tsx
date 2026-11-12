/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LEGAL_CONTACT_EMAIL } from "@/components/legal/constants";
import { absoluteUrl } from "@/components/seo/jsonLdBuilders";
import { metadata as privacyMetadata } from "../privacy/page";
import TermsRoute, { metadata } from "./page";

function renderText(): string {
  render(<TermsRoute />);
  return document.body.textContent ?? "";
}

describe("TermsRoute", () => {
  afterEach(cleanup);

  it("renders one h1 titled Terms & Conditions", () => {
    render(<TermsRoute />);
    expect(
      screen.getAllByRole("heading", { level: 1, name: "Terms & Conditions" }),
    ).toHaveLength(1);
  });

  it("contains no legal review marker in any case", () => {
    expect(renderText()).not.toMatch(/legal\s+review\s+required/i);
  });

  it.each([
    /billing/i,
    /subscri/i,
    /refund/i,
    /terminat/i,
    /\bpayment/i,
    /\bsuspend/i,
  ])("has no paid-service text matching %s", (pattern) => {
    expect(renderText()).not.toMatch(pattern);
  });

  it("states operator, India and the contact email", () => {
    render(<TermsRoute />);
    const text = document.body.textContent ?? "";
    expect(text).toContain("Deepak Dewani");
    expect(text).toContain("India");
    expect(
      screen.getByRole("link", { name: LEGAL_CONTACT_EMAIL }),
    ).toHaveAttribute("href", `mailto:${LEGAL_CONTACT_EMAIL}`);
  });

  it("mentions share link expiry and governing law", () => {
    const text = renderText();
    expect(text).toContain("Share links expire after 24 hours");
    expect(text).toContain("governed by the laws of India");
  });

  it("exposes metadata with canonical and open graph url", () => {
    expect(metadata.title).toBe("Terms & Conditions — Requestr");
    expect(metadata.alternates?.canonical).toBe(absoluteUrl("/terms"));
    expect(metadata.openGraph?.url).toBe(absoluteUrl("/terms"));
  });

  it("has metadata unique from the privacy page", () => {
    expect(metadata.title).not.toBe(privacyMetadata.title);
    expect(metadata.description).not.toBe(privacyMetadata.description);
    expect(metadata.alternates?.canonical).not.toBe(
      privacyMetadata.alternates?.canonical,
    );
  });
});
