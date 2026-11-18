import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JsonLd, serializeJsonLd } from "./JsonLd";

const HOSTILE = { name: "</script><script>alert(1)</script>", n: 1 };

function extractScripts(html: string): string[] {
  return [
    ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ].map((m) => m[1]);
}

describe("serializeJsonLd", () => {
  it("escapes every < as \\u003c and still parses back to the input", () => {
    const out = serializeJsonLd(HOSTILE);
    expect(out).not.toContain("<");
    expect(JSON.parse(out)).toEqual(HOSTILE);
  });

  it("leaves data without < unchanged", () => {
    expect(serializeJsonLd({ a: "b" })).toBe('{"a":"b"}');
  });
});

describe("JsonLd", () => {
  it("renders exactly one application/ld+json script with the JSON", () => {
    const html = renderToStaticMarkup(<JsonLd data={{ "@type": "Thing" }} />);
    const scripts = extractScripts(html);
    expect(scripts).toHaveLength(1);
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(JSON.parse(scripts[0])).toEqual({ "@type": "Thing" });
  });

  it("escapes < so content cannot close the script tag early", () => {
    const html = renderToStaticMarkup(<JsonLd data={HOSTILE} />);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).toContain("\\u003c/script>");
    expect(JSON.parse(extractScripts(html)[0])).toEqual(HOSTILE);
  });
});
