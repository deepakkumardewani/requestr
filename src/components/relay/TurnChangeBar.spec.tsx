/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "use-intl";
import {
  type ChangeLog,
  type ChangeOrigin,
  createChangeLog,
} from "@/lib/relay/changeLog";
import { createFakeWriteContext } from "@/lib/relay/testing/changeLogTestKit";
import type { RequestModel } from "@/types";
import { relayMessages } from "./relayIntlMock";
import { TurnChangeBar } from "./TurnChangeBar";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const en = relayMessages("en");
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) =>
    createTranslator({
      locale: "en",
      messages: { relay: en } as never,
      namespace: namespace as never,
    }),
}));

afterEach(cleanup);

const TURN = "turn-1";

const request = (id: string): RequestModel => ({
  id,
  collectionId: "c1",
  folderId: null,
  name: `Request ${id}`,
  method: "GET",
  url: "https://api.test/a",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
});

/** Creates `count` requests in one turn through the real change log. */
async function setup(count: number) {
  const fake = createFakeWriteContext({
    collections: [{ id: "c1", name: "Orders", createdAt: 1, updatedAt: 1 }],
  } as never);
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const id = `r${i + 1}`;
    const origin: ChangeOrigin = { threadId: "t1", turnId: TURN, toolCallId: `call-${i}` };
    const result = await fake.log.apply(origin, {
      entity: "request",
      entityId: id,
      summary: `Created ${id}`,
      before: null,
      mutate: () => fake.writer.put("request", request(id)),
    });
    ids.push((result as { change: { id: string } }).change.id);
  }
  return { ...fake, ids };
}

const rows = () => screen.queryAllByTestId("relay-changes-row");
const undoAll = () => screen.queryByRole("button", { name: "Undo all" });

describe("TurnChangeBar", () => {
  it("shows nothing for a single change, which is already a card", async () => {
    const { log, ids } = await setup(1);
    const { container } = render(<TurnChangeBar turnId={TURN} changeIds={ids} settled log={log} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows nothing for a turn with no changes", () => {
    const { container } = render(
      <TurnChangeBar turnId={TURN} changeIds={[]} settled log={createFakeWriteContext().log} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists one row per change and announces the same count once settled", async () => {
    const { log, ids } = await setup(3);
    render(<TurnChangeBar turnId={TURN} changeIds={ids} settled log={log} />);
    expect(rows()).toHaveLength(3);
    expect(screen.getByRole("status")).toHaveTextContent("Applied 3 changes");
    expect(undoAll()).toBeEnabled();
  });

  it("stays silent while the reply is still streaming", async () => {
    const { log, ids } = await setup(2);
    render(<TurnChangeBar turnId={TURN} changeIds={ids} settled={false} log={log} />);
    expect(rows()).toHaveLength(2);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("Undo all reverts exactly the changes the bar counts, then offers nothing more", async () => {
    const { log, ids, state } = await setup(2);
    render(<TurnChangeBar turnId={TURN} changeIds={ids} settled log={log} />);
    expect(state.requests.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(screen.getByRole("status")).toHaveTextContent("Applied 2 changes");

    await act(async () => {
      fireEvent.click(undoAll() as HTMLElement);
    });

    expect(state.requests).toEqual([]);
    expect(ids.map((id) => log.getView(id)?.status)).toEqual(["undone", "undone"]);
    expect(undoAll()).toBeNull();
    expect(screen.queryByTestId("relay-turn-blocked")).toBeNull();
  });

  it("disables the button and says it is undoing while the undo runs", async () => {
    const { log, ids } = await setup(2);
    let finish: (value: Awaited<ReturnType<ChangeLog["undoTurn"]>>) => void = () => {};
    const slow: ChangeLog = {
      ...log,
      undoTurn: () => new Promise((resolve) => (finish = resolve)),
    };
    render(<TurnChangeBar turnId={TURN} changeIds={ids} settled log={slow} />);

    await act(async () => {
      fireEvent.click(undoAll() as HTMLElement);
    });
    const busy = screen.getByRole("button", { name: "Undoing changes" });
    expect(busy).toBeDisabled();

    await act(async () => finish({ undone: ids, blocked: [] }));
    expect(screen.getByRole("button", { name: "Undo all" })).toBeEnabled();
  });

  it("reports changes the user edited since, and keeps Undo all for them", async () => {
    const { log, ids, state, writer } = await setup(2);
    writer.put("request", { ...state.requests[0], url: "https://manual.test" });
    render(<TurnChangeBar turnId={TURN} changeIds={ids} settled log={log} />);

    await act(async () => {
      fireEvent.click(undoAll() as HTMLElement);
    });

    expect(screen.getByTestId("relay-turn-blocked")).toHaveTextContent(
      "1 could not be undone because they changed since.",
    );
    expect(state.requests.map((r) => r.id)).toEqual(["r1"]);
    expect(undoAll()).toBeEnabled();
  });

  it("clears the blocked notice once a later undo leaves nothing blocked", async () => {
    const { log, ids } = await setup(2);
    const blockedOnce = vi
      .fn<ChangeLog["undoTurn"]>()
      .mockResolvedValueOnce({ undone: [], blocked: [{ id: ids[0], reason: "edited" }] })
      .mockResolvedValueOnce({ undone: ids, blocked: [] });
    render(<TurnChangeBar turnId={TURN} changeIds={ids} settled log={{ ...log, undoTurn: blockedOnce }} />);

    await act(async () => {
      fireEvent.click(undoAll() as HTMLElement);
    });
    expect(screen.getByTestId("relay-turn-blocked")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(undoAll() as HTMLElement);
    });
    expect(screen.queryByTestId("relay-turn-blocked")).toBeNull();
    expect(blockedOnce).toHaveBeenCalledWith(TURN);
  });

  it("loads changes of a restored thread that the log has not cached", async () => {
    const { ids, storage, store, writer } = await setup(2);
    const fresh = createChangeLog({ store, writer, storage });
    expect(fresh.getView(ids[0])).toBeNull();

    await act(async () => {
      render(<TurnChangeBar turnId={TURN} changeIds={ids} settled log={fresh} />);
    });

    expect(rows()).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Applied 2 changes");
  });

  it("re-renders when a change moves to undone elsewhere", async () => {
    const { log, ids } = await setup(2);
    render(<TurnChangeBar turnId={TURN} changeIds={ids} settled log={log} />);
    expect(undoAll()).toBeEnabled();

    await act(async () => {
      await log.undo(ids[0]);
      await log.undo(ids[1]);
    });

    expect(undoAll()).toBeNull();
    const region = screen.getByTestId("relay-turn-changes");
    expect(within(region).getAllByTestId("relay-changes-row")).toHaveLength(2);
  });

  it("reads the app-wide change log when none is passed", () => {
    const { container } = render(<TurnChangeBar turnId={TURN} changeIds={[]} settled />);
    expect(container).toBeEmptyDOMElement();
  });

  describe("chain edits", () => {
    const chainAt = (steps: number) => ({
      id: "ch1",
      name: "Flow",
      nodeIds: Array(steps).fill("n"),
      blocks: [],
    });

    /** Three consecutive edits of one chain, then one request, in one turn. */
    async function setupChain() {
      const fake = createFakeWriteContext({ chains: [] } as never);
      const ids: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const origin: ChangeOrigin = { threadId: "t1", turnId: TURN, toolCallId: `c${i}` };
        const result = await fake.log.apply(origin, {
          entity: "chain",
          entityId: "ch1",
          summary: `Step ${i}`,
          before: i === 0 ? null : chainAt(i),
          mutate: () => fake.writer.put("chain", chainAt(i + 1)),
        } as never);
        ids.push((result as { change: { id: string } }).change.id);
      }
      const origin: ChangeOrigin = { threadId: "t1", turnId: TURN, toolCallId: "c-req" };
      const result = await fake.log.apply(origin, {
        entity: "request",
        entityId: "r1",
        summary: "Created r1",
        before: null,
        mutate: () => fake.writer.put("request", request("r1")),
      });
      ids.push((result as { change: { id: string } }).change.id);
      return { ...fake, ids };
    }

    it("collapses one chain's edits into a single row, counted once", async () => {
      const { log, ids } = await setupChain();
      render(<TurnChangeBar turnId={TURN} changeIds={ids} settled log={log} />);
      const labels = rows().map((row) => row.textContent);
      expect(labels.filter((label) => label?.includes('Built chain "Flow"'))).toHaveLength(1);
      expect(rows()).toHaveLength(2);
      expect(screen.getByRole("status")).toHaveTextContent("Applied 4 changes");
    });

    it("labels an edited existing chain with its edit count and marks it undone with the rest", async () => {
      const fake = createFakeWriteContext({ chains: [chainAt(0)] } as never);
      const ids: string[] = [];
      for (let i = 0; i < 2; i += 1) {
        const origin: ChangeOrigin = { threadId: "t1", turnId: TURN, toolCallId: `c${i}` };
        const result = await fake.log.apply(origin, {
          entity: "chain",
          entityId: "ch1",
          summary: `Step ${i}`,
          before: chainAt(i),
          mutate: () => fake.writer.put("chain", chainAt(i + 1)),
        } as never);
        ids.push((result as { change: { id: string } }).change.id);
      }
      const origin: ChangeOrigin = { threadId: "t1", turnId: TURN, toolCallId: "c-req" };
      const result = await fake.log.apply(origin, {
        entity: "request",
        entityId: "r1",
        summary: "Created r1",
        before: null,
        mutate: () => fake.writer.put("request", request("r1")),
      });
      ids.push((result as { change: { id: string } }).change.id);

      render(<TurnChangeBar turnId={TURN} changeIds={ids} settled log={fake.log} />);
      expect(screen.getByTestId("relay-turn-changes")).toHaveTextContent('Updated chain "Flow" · 2 changes');

      await act(async () => {
        fireEvent.click(undoAll() as HTMLElement);
      });
      expect(undoAll()).toBeNull();
      expect(ids.map((id) => fake.log.getView(id)?.status)).toEqual(["undone", "undone", "undone"]);
    });
  });
});
