/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStandaloneChainStore } from "@/stores/useStandaloneChainStore";
import { ChainList } from "./ChainList";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("ChainList", () => {
  beforeEach(() => {
    useStandaloneChainStore.setState({ chains: {}, hydrated: true });
    push.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows empty state when there are no chains", () => {
    render(<ChainList isCreating={false} onCreatingDone={vi.fn()} />);

    expect(screen.getByText("No chains")).toBeInTheDocument();
  });

  it("lists chain names when chains exist", () => {
    useStandaloneChainStore.getState().createChain("Flow A");

    render(<ChainList isCreating={false} onCreatingDone={vi.fn()} />);

    expect(screen.getByText("Flow A")).toBeInTheDocument();
  });
});
