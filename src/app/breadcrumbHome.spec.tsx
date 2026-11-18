// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import JsonComparePage_ from "./json-compare/page";
import JsonVisualizePage_ from "./json-visualize/page";
import TransformPage_ from "./transform/page";

interface CrumbItem {
  label: string;
  href?: string;
}

const breadcrumbCalls = vi.hoisted(() => ({ items: [] as CrumbItem[][] }));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}));

vi.mock("@/components/layout/AppBreadcrumb", () => ({
  AppBreadcrumb: ({ items }: { items: CrumbItem[] }) => {
    breadcrumbCalls.items.push(items);
    return <nav data-testid="breadcrumb" />;
  },
}));
vi.mock("@/components/transform/TransformPage", () => ({
  TransformPage: () => <div data-testid="transform-body" />,
}));
vi.mock("@/components/json-compare/JsonComparePage", () => ({
  JsonComparePage: () => <div data-testid="compare-body" />,
}));
vi.mock("@/components/json-visualize/JsonVisualizePage", () => ({
  JsonVisualizePage: () => <div data-testid="visualize-body" />,
}));

const PAGES = [
  { name: "transform", Page: TransformPage_, trailing: "Transform Playground", body: "transform-body" },
  { name: "json-compare", Page: JsonComparePage_, trailing: "JSON Compare", body: "compare-body" },
  { name: "json-visualize", Page: JsonVisualizePage_, trailing: "JSON Visualize", body: "visualize-body" },
];

afterEach(() => {
  cleanup();
  breadcrumbCalls.items.length = 0;
});

describe.each(PAGES)("$name page breadcrumb", ({ Page, trailing, body }) => {
  it("passes a translated Home item linking to /app, then the page crumb", () => {
    render(<Page />);

    expect(breadcrumbCalls.items.at(-1)).toEqual([
      { label: "navigation.breadcrumbHome", href: "/app" },
      { label: trailing },
    ]);
  });

  it("keeps the sr-only h1 and renders the page body", () => {
    render(<Page />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe(trailing);
    expect(heading.className).toContain("sr-only");
    expect(screen.getByTestId(body)).toBeTruthy();
    expect(screen.getByTestId("breadcrumb")).toBeTruthy();
  });
});
