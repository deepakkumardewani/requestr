/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GeneralSection } from "./GeneralSection";

afterEach(cleanup);

describe("GeneralSection chain execution", () => {
  it("renders the localized concurrency copy", () => {
    render(
      <GeneralSection
        showHealthMonitor
        showCodeGen
        setSetting={vi.fn()}
        onClearHistoryClick={vi.fn()}
        onRestartTour={vi.fn()}
        chainConcurrency={4}
        onChainConcurrencyChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Chain execution")).toBeInTheDocument();
    expect(screen.getByLabelText("Concurrency")).toHaveValue(4);
  });
});
