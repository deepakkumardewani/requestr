/** @vitest-environment happy-dom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ArrowConfigInjectionPreviewList,
  type InjectionPreviewRow,
} from "./ArrowConfigInjectionPreviewList";

const row = (
  rowId: string,
  overrides: Partial<InjectionPreviewRow> = {},
): InjectionPreviewRow => ({
  rowId,
  sourceJsonPath: "$.token",
  targetField: "header",
  targetKey: "Authorization",
  ...overrides,
});

function renderList(
  injections: InjectionPreviewRow[],
  sourceRequestName?: string,
) {
  const buildPreview = vi.fn((inj) => `preview:${inj.targetKey}`);
  const jsonPathToVarName = vi.fn((p: string) => `var_${p.replace("$.", "")}`);
  const view = render(
    <ArrowConfigInjectionPreviewList
      injections={injections}
      sourceRequestName={sourceRequestName}
      buildPreview={buildPreview}
      jsonPathToVarName={jsonPathToVarName}
    />,
  );
  return { ...view, buildPreview, jsonPathToVarName };
}

describe("ArrowConfigInjectionPreviewList", () => {
  afterEach(cleanup);

  it("renders nothing when no injection has both a path and a key", () => {
    const { container } = renderList([
      row("r1", { sourceJsonPath: "" }),
      row("r2", { targetKey: "" }),
    ]);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for an empty injection list", () => {
    const { container } = renderList([]);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the extract path, source name, built preview and runtime placeholder", () => {
    renderList([row("r1")], "Login API");

    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("$.token")).toBeInTheDocument();
    expect(screen.getByText("Login API")).toBeInTheDocument();
    expect(screen.getByText("Request header")).toBeInTheDocument();
    expect(screen.getByText("preview:Authorization")).toBeInTheDocument();
    expect(screen.getByText(/<code>\{\{var_token\}\}<\/code> replaced at runtime/)).toBeInTheDocument();
  });

  it("falls back to a generic source label when the source name is missing", () => {
    renderList([row("r1")]);

    expect(screen.getByText("source")).toBeInTheDocument();
  });

  it("omits the numbered label when there is a single injection", () => {
    renderList([row("r1")]);

    expect(screen.queryByText(/^Injection \d+$/)).not.toBeInTheDocument();
  });

  it("numbers each complete injection by its list position when there are several", () => {
    renderList([
      row("r1"),
      row("r2", { sourceJsonPath: "$.id", targetField: "body", targetKey: "uid" }),
    ]);

    expect(screen.getByText("Injection 1")).toBeInTheDocument();
    expect(screen.getByText("Injection 2")).toBeInTheDocument();
    expect(screen.getByText("Body path")).toBeInTheDocument();
    expect(screen.getByText("preview:uid")).toBeInTheDocument();
  });

  it("skips incomplete rows but keeps the original index of complete ones", () => {
    const { buildPreview } = renderList([
      row("r1", { targetKey: "" }),
      row("r2", { sourceJsonPath: "$.id", targetKey: "X-Id" }),
    ]);

    expect(screen.getByText("Injection 2")).toBeInTheDocument();
    expect(screen.queryByText("Injection 1")).not.toBeInTheDocument();
    expect(buildPreview).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("preview:")).not.toBeInTheDocument();
  });

  it.each([
    ["url", "Injected URL"],
    ["path", "Resolved URL"],
    ["header", "Request header"],
    ["body", "Body path"],
  ] as const)("labels a %s target as %s", (targetField, label) => {
    renderList([row("r1", { targetField })]);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
