/** @vitest-environment happy-dom */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AllFeaturesPage } from "./AllFeaturesPage";
import { FEATURES } from "./data/features";

// The real catalogue categorises every feature, so inject one without a category
// to exercise the "More" fallback group.
vi.mock("./data/features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./data/features")>();
  return {
    ...actual,
    FEATURES: [
      ...actual.FEATURES,
      {
        id: "uncategorised",
        title: "Uncategorised extra",
        description: "No category set.",
      },
    ],
  };
});

describe("AllFeaturesPage", () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    document.documentElement.style.scrollBehavior = "";
  });

  it("renders one h1 for the page", () => {
    render(<AllFeaturesPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("links exactly the nine feature page routes from the hub main content", () => {
    render(<AllFeaturesPage />);
    const main = screen.getByRole("main");
    const featureRoutes = within(main)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
      .filter((href) => href?.startsWith("/features/"));
    expect([...new Set(featureRoutes)].sort()).toEqual([
      "/features/backup-restore",
      "/features/collections-environments",
      "/features/command-palette",
      "/features/import",
      "/features/json-compare",
      "/features/json-visualize",
      "/features/relay",
      "/features/request-chains",
      "/features/transform-playground",
    ].sort());
  });

  it.each([
    ["Relay, the built-in AI", "/features/relay"],
    ["Transform Playground", "/features/transform-playground"],
    ["JSON Compare", "/features/json-compare"],
    ["JSON Visualize", "/features/json-visualize"],
    ["Backup and restore", "/features/backup-restore"],
    ["Command palette", "/features/command-palette"],
    ["Collections", "/features/collections-environments"],
    ["Environment variables", "/features/collections-environments"],
    ["Import anything", "/features/import"],
    ["Why did this fail?", "/features/relay"],
  ])("links the %s card to %s", (title, route) => {
    render(<AllFeaturesPage />);
    const main = screen.getByRole("main");
    const heading = within(main).getByRole("heading", { level: 3, name: title });
    expect(heading.closest("a")).toHaveAttribute("href", route);
  });

  it.each([
    "Method-driven theming",
    "Shareable links",
    "HTTP request builder",
    "GraphQL",
    "Uncategorised extra",
  ])("renders the %s card without a link", (title) => {
    render(<AllFeaturesPage />);
    const main = screen.getByRole("main");
    const heading = within(main).getByRole("heading", { level: 3, name: title });
    expect(heading.closest("a")).toBeNull();
  });

  it("links both compare pages with their titles", () => {
    render(<AllFeaturesPage />);
    const main = screen.getByRole("main");
    expect(
      within(main).getByRole("link", { name: /Requestr vs Postman/ }),
    ).toHaveAttribute("href", "/compare/postman");
    expect(
      within(main).getByRole("link", { name: /Requestr vs Insomnia/ }),
    ).toHaveAttribute("href", "/compare/insomnia");
    expect(
      within(main).getByRole("heading", { level: 2, name: "Compare Requestr" }),
    ).toBeInTheDocument();
  });

  it("points every group section's aria-labelledby at an existing space-free heading id", () => {
    render(<AllFeaturesPage />);
    const main = screen.getByRole("main");
    const sections = [...main.querySelectorAll("section[aria-labelledby]")];
    expect(sections.length).toBeGreaterThanOrEqual(3);
    const groupSections = sections.filter((s) =>
      s.getAttribute("aria-labelledby")?.startsWith("group-"),
    );
    expect(groupSections.length).toBeGreaterThanOrEqual(2);
    const ids = sections.map((s) => s.getAttribute("aria-labelledby") ?? "");
    expect(ids).toContain("group-json-tools");
    expect(ids).toContain("group-more");
    expect(ids.every((id) => id.length > 0 && !/\s/.test(id))).toBe(true);
    expect(
      sections.every((s) => {
        const heading = main.querySelector(
          `#${s.getAttribute("aria-labelledby")}`,
        );
        return heading?.tagName === "H2" && heading.closest("section") === s;
      }),
    ).toBe(true);
  });

  it("groups features under category headings in first-seen order", () => {
    render(<AllFeaturesPage />);
    const main = screen.getByRole("main");
    const expected = [
      ...new Set(FEATURES.map((f) => f.category ?? "More")),
    ];
    const headings = within(main)
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual([...expected, "Compare Requestr"]);
  });

  it("puts features without a category in a trailing More group", () => {
    render(<AllFeaturesPage />);
    const more = screen.getByRole("heading", { level: 2, name: "More" });
    const section = more.closest("section");
    expect(section).not.toBeNull();
    expect(
      within(section as HTMLElement).getByRole("heading", {
        level: 3,
        name: "Uncategorised extra",
      }),
    ).toBeInTheDocument();
  });

  it("resets scroll behaviour and position on mount", () => {
    render(<AllFeaturesPage />);
    expect(document.documentElement.style.scrollBehavior).toBe("auto");
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("includes the footer", () => {
    render(<AllFeaturesPage />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });
});
