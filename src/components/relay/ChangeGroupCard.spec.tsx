/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
import { type ChangeGroup, groupChanges } from "@/lib/relay/changeGroups";
import type { ChangeView } from "@/lib/relay/changeLog";
import { createFakeWriteContext } from "@/lib/relay/testing/changeLogTestKit";
import { useChainStore } from "@/stores/useChainStore";
import { createTranslator } from "use-intl";
import { ChangeGroupCard } from "./ChangeGroupCard";
import { relayMessages } from "./relayIntlMock";
const en = relayMessages("en");

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) =>
    createTranslator({
      locale: "en",
      messages: { relay: en } as never,
      namespace: namespace as never,
    }),
}));

afterEach(() => {
  cleanup();
  push.mockClear();
  useChainStore.setState({ chains: {} });
});

const chainAt = (steps: number, name = "Flow") => ({
  id: "ch1",
  name,
  nodeIds: Array(steps).fill("n"),
  blocks: [],
});

/** Applies `steps` consecutive chain edits; the first creates the chain unless `existing`. */
async function setup(steps: number, existing = false) {
  const fake = createFakeWriteContext({
    chains: (existing ? [chainAt(0)] : []) as never,
  } as never);
  const ids: string[] = [];
  for (let i = 0; i < steps; i += 1) {
    const after = chainAt(i + 1);
    const before = i === 0 && !existing ? null : chainAt(i);
    const result = await fake.log.apply(
      { ...fake.write.origin, toolCallId: `c${i}` },
      {
        entity: "chain",
        entityId: "ch1",
        summary: `Step ${i}`,
        before,
        mutate: () => fake.writer.put("chain", after),
      } as never,
    );
    ids.push((result as { change: { id: string } }).change.id);
  }
  const views = ids.map((id) => fake.log.getView(id) as ChangeView);
  const [item] = groupChanges(views);
  return { ...fake, ids, group: item as ChangeGroup };
}

describe("ChangeGroupCard", () => {
  it("labels a created chain with its name and node count", async () => {
    const { group, log } = await setup(3);
    render(<ChangeGroupCard group={group} log={log} />);
    const card = screen.getByTestId("relay-change-group-card");
    expect(card).toHaveAttribute("data-status", "applied");
    expect(card).toHaveTextContent('Built chain "Flow" · 3 nodes');
    expect(screen.getByTitle('Built chain "Flow" · 3 nodes')).toBeInTheDocument();
  });

  it("labels an existing chain with its edit count", async () => {
    const { group, log } = await setup(2, true);
    render(<ChangeGroupCard group={group} log={log} />);
    expect(screen.getByTestId("relay-change-group-card")).toHaveTextContent(
      'Updated chain "Flow" · 2 changes',
    );
  });

  it("falls back to the app-wide change log when none is passed", async () => {
    const { group } = await setup(2);
    render(<ChangeGroupCard group={group} />);
    expect(
      screen.getByRole("button", { name: "Undo" }),
    ).toBeInTheDocument();
  });

  it("undoes every member of the group in one click", async () => {
    const { group, log, state } = await setup(3);
    render(<ChangeGroupCard group={group} log={log} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    expect(state.chains).toEqual([]);
    expect(screen.queryByTestId("relay-change-group-blocked")).toBeNull();
  });

  it("reports members that could not be undone because they changed since", async () => {
    const { group, log, writer, state } = await setup(2);
    writer.put("chain", { ...chainAt(2), name: "User edit" });
    render(<ChangeGroupCard group={group} log={log} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    });
    expect(state.chains).toHaveLength(1);
    expect(screen.getByTestId("relay-change-group-blocked")).toHaveTextContent(
      "could not be undone",
    );
  });

  it("shows the undone state without Undo or Open", async () => {
    const { group, log } = await setup(2);
    render(<ChangeGroupCard group={{ ...group, undone: true }} log={log} />);
    expect(screen.getByTestId("relay-change-group-card")).toHaveAttribute(
      "data-status",
      "undone",
    );
    expect(screen.getByTestId("relay-change-undone")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  });

  it("opens the chain when it still exists", async () => {
    const { group, log } = await setup(2);
    useChainStore.setState({ chains: { ch1: chainAt(2) } as never });
    render(<ChangeGroupCard group={group} log={log} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(push).toHaveBeenCalledWith("/chain/ch1");
  });

  it("offers no Open when the chain was deleted later", async () => {
    const { group, log } = await setup(2);
    useChainStore.setState({ chains: { ch1: chainAt(2) } as never });
    render(<ChangeGroupCard group={{ ...group, deletedLater: true }} log={log} />);
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
  });

  it("offers no Open when every member is undone but the group is not flagged", async () => {
    const { group, log } = await setup(2);
    const undoneMembers = group.changes.map((c) => ({
      ...c,
      status: "undone" as const,
    }));
    render(
      <ChangeGroupCard
        group={{ ...group, changes: undoneMembers }}
        log={log}
      />,
    );
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
  });
});
