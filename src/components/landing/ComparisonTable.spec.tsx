/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ComparisonTable } from "./ComparisonTable";
import {
  COMPARISON_CHECKED_ON,
  COMPARISON_GROUPS,
  COMPARISON_ROWS,
  formatCheckedMonth,
} from "./data/comparison";

const SRC_PATH = /\bsrc\//;
const CODE_REF_WORD = /\bcodeRef\b/;

function requestrCells(container: HTMLElement): HTMLTableCellElement[] {
  return Array.from(
    container.querySelectorAll<HTMLTableCellElement>("tbody tr"),
  )
    .filter((tr) => tr.querySelectorAll("td").length === 4)
    .map((tr) => tr.querySelectorAll("td")[1]);
}

describe("ComparisonTable", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders three comparison columns", () => {
    render(<ComparisonTable />);
    expect(screen.getByRole("columnheader", { name: "Requestr" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Postman" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Insomnia" })).toBeInTheDocument();
  });

  it("does not show the strawman subtitle", () => {
    render(<ComparisonTable />);
    expect(screen.queryByText(/honest look/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/strawmen/i)).not.toBeInTheDocument();
  });

  it("renders the updated heading and intro copy", () => {
    const { container } = render(<ComparisonTable />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/How\s+Requestr\s+stacks\s+up/);
    expect(text).toMatch(/honest\s+comparison/);
  });

  it("renders all three highlights as a mobile chip row", () => {
    render(<ComparisonTable />);
    expect(screen.getAllByText("100% local").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Zero setup").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Free & open").length).toBeGreaterThan(0);
  });

  it("renders the supported protocols row", () => {
    render(<ComparisonTable />);
    expect(screen.getAllByText("Protocols & real-time").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/HTTP, GraphQL, gRPC, MQTT, SOAP/).length,
    ).toBeGreaterThan(0);
  });

  it("renders a source link with an https href for every competitor cell", () => {
    render(<ComparisonTable />);
    const links = screen.getAllByTestId("comparison-source-link");
    expect(links).toHaveLength(COMPARISON_ROWS.length * 2);
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
      expect(link.getAttribute("aria-label")).toMatch(/^Source for /);
    }
  });

  it("keeps source links keyboard reachable", () => {
    render(<ComparisonTable />);
    for (const link of screen.getAllByTestId("comparison-source-link")) {
      expect(link.tagName).toBe("A");
      expect(link.getAttribute("tabindex")).not.toBe("-1");
    }
  });

  it("shows plan tiers as separate chips without the Plan prefix", () => {
    render(<ComparisonTable />);
    expect(screen.getAllByText("All plans").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Free (Scratch Pad)").length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Plan: /)).not.toBeInTheDocument();
  });

  it("renders a tier chip for every competitor cell that declares one", () => {
    render(<ComparisonTable />);
    const tiers = COMPARISON_ROWS.flatMap((r) => [r.postman.tier, r.insomnia.tier]).filter(
      (t): t is string => Boolean(t),
    );
    expect(tiers.length).toBeGreaterThan(0);
    for (const tier of tiers) {
      expect(screen.getAllByText(tier).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("labels each source link with its vendor and feature", () => {
    render(<ComparisonTable />);
    const row = COMPARISON_ROWS[0];
    expect(
      screen.getAllByRole("link", { name: `Source for Postman: ${row.feature}` }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole("link", { name: `Source for Insomnia: ${row.feature}` }),
    ).toHaveLength(1);
  });

  it("opens source links safely in a new tab", () => {
    render(<ComparisonTable />);
    for (const link of screen.getAllByTestId("comparison-source-link")) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("states when the competitor claims were checked", () => {
    const { container } = render(<ComparisonTable />);
    expect(container.textContent).toContain(
      `last checked ${formatCheckedMonth(COMPARISON_CHECKED_ON)}`,
    );
    expect(container.textContent).not.toContain(COMPARISON_CHECKED_ON);
  });

  it("never leaks code references into the rendered output", () => {
    const { container } = render(<ComparisonTable />);
    const refs = COMPARISON_ROWS.flatMap((r) => [
      r.requestr.codeRef,
      ...(r.requestr.codeRefs ?? []),
    ]);
    expect(refs).toContain("LICENSE");
    const text = container.textContent ?? "";
    for (const ref of refs) {
      expect(text).not.toContain(ref);
    }
    expect(text).not.toMatch(SRC_PATH);
    expect(text).not.toMatch(CODE_REF_WORD);
    for (const el of Array.from(container.querySelectorAll("*"))) {
      for (const attr of Array.from(el.attributes)) {
        if (attr.name === "href") continue;
        expect(attr.value).not.toMatch(SRC_PATH);
        expect(attr.value).not.toMatch(CODE_REF_WORD);
        for (const ref of refs) expect(attr.value).not.toContain(ref);
      }
    }
  });

  it("renders no code-ref elements and no links in Requestr cells", () => {
    const { container } = render(<ComparisonTable />);
    expect(screen.queryAllByTestId("comparison-code-ref")).toHaveLength(0);
    const cells = requestrCells(container);
    expect(cells).toHaveLength(COMPARISON_ROWS.length);
    for (const cell of cells) {
      expect(cell.querySelectorAll("a")).toHaveLength(0);
    }
  });

  it("states the check date as a month and year only", () => {
    const { container } = render(<ComparisonTable />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/last checked [A-Z][a-z]{2} \d{4}/);
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("renders exactly three tbody groups with ordered rowgroup headers", () => {
    const { container } = render(<ComparisonTable />);
    const bodies = container.querySelectorAll("table > tbody");
    expect(bodies).toHaveLength(3);
    const headers = Array.from(
      container.querySelectorAll('th[scope="rowgroup"]'),
    ).map((th) => th.textContent);
    expect(headers).toEqual(["Getting started", "Capabilities", "Cost & data"]);
    expect(COMPARISON_GROUPS.map((g) => g.title)).toEqual(headers);
    for (const [i, body] of Array.from(bodies).entries()) {
      expect(body.querySelectorAll('th[scope="rowgroup"]')).toHaveLength(1);
      expect(body.querySelector("th")?.textContent).toBe(headers[i]);
    }
  });

  it("places each row under its own group", () => {
    const { container } = render(<ComparisonTable />);
    const bodies = Array.from(container.querySelectorAll("table > tbody"));
    for (const [i, group] of COMPARISON_GROUPS.entries()) {
      const expected = COMPARISON_ROWS.filter((r) => r.group === group.id);
      expect(bodies[i].querySelectorAll("tr")).toHaveLength(expected.length + 1);
    }
  });

  it("keeps cells free of line breaks and tier as a separate chip", () => {
    const { container } = render(<ComparisonTable />);
    expect(container.querySelectorAll("td br")).toHaveLength(0);
    const rows = container.querySelectorAll("tbody tr");
    const dataRows = Array.from(rows).filter(
      (tr) => tr.querySelectorAll("td").length === 4,
    );
    expect(dataRows).toHaveLength(COMPARISON_ROWS.length);
    for (const [i, tr] of dataRows.entries()) {
      const row = COMPARISON_ROWS[i];
      const cells = Array.from(tr.querySelectorAll("td")).slice(2);
      const data = [row.postman, row.insomnia];
      for (const [j, cell] of cells.entries()) {
        const { text, tier } = data[j];
        const chip = cell.querySelector("span");
        if (tier) {
          expect(chip?.textContent).toBe(tier);
          expect(chip?.parentElement).toBe(cell);
        } else {
          expect(chip).toBeNull();
        }
        expect(cell.textContent).toBe(`${text}${tier ?? ""}Source`);
      }
    }
  });

  it("links each competitor cell to exactly its own source", () => {
    const { container } = render(<ComparisonTable />);
    const dataRows = Array.from(container.querySelectorAll("tbody tr")).filter(
      (tr) => tr.querySelectorAll("td").length === 4,
    );
    for (const [i, tr] of dataRows.entries()) {
      const row = COMPARISON_ROWS[i];
      const cells = Array.from(tr.querySelectorAll("td")).slice(2);
      const expected = [
        ["Postman", row.postman],
        ["Insomnia", row.insomnia],
      ] as const;
      for (const [j, cell] of cells.entries()) {
        const [vendor, data] = expected[j];
        const anchors = cell.querySelectorAll("a");
        expect(anchors).toHaveLength(1);
        expect(anchors[0].getAttribute("href")).toBe(data.source);
        expect(anchors[0].getAttribute("aria-label")).toBe(
          `Source for ${vendor}: ${row.feature}`,
        );
        expect(anchors[0].getAttribute("target")).toBe("_blank");
        expect(anchors[0].getAttribute("rel")).toBe("noopener noreferrer");
      }
    }
  });

  it("renders one link per competitor cell even when extra sources exist", () => {
    const { container } = render(<ComparisonTable />);
    const withExtras = COMPARISON_ROWS.filter(
      (r) => r.postman.extraSources?.length || r.insomnia.extraSources?.length,
    );
    expect(withExtras.length).toBeGreaterThan(0);
    expect(container.querySelectorAll("a")).toHaveLength(
      COMPARISON_ROWS.length * 2,
    );
  });
});
