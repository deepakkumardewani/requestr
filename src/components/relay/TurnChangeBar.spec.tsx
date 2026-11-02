/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
import { createFakeWriteContext } from "@/lib/relay/testing/changeLogTestKit";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { createTranslator } from "use-intl";
import { TurnChangeBar } from "./TurnChangeBar";
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

afterEach(cleanup);

const request = (id: string) => ({
  id,
  collectionId: "c1",
  folderId: null,
  name: id,
  method: "GET" as const,
  url: `https://api.test/${id}`,
  params: [],
  headers: [],
  auth: { type: "none" as const },
  body: { type: "none" as const, content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
});

async function setup(count: number) {
  const fake = createFakeWriteContext({
    requests: Array.from({ length: count }, (_, i) => request(`r${i}`)),
  } as never);
  const ids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const before = request(`r${i}`);
    const result = await fake.log.apply(
      { ...fake.write.origin, toolCallId: `call-${i}` },
      {
        entity: "request",
        entityId: before.id,
        summary: `Edit ${i}`,
        before,
        mutate: () =>
          fake.writer.put("request", { ...before, name: "changed" }),
      }
    );
    ids.push((result as { change: { id: string } }).change.id);
  }
  return { ...fake, ids };
}

const status = () => screen.getAllByRole("status")[0];

describe("TurnChangeBar", () => {
  it("offers Undo all for two or more changes and reverts the turn", async () => {
    const { log, ids, state } = await setup(2);
    render(<TurnChangeBar turnId="turn-1" changeIds={ids} settled log={log} />);
    const button = screen.getByRole("button", { name: "Undo all" });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(state.requests.map((r) => r.name)).toEqual(["r0", "r1"]);
    expect(screen.queryByRole("button", { name: "Undo all" })).toBeNull();
  });

  it("lists one row per change with a headline and Open", async () => {
    const { log, ids } = await setup(2);
    useCollectionsStore.setState({
      requests: [request("r0"), request("r1")] as never,
    });
    render(<TurnChangeBar turnId="turn-1" changeIds={ids} settled log={log} />);
    expect(screen.getAllByTestId("relay-changes-row")).toHaveLength(2);
    expect(screen.getByTestId("relay-changes-headline")).toHaveTextContent(
      "Updated 2 requests"
    );
    expect(screen.getAllByRole("button", { name: "Open" })).toHaveLength(2);
    useCollectionsStore.setState({ requests: [] });
  });

  it("renders nothing for a single change", async () => {
    const { log, ids } = await setup(1);
    const view = render(
      <TurnChangeBar turnId="turn-1" changeIds={ids} settled log={log} />
    );
    expect(view.container).toBeEmptyDOMElement();
  });

  it("renders nothing for no changes", () => {
    const view = render(
      <TurnChangeBar turnId="turn-1" changeIds={[]} settled />
    );
    expect(view.container).toBeEmptyDOMElement();
  });

  it("offers Undo all for two changes and announces them", async () => {
    const { log, ids } = await setup(2);
    render(<TurnChangeBar turnId="turn-1" changeIds={ids} settled log={log} />);
    expect(
      screen.getByRole("button", { name: "Undo all" })
    ).toBeInTheDocument();
    expect(status()).toHaveTextContent("Applied 2 changes");
  });

  it("drops Open once the change is undone", async () => {
    const { log, ids } = await setup(2);
    render(<TurnChangeBar turnId="turn-1" changeIds={ids} settled log={log} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo all" }));
    });
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
  });

  it("drops Open without a remount when the entity is deleted elsewhere", async () => {
    const { log, ids } = await setup(2);
    useCollectionsStore.setState({
      requests: [request("r0"), request("r1")] as never,
    });
    render(<TurnChangeBar turnId="turn-1" changeIds={ids} settled log={log} />);
    expect(screen.getAllByRole("button", { name: "Open" })).toHaveLength(2);
    act(() => {
      useCollectionsStore.setState({ requests: [] });
    });
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
    useCollectionsStore.setState({ requests: [] });
  });

  it("announces the count only once the reply has settled", async () => {
    const { log, ids } = await setup(3);
    const view = render(
      <TurnChangeBar
        turnId="turn-1"
        changeIds={ids}
        settled={false}
        log={log}
      />
    );
    expect(status()).toBeEmptyDOMElement();
    view.rerender(
      <TurnChangeBar turnId="turn-1" changeIds={ids} settled log={log} />
    );
    expect(status()).toHaveTextContent("Applied 3 changes");
  });

  it("reports changes that could not be undone because they were edited", async () => {
    const { log, ids, writer, state } = await setup(2);
    writer.put("request", { ...request("r0"), name: "user edit" });
    render(<TurnChangeBar turnId="turn-1" changeIds={ids} settled log={log} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo all" }));
    });
    expect(state.requests.map((r) => r.name)).toEqual(["user edit", "r1"]);
    expect(screen.getByTestId("relay-turn-blocked")).toHaveTextContent(
      "1 could not be undone because they changed since."
    );
  });

  it("loads changes it has not seen yet from storage", async () => {
    const { log, ids } = await setup(2);
    const fresh = { ...log, getView: vi.fn(() => null), load: vi.fn(log.load) };
    render(
      <TurnChangeBar turnId="turn-1" changeIds={ids} settled log={fresh} />
    );
    expect(fresh.load.mock.calls.map(([id]) => id)).toEqual(ids);
  });

  it("renders no Open on a deleted row", async () => {
    const fake = createFakeWriteContext({
      requests: [request("r0"), request("r1")],
    } as never);
    const ids: string[] = [];
    for (const rid of ["r0", "r1"]) {
      const result = await fake.log.apply(
        { ...fake.write.origin, toolCallId: rid },
        {
          entity: "request",
          entityId: rid,
          summary: `Deleted ${rid}`,
          before: request(rid),
          mutate: () => fake.writer.remove("request", rid),
        } as never
      );
      ids.push((result as { change: { id: string } }).change.id);
    }
    render(
      <TurnChangeBar turnId="turn-1" changeIds={ids} settled log={fake.log} />
    );
    expect(screen.getAllByTestId("relay-changes-row")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
  });

  it("renders on the server without reading the live log", async () => {
    const { log, ids } = await setup(2);
    const html = renderToString(
      <TurnChangeBar turnId="turn-1" changeIds={ids} settled log={log} />
    );
    expect(html).toContain('data-testid="relay-turn-changes"');
  });
});

describe("TurnChangeBar grouping", () => {
  it("shows one grouped row for a chain and its nodes", async () => {
    const fake = createFakeWriteContext({ chains: [] } as never);
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const after = {
        id: "ch1",
        name: "Flow",
        nodeIds: Array(i).fill("n"),
        blocks: [],
      };
      const result = await fake.log.apply(
        { ...fake.write.origin, toolCallId: `c${i}` },
        {
          entity: "chain",
          entityId: "ch1",
          summary: `Step ${i}`,
          before:
            i === 0 ? null : { ...after, nodeIds: Array(i - 1).fill("n") },
          mutate: () => fake.writer.put("chain", after),
        } as never
      );
      ids.push((result as { change: { id: string } }).change.id);
    }
    render(
      <TurnChangeBar turnId="turn-1" changeIds={ids} settled log={fake.log} />
    );
    expect(screen.getAllByTestId("relay-changes-row")).toHaveLength(1);
    expect(screen.getByTestId("relay-changes-row")).toHaveTextContent(
      'Built chain "Flow" · 4 nodes'
    );
  });
});
