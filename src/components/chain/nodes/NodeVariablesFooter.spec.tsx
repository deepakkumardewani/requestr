/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { extractVariableRefs, NodeVariablesFooter } from "./NodeVariablesFooter";

afterEach(cleanup);

describe("extractVariableRefs", () => {
  it("returns the distinct {{var}} names referenced across the given texts", () => {
    expect(
      extractVariableRefs([
        "https://api.example.com/{{userId}}",
        "Bearer {{token}}",
        "{{userId}} again",
      ]),
    ).toEqual(["userId", "token"]);
  });

  it("returns an empty array when there are no references", () => {
    expect(extractVariableRefs(["https://api.example.com"])).toEqual([]);
  });
});

describe("NodeVariablesFooter", () => {
  it("renders nothing when the node references no variables", () => {
    const { container } = render(
      <NodeVariablesFooter texts={["https://api.example.com"]} resolvedNames={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the count of distinct variable references", () => {
    render(
      <NodeVariablesFooter
        texts={["{{token}}", "{{userId}}", "{{userId}}"]}
        resolvedNames={["token", "userId"]}
      />,
    );
    expect(screen.getByTestId("node-variables-footer")).toHaveTextContent(
      "Variables (2)",
    );
  });

  it("shows the unresolved count when some references don't resolve", () => {
    render(
      <NodeVariablesFooter
        texts={["{{token}}", "{{userId}}"]}
        resolvedNames={["token"]}
      />,
    );
    expect(
      screen.getByTestId("node-variables-footer-unresolved"),
    ).toHaveTextContent("1 unresolved");
  });

  it("does not show the unresolved badge when everything resolves", () => {
    render(
      <NodeVariablesFooter texts={["{{token}}"]} resolvedNames={["token"]} />,
    );
    expect(
      screen.queryByTestId("node-variables-footer-unresolved"),
    ).not.toBeInTheDocument();
  });

  it("lists every referenced variable name in the hover panel", () => {
    render(
      <NodeVariablesFooter
        texts={["{{token}}", "{{userId}}"]}
        resolvedNames={["token"]}
      />,
    );

    const list = screen.getByTestId("node-variables-footer-list");
    expect(list).toHaveTextContent("{{token}}");
    expect(list).toHaveTextContent("{{userId}}");
  });
});
