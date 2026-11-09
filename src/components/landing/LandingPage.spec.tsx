/** @vitest-environment happy-dom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LandingPage } from "./LandingPage";

const SECTION_IDS = [
  "hero",
  "relay",
  "how-it-works",
  "feature-showcase",
  "command-palette",
  "beyond-send",
  "import",
  "comparison",
  "final-cta",
] as const;

function stub(testId: string) {
  return () => <div data-testid={testId} />;
}

const relayLoader = vi.hoisted(() => ({
  load: undefined as undefined | (() => Promise<unknown>),
}));

// next/dynamic renders the relay stub and records the loader for inspection.
vi.mock("next/dynamic", () => ({
  default: (load: () => Promise<unknown>) => {
    relayLoader.load = load;
    return () => <div data-testid="relay" />;
  },
}));
vi.mock("./relay/RelaySection", () => ({ RelaySection: "relay-section-marker" }));
vi.mock("./Nav", () => ({ Nav: stub("nav") }));
vi.mock("./Hero", () => ({ Hero: stub("hero") }));
vi.mock("./HowItWorks", () => ({ HowItWorks: stub("how-it-works") }));
vi.mock("./FeatureShowcase", () => ({ FeatureShowcase: stub("feature-showcase") }));
vi.mock("./CommandPaletteSection", () => ({ CommandPaletteSection: stub("command-palette") }));
vi.mock("./BeyondSend", () => ({ BeyondSend: stub("beyond-send") }));
vi.mock("./ImportSection", () => ({ ImportSection: stub("import") }));
vi.mock("./ComparisonTable", () => ({ ComparisonTable: stub("comparison") }));
vi.mock("./FinalCta", () => ({ FinalCta: stub("final-cta") }));
vi.mock("./Footer", () => ({ Footer: stub("footer") }));

function mainSectionIds(container: HTMLElement): (string | null)[] {
  const main = container.querySelector("main");
  return Array.from(main?.children ?? []).map((el) => el.getAttribute("data-testid"));
}

describe("LandingPage", () => {
  afterEach(cleanup);

  it("orders sections under main per SPEC criterion 1", () => {
    const { container } = render(<LandingPage />);
    expect(mainSectionIds(container)).toEqual([...SECTION_IDS]);
  });

  it("renders Relay as the second section, right after the hero", () => {
    const { container } = render(<LandingPage />);
    expect(mainSectionIds(container)[1]).toBe("relay");
  });

  it("code-splits the Relay section through a dynamic import", async () => {
    expect(await relayLoader.load?.()).toBe("relay-section-marker");
  });

  it("places Nav before main and Footer after it", () => {
    const { container } = render(<LandingPage />);
    const ids = Array.from(container.children).map((el) =>
      el.tagName === "MAIN" ? "main" : el.getAttribute("data-testid"),
    );
    expect(ids).toEqual(["nav", "main", "footer"]);
  });

  it("keeps the app-main landmark id", () => {
    const { container } = render(<LandingPage />);
    expect(container.querySelector("main")?.id).toBe("app-main");
  });
});
