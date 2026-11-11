import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMPARE_PAGES } from "@/components/landing/data/seoPages";
import CompareRoute, {
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
vi.mock("@/components/seo/ComparePageLayout", () => ({
  ComparePageLayout: ({ page }: { page: { h1: string } }) => (
    <div data-testid="layout">{page.h1}</div>
  ),
}));

const params = (competitor: string) => ({
  params: Promise.resolve({ competitor }),
});
const pageFor = (slug: string) => {
  const page = COMPARE_PAGES.find((p) => p.slug === slug);
  if (!page) throw new Error(`${slug} fixture missing`);
  return page;
};

beforeEach(() => {
  notFoundMock.mockClear();
});

describe("compare route", () => {
  it("disables dynamic params so unknown competitors 404", () => {
    expect(dynamicParams).toBe(false);
  });

  it("generateStaticParams returns postman and insomnia", () => {
    expect(generateStaticParams()).toEqual([
      { competitor: "postman" },
      { competitor: "insomnia" },
    ]);
  });

  it("has exactly two compare pages", () => {
    expect(COMPARE_PAGES).toHaveLength(2);
  });

  it.each([
    ["postman", "Requestr vs Postman: an API client without the install"],
    ["insomnia", "Requestr vs Insomnia: a browser-based API client"],
  ])("generateMetadata for %s sets title, description and canonical", async (slug, title) => {
    const meta = await generateMetadata(params(slug));
    const page = pageFor(slug);
    expect(meta.title).toBe(title);
    expect(meta.description).toBe(page.description);
    expect(String(meta.description)).toContain(
      `How Requestr compares with ${slug === "postman" ? "Postman" : "Insomnia"}.`,
    );
    expect(meta.alternates?.canonical).toMatch(
      new RegExp(`^https?://.+/compare/${slug}$`),
    );
    expect(String(meta.metadataBase)).toMatch(/^https?:\/\//);
  });

  it("generateMetadata fills Open Graph and Twitter tags consistently", async () => {
    const meta = await generateMetadata(params("postman"));
    const page = pageFor("postman");
    const canonical = String(meta.alternates?.canonical);
    expect(meta.openGraph).toMatchObject({
      title: page.title,
      description: page.description,
      url: canonical,
      type: "website",
    });
    const og = meta.openGraph?.images as { url: string; alt: string }[];
    expect(og[0].url).toMatch(/^https?:\/\/.+/);
    expect(og[0].alt).toBe(page.screenshot.alt);
    expect(meta.twitter).toMatchObject({
      card: "summary_large_image",
      title: page.title,
      description: page.description,
    });
    expect(meta.twitter?.images).toEqual([og[0].url]);
  });

  it("generateMetadata returns an empty object for an unknown competitor", async () => {
    expect(await generateMetadata(params("nope"))).toEqual({});
  });

  it("renders the layout for a known competitor", async () => {
    const html = renderToStaticMarkup(await CompareRoute(params("insomnia")));
    expect(html).toContain("Requestr vs Insomnia");
    expect(notFoundMock).not.toHaveBeenCalled();
  });

  it("calls notFound for an unknown competitor", async () => {
    await expect(CompareRoute(params("nope"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });
});
