/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HistoryDayHeader } from "./HistoryDayHeader";

afterEach(cleanup);

describe("HistoryDayHeader", () => {
  it("renders the label as a level-3 heading", () => {
    render(<HistoryDayHeader label="Yesterday" />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Yesterday" })
    ).toBeInTheDocument();
  });

  it("pins itself to the top of the scroll area", () => {
    render(<HistoryDayHeader label="Today" />);

    expect(screen.getByTestId("history-day-header")).toHaveClass(
      "sticky",
      "top-0"
    );
  });
});
