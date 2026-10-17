/** @vitest-environment happy-dom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createFakeWriteContext } from "@/lib/relay/testing/changeLogTestKit";
import { TurnChangeBar } from "./TurnChangeBar";
import { relayMessages } from "./relayIntlMock";
const en = relayMessages("en");

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string | number>) => {
    const path = [...namespace.split(".").slice(1), ...key.split(".")];
    const template = path.reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      en,
    ) as string;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  },
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
        mutate: () => fake.writer.put("request", { ...before, name: "changed" }),
      },
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
    const button = screen.getByRole("button", { name: "Undo all 2 changes" });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(state.requests.map((r) => r.name)).toEqual(["r0", "r1"]);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("has no button for a single change but still announces it", async () => {
    const { log, ids } = await setup(1);
    render(<TurnChangeBar turnId="turn-1" changeIds={ids} settled log={log} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(status()).toHaveTextContent("Applied 1 change");
  });

  it("announces the count only once the reply has settled", async () => {
    const { log, ids } = await setup(3);
    const view = render(<TurnChangeBar turnId="turn-1" changeIds={ids} settled={false} log={log} />);
    expect(status()).toBeEmptyDOMElement();
    view.rerender(<TurnChangeBar turnId="turn-1" changeIds={ids} settled log={log} />);
    expect(status()).toHaveTextContent("Applied 3 changes");
  });

  it("reports changes that could not be undone because they were edited", async () => {
    const { log, ids, writer, state } = await setup(2);
    writer.put("request", { ...request("r0"), name: "user edit" });
    render(<TurnChangeBar turnId="turn-1" changeIds={ids} settled log={log} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Undo all 2 changes" }));
    });
    expect(state.requests.map((r) => r.name)).toEqual(["user edit", "r1"]);
    expect(screen.getByTestId("relay-turn-blocked")).toHaveTextContent(
      "1 could not be undone because they changed since.",
    );
  });
});
