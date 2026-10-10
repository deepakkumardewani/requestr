/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DiffNode } from "@/lib/jsonDiff";
import { DiffTree } from "./DiffTree";

afterEach(cleanup);

const nodes: DiffNode[] = [
  {
    key: "addedKey",
    kind: "added",
    leftValue: undefined,
    rightValue: "new",
    children: null,
    path: "addedKey",
  },
  {
    key: "removedKey",
    kind: "removed",
    leftValue: "old",
    rightValue: undefined,
    children: null,
    path: "removedKey",
  },
  {
    key: "changedKey",
    kind: "changed",
    leftValue: "before",
    rightValue: "after",
    children: null,
    path: "changedKey",
  },
];

describe("DiffTree", () => {
  it("shows identical message when there are no diff nodes", () => {
    render(<DiffTree nodes={[]} />);
    expect(
      screen.getByText(/No differences found — the two JSON values are identical/),
    ).toBeInTheDocument();
  });

  it("renders added, removed, and changed leaf rows", () => {
    render(<DiffTree nodes={nodes} />);

    expect(screen.getByText(/addedKey:/)).toBeInTheDocument();
    expect(screen.getByText(/removedKey:/)).toBeInTheDocument();
    expect(screen.getByText('"before"')).toBeInTheDocument();
    expect(screen.getByText('"after"')).toBeInTheDocument();
  });

  it("expands a container node when its toggle is clicked", () => {
    const tree: DiffNode[] = [
      {
        key: "user",
        kind: "unchanged",
        leftValue: {},
        rightValue: {},
        path: "user",
        children: [
          {
            key: "name",
            kind: "changed",
            leftValue: "a",
            rightValue: "b",
            children: null,
            path: "user.name",
          },
        ],
      },
    ];

    render(<DiffTree nodes={tree} />);

    expect(screen.getByText("{…}")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText('"a"')).toBeInTheDocument();
    expect(screen.getByText('"b"')).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByText('"a"')).not.toBeInTheDocument();
  });
});
