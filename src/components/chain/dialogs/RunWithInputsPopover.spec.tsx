/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import type { ChainInput } from "@/types/chain";
import { RunWithInputsPopover } from "./RunWithInputsPopover";

afterEach(cleanup);

function makeInput(overrides: Partial<ChainInput> = {}): ChainInput {
  return { key: "token", defaultValue: "abc", source: "literal", ...overrides };
}

describe("RunWithInputsPopover", () => {
  it("pre-fills fields with each input's default value", async () => {
    render(
      <RunWithInputsPopover
        inputs={[makeInput({ key: "token", defaultValue: "abc" })]}
        onRun={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("run-with-inputs-btn"));

    await waitFor(() => {
      expect(screen.getByLabelText("token")).toHaveValue("abc");
    });
  });

  it("calls onRun with the overridden values and closes", async () => {
    const onRun = vi.fn();
    render(
      <RunWithInputsPopover
        inputs={[makeInput({ key: "token", defaultValue: "abc" })]}
        onRun={onRun}
      />,
    );

    fireEvent.click(screen.getByTestId("run-with-inputs-btn"));
    await waitFor(() => screen.getByLabelText("token"));

    fireEvent.change(screen.getByLabelText("token"), {
      target: { value: "override-value" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^run$/i }));

    expect(onRun).toHaveBeenCalledWith({ token: "override-value" });
  });

  it("re-syncs fields to defaults each time it is re-opened", async () => {
    render(
      <RunWithInputsPopover
        inputs={[makeInput({ key: "token", defaultValue: "abc" })]}
        onRun={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("run-with-inputs-btn"));
    await waitFor(() => screen.getByLabelText("token"));
    fireEvent.change(screen.getByLabelText("token"), {
      target: { value: "changed" },
    });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    fireEvent.click(screen.getByTestId("run-with-inputs-btn"));
    await waitFor(() => {
      expect(screen.getByLabelText("token")).toHaveValue("abc");
    });
  });

  it("shows a 'no inputs' message when the Start block has no inputs", async () => {
    render(<RunWithInputsPopover inputs={[]} onRun={vi.fn()} />);

    fireEvent.click(screen.getByTestId("run-with-inputs-btn"));

    await waitFor(() => {
      expect(
        screen.getByText(/no inputs defined/i),
      ).toBeInTheDocument();
    });
  });

  it("is disabled when the disabled prop is set", () => {
    render(
      <RunWithInputsPopover inputs={[makeInput()]} disabled onRun={vi.fn()} />,
    );

    expect(screen.getByTestId("run-with-inputs-btn")).toBeDisabled();
  });

  it("pre-fills env-sourced inputs from the active environment", async () => {
    useEnvironmentsStore.setState({
      activeEnvId: "e1",
      environments: [
        {
          id: "e1",
          name: "Dev",
          variables: [
            {
              id: "v",
              key: "TOKEN",
              initialValue: "",
              currentValue: "env-token",
              isSecret: false,
            },
          ],
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    });
    render(
      <RunWithInputsPopover
        inputs={[
          makeInput({
            key: "auth",
            defaultValue: "",
            source: "env",
            envVarKey: "TOKEN",
          }),
        ]}
        onRun={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId("run-with-inputs-btn"));

    await waitFor(() => {
      expect(screen.getByLabelText("auth")).toHaveValue("env-token");
    });
    useEnvironmentsStore.setState({ activeEnvId: null, environments: [] });
  });
});
