import { describe, expect, it } from "vitest";
import { buildCollectionDocs } from "./collectionDocs";
import { summarizeCollection } from "./collectionSummary";
import { buildRedactContext } from "./redact";
import { PLAIN_PASSWORD } from "./redact.corpus";

describe("buildCollectionDocs", () => {
  it("renders a title, a pluralised count and one line per request", () => {
    const summary = summarizeCollection([
      { name: "List users", method: "GET", url: "https://a.test/users" },
      { name: "Create user", method: "POST", url: "https://a.test/users" },
    ]);
    expect(buildCollectionDocs(summary, { title: "Users API" })).toBe(
      [
        "# Users API",
        "",
        "2 requests",
        "",
        "- **GET** List users: `https://a.test/users`",
        "- **POST** Create user: `https://a.test/users`",
      ].join("\n"),
    );
  });

  it("uses the singular for one request and a default title", () => {
    const summary = summarizeCollection([{ name: "Ping", method: "GET", url: "https://a.test/ping" }]);
    expect(buildCollectionDocs(summary)).toBe(
      "# Collection\n\n1 request\n\n- **GET** Ping: `https://a.test/ping`",
    );
  });

  it("renders an empty collection", () => {
    expect(buildCollectionDocs(summarizeCollection([]))).toBe("# Collection\n\n0 requests\n");
  });

  it("appends the omitted tail only from the capped summary", () => {
    const requests = Array.from({ length: 5 }, (_, i) => ({ name: `R${i}`, method: "GET", url: `https://a.test/${i}` }));
    const docs = buildCollectionDocs(summarizeCollection(requests, 2));
    expect(docs).toContain("5 requests");
    expect(docs).toContain("R0");
    expect(docs).toContain("R1");
    expect(docs).not.toContain("R2");
    expect(docs.endsWith("\n\n…and 3 more — use search")).toBe(true);
  });

  it("redacts secrets in urls", () => {
    const summary = summarizeCollection([
      { name: "Login", method: "GET", url: `https://a.test/x?api_key=${PLAIN_PASSWORD}&page=2` },
    ]);
    const docs = buildCollectionDocs(summary);
    expect(docs).not.toContain(PLAIN_PASSWORD);
    expect(docs).toContain("page=2");
  });

  it("scrubs a resolved environment secret using the supplied context", () => {
    const redact = buildRedactContext([
      {
        id: "e", name: "E", createdAt: 0, updatedAt: 0,
        variables: [{ id: "v", key: "token", initialValue: "", currentValue: "plain-env-secret-value-9981", isSecret: true }],
      },
    ]);
    const summary = summarizeCollection([
      { name: "R", method: "GET", url: "https://a.test/plain-env-secret-value-9981" },
    ]);
    const docs = buildCollectionDocs(summary, { redact });
    expect(docs).not.toContain("plain-env-secret-value-9981");
    expect(docs).toContain("{{token}}");
  });
});
