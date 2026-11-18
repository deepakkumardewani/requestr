/** @vitest-environment happy-dom */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  COMPARE_PAGES,
  type ComparePage,
} from "@/components/landing/data/seoPages";
import { ComparePageLayout } from "./ComparePageLayout";

vi.mock("@/components/landing/Nav", () => ({
  Nav: () => <nav data-testid="nav" />,
}));
vi.mock("@/components/landing/Footer", () => ({
  Footer: () => <footer data-testid="footer" />,
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // biome-ignore lint/performance/noImgElement: test double for next/image
    <img src={src} alt={alt} />
  ),
}));

function render(page: ComparePage): Document {
  return new DOMParser().parseFromString(
    `<body>${renderToStaticMarkup(<ComparePageLayout page={page} />)}</body>`,
    "text/html",
  );
}

const cases = COMPARE_PAGES.map((p) => [p.slug, p] as const);
const EXPECTED_ROW_COUNT = 11;
const NO_NOTE: string[] = [];
// Rows 1, 3, 4, 5 and 9 state a plan tier for both competitors.
const EXPECTED_TIER_NOTES: Record<string, string[][]> = {
  postman: [
    NO_NOTE,
    ["Free account unlocks sync"],
    NO_NOTE,
    ["All plans"],
    ["Free has limited flow runs"],
    ["Free has 100 AI credits"],
    NO_NOTE,
    NO_NOTE,
    NO_NOTE,
    ["Free syncs; Team for roles"],
    NO_NOTE,
  ],
  insomnia: [
    NO_NOTE,
    ["Free (Scratch Pad)"],
    NO_NOTE,
    ["All plans"],
    ["All plans"],
    ["Plan split not stated"],
    NO_NOTE,
    NO_NOTE,
    NO_NOTE,
    ["Free up to 3 users"],
    NO_NOTE,
  ],
};
const EXPECTED_FIRST_CLAIM: Record<string, string> = {
  postman: "Desktop app or web app",
  insomnia: "Desktop app download",
};
const SIGNED_OUT =
  "https://learning.postman.com/docs/getting-started/first-steps/sign-up-for-postman";
const EXPECTED_SOURCES: Record<string, string[]> = {
  postman: [
    "https://learning.postman.com/docs/getting-started/installation/installation-and-updates",
    SIGNED_OUT,
    SIGNED_OUT,
    "https://learning.postman.com/docs/use/send-requests/protocols/protocols",
    "https://learning.postman.com/docs/postman-flows/gs/flows-overview/",
    "https://learning.postman.com/docs/agent-mode/overview/",
    "https://learning.postman.com/docs/getting-started/importing-and-exporting/importing-data/",
    "https://www.postman.com/pricing/",
    SIGNED_OUT,
    "https://learning.postman.com/docs/collaborating-in-postman/using-workspaces/overview/",
    SIGNED_OUT,
  ],
  insomnia: [
    "https://insomnia.rest/download",
    "https://insomnia.rest/",
    "https://insomnia.rest/",
    "https://insomnia.rest/pricing/",
    "https://insomnia.rest/pricing/",
    "https://insomnia.rest/",
    "https://docs.insomnia.rest/insomnia/generate-code-snippet",
    "https://insomnia.rest/pricing/",
    "https://konghq.com/blog/engineering/why-kong-insomnia-is-developers-preferred-api-client",
    "https://insomnia.rest/pricing/",
    "https://insomnia.rest/pricing/",
  ],
};
const NAMES = { postman: "Postman", insomnia: "Insomnia" } as const;

describe("ComparePageLayout", () => {
  it.each(cases)("%s renders exactly one h1 with the page heading", (_s, page) => {
    const h1s = render(page).querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].textContent).toBe(page.h1);
  });

  it.each(cases)("%s renders exactly 11 comparison rows with the competitor column", (_s, page) => {
    const doc = render(page);
    expect(doc.querySelectorAll("tbody tr")).toHaveLength(EXPECTED_ROW_COUNT);
    const headers = [...doc.querySelectorAll("thead th")].map((t) => t.textContent);
    expect(headers).toEqual(["Feature", "Requestr", NAMES[page.slug]]);
  });

  it.each(cases)("%s links one https source per row, in row order", (_s, page) => {
    const links = [
      ...render(page).querySelectorAll('tbody a[target="_blank"]'),
    ];
    expect(links).toHaveLength(EXPECTED_ROW_COUNT);
    expect(links.map((a) => a.getAttribute("href"))).toEqual(
      EXPECTED_SOURCES[page.slug],
    );
    expect(links.map((a) => a.getAttribute("rel"))).toEqual(
      Array(EXPECTED_ROW_COUNT).fill("noopener noreferrer"),
    );
  });

  it.each(cases)("%s shows a tier note exactly on the rows that have one", (_s, page) => {
    const rows = [...render(page).querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(EXPECTED_ROW_COUNT);
    const notes = rows.map((row) =>
      [...row.querySelectorAll("td")[1].querySelectorAll("p")]
        .slice(1)
        .map((p) => p.textContent),
    );
    expect(notes).toEqual(EXPECTED_TIER_NOTES[page.slug]);
  });

  it.each(cases)("%s renders every row's claim text as the first paragraph", (_s, page) => {
    const rows = [...render(page).querySelectorAll("tbody tr")];
    expect(rows).toHaveLength(EXPECTED_ROW_COUNT);
    expect(rows[0].querySelectorAll("td")[1].querySelector("p")?.textContent).toBe(
      EXPECTED_FIRST_CLAIM[page.slug],
    );
  });

  it.each(cases)("%s lists every stronger note under its heading", (_s, page) => {
    const doc = render(page);
    const heading = [...doc.querySelectorAll("h2")].find(
      (h) => h.textContent === "Where they are stronger",
    );
    expect(heading).toBeDefined();
    const items = [
      ...(heading?.parentElement?.querySelectorAll("li") ?? []),
    ].map((li) => li.textContent);
    expect(items).toEqual([...page.strongerNotes]);
    expect(items.length).toBeGreaterThan(0);
  });

  it.each(cases)("%s emits no FAQ schema because it shows no FAQ", (_s, page) => {
    const html = renderToStaticMarkup(<ComparePageLayout page={page} />);
    expect(html).not.toContain("FAQPage");
    expect(html.toLowerCase()).not.toContain("measured");
  });

  it.each(cases)("%s emits WebPage and BreadcrumbList JSON-LD that parses", (_s, page) => {
    const types = [
      ...render(page).querySelectorAll('script[type="application/ld+json"]'),
    ].map((s) => JSON.parse(s.textContent ?? "")["@type"]);
    expect(types).toEqual(["WebPage", "BreadcrumbList"]);
  });

  it("renders intro in the header and remaining paragraphs below", () => {
    const page = COMPARE_PAGES[0];
    const doc = render(page);
    expect(doc.querySelector("header p:last-of-type")?.textContent).toBe(
      page.body[0],
    );
    expect(doc.body.textContent).toContain(page.body[1]);
  });

  it("links the hub, the CTA and each related feature", () => {
    const page = COMPARE_PAGES[0];
    const hrefs = [...render(page).querySelectorAll("a")].map((a) =>
      a.getAttribute("href"),
    );
    expect(hrefs).toContain("/features");
    expect(hrefs).toContain(page.cta.href);
    for (const slug of page.related) expect(hrefs).toContain(`/features/${slug}`);
  });

  it("omits the related section when no related slug resolves", () => {
    const page = { ...COMPARE_PAGES[0], related: ["does-not-exist"] };
    const headings = [...render(page).querySelectorAll("h2")].map(
      (h) => h.textContent,
    );
    expect(headings).not.toContain("Related features");
  });
});
