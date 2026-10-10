/** @vitest-environment happy-dom */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { StepWarning } from "@/lib/chainRunHistory";
import { StepWarnings } from "./StepWarnings";

afterEach(cleanup);

describe("StepWarnings", () => {
  it("renders nothing when warnings are undefined", () => {
    render(<StepWarnings />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders nothing when warnings are empty", () => {
    render(<StepWarnings warnings={[]} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    ["edge", "an edge"],
    ["display", "a Display block"],
    ["evaluate", "an Evaluate block"],
  ] as const)(
    "names the previous %s owner in an alias-collision message",
    (kind, label) => {
      render(
        <StepWarnings
          warnings={[
            {
              kind: "alias-collision",
              alias: "token",
              previousOwner: { kind, id: "p" },
              owner: { kind: "edge", id: "o" },
            },
          ]}
        />,
      );

      expect(
        within(screen.getByRole("alert")).getByText(
          `Alias token overwrote the value written by ${label}`,
        ),
      ).toBeInTheDocument();
    },
  );

  it("reports the executed and total counts for a truncated loop", () => {
    render(
      <StepWarnings
        warnings={[{ kind: "loop-truncated", executed: 100, total: 250 }]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ran only the first 100 of 250 items",
    );
  });

  it("reports failed iteration counts for a loop with failures", () => {
    render(
      <StepWarnings
        warnings={[{ kind: "loop-iterations-failed", failed: 2, total: 5 }]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "2 of 5 iterations failed",
    );
  });

  it("renders every warning of a step, including two collisions on different aliases", () => {
    const owner = { kind: "edge", id: "o" } as const;
    const previousOwner = { kind: "display", id: "p" } as const;
    const warnings: StepWarning[] = [
      { kind: "alias-collision", alias: "a", previousOwner, owner },
      { kind: "alias-collision", alias: "b", previousOwner, owner },
      { kind: "loop-truncated", executed: 1, total: 2 },
    ];

    render(<StepWarnings warnings={warnings} />);

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText(/Alias a overwrote/)).toBeInTheDocument();
    expect(within(alert).getByText(/Alias b overwrote/)).toBeInTheDocument();
    expect(within(alert).getByText(/Ran only the first 1 of 2/)).toBeInTheDocument();
  });

  it("includes a screen-reader-only Warnings title", () => {
    render(
      <StepWarnings
        warnings={[{ kind: "loop-truncated", executed: 1, total: 2 }]}
      />,
    );

    expect(screen.getByText("Warnings")).toHaveClass("sr-only");
  });
});
