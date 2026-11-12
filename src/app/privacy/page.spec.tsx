/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LEGAL_CONTACT_EMAIL } from "@/components/legal/constants";
import { absoluteUrl } from "@/components/seo/jsonLdBuilders";
import PrivacyRoute, { metadata } from "./page";

function renderText(): string {
  render(<PrivacyRoute />);
  return document.body.textContent ?? "";
}

describe("PrivacyRoute", () => {
  afterEach(cleanup);

  it("renders one h1 titled Privacy Policy", () => {
    render(<PrivacyRoute />);
    expect(
      screen.getAllByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toHaveLength(1);
  });

  it("contains no legal review marker in any case", () => {
    expect(renderText()).not.toMatch(/legal\s+review\s+required/i);
  });

  it("names the AI and voice providers it actually uses", () => {
    const text = renderText();
    expect(text).toContain("DeepSeek");
    expect(text).toContain("xAI");
  });

  it.each(["OpenAI", "Anthropic", "Gemini"])("does not name %s", (name) => {
    expect(renderText()).not.toMatch(new RegExp(name, "i"));
  });

  it.each(["Upstash", "Vercel", "proxy", "24 hours", "Voice input"])(
    "covers %s",
    (term) => {
      expect(renderText()).toContain(term);
    },
  );

  it("offers deletion by email through a mailto link", () => {
    render(<PrivacyRoute />);
    expect(document.body.textContent).toContain("request deletion");
    const links = screen.getAllByRole("link", { name: LEGAL_CONTACT_EMAIL });
    expect(
      links.every(
        (l) => l.getAttribute("href") === `mailto:${LEGAL_CONTACT_EMAIL}`,
      ),
    ).toBe(true);
  });

  it("states the operator and India", () => {
    const text = renderText();
    expect(text).toContain("Deepak Dewani");
    expect(text).toContain("India");
  });

  it("exposes metadata with canonical and open graph url", () => {
    expect(metadata.title).toBe("Privacy Policy — Requestr");
    expect(metadata.alternates?.canonical).toBe(absoluteUrl("/privacy"));
    expect(metadata.openGraph?.url).toBe(absoluteUrl("/privacy"));
    expect(metadata.description).toContain("DeepSeek");
  });
});
