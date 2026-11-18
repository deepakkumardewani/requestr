import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FEATURE_PAGES } from "@/components/landing/data/seoPages";
import FeatureRoute, {
  dynamicParams,
  generateMetadata,
  generateStaticParams,
} from "./page";

const { notFoundMock } = vi.hoisted(() => ({
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: notFoundMock }));
vi.mock("@/components/seo/FeaturePageLayout", () => ({
  FeaturePageLayout: ({ page }: { page: { h1: string } }) => (
    <div data-testid="layout">{page.h1}</div>
  ),
}));

const EXPECTED_SLUGS = [
  "relay",
  "request-chains",
  "transform-playground",
  "json-compare",
  "json-visualize",
  "import",
  "collections-environments",
  "command-palette",
  "backup-restore",
];

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

beforeEach(() => {
  notFoundMock.mockClear();
});

describe("feature route", () => {
  it("disables dynamic params so unknown slugs 404", () => {
    expect(dynamicParams).toBe(false);
  });

  it("generateStaticParams returns all nine feature slugs", () => {
    expect(generateStaticParams()).toEqual(
      EXPECTED_SLUGS.map((slug) => ({ slug })),
    );
  });

  it("generateMetadata sets title, description and a canonical for the slug", async () => {
    const meta = await generateMetadata(params("json-compare"));
    const page = FEATURE_PAGES.find((p) => p.slug === "json-compare");
    expect(meta.title).toBe(page?.title);
    expect(meta.description).toBe(page?.description);
    expect(meta.alternates?.canonical).toMatch(/\/features\/json-compare$/);
    expect(String(meta.metadataBase)).toMatch(/^https?:\/\//);
  });

  it("generateMetadata fills Open Graph and Twitter tags consistently", async () => {
    const meta = await generateMetadata(params("json-compare"));
    const page = FEATURE_PAGES.find((p) => p.slug === "json-compare");
    const canonical = String(meta.alternates?.canonical);
    expect(meta.openGraph).toMatchObject({
      title: page?.title,
      description: page?.description,
      url: canonical,
      type: "website",
    });
    const og = meta.openGraph?.images as { url: string; alt: string }[];
    expect(og[0].url).toMatch(/\/screens\/json-compare-light\.webp$/);
    expect(og[0].alt).toBe(page?.screenshot.alt);
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      title: page?.title,
      description: page?.description,
    });
    expect(meta.twitter?.images).toEqual([og[0].url]);
    expect(canonical.startsWith("http")).toBe(true);
  });

  it("generateMetadata returns an empty object for an unknown slug", async () => {
    expect(await generateMetadata(params("not-a-page"))).toEqual({});
  });

  it("renders the layout for a known slug", async () => {
    const html = renderToStaticMarkup(await FeatureRoute(params("relay")));
    expect(html).toContain("data-testid=\"layout\"");
    expect(html).toContain(FEATURE_PAGES[0].h1);
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("triggers notFound for an unknown slug", async () => {
    await expect(FeatureRoute(params("not-a-page"))).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
