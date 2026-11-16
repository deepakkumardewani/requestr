/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createTranslator } from "use-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayTurnStore } from "@/stores/useRelayTurnStore";
import { KeepUndoDialog } from "./KeepUndoDialog";
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

const undoMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/relay/changeLog", () => ({
  getRelayChangeLog: () => ({ undo: undoMock }),
}));

/** Mirrors the chat's resolver: the first answer wins, and it closes the dialog. */
function openRequest(changeIds: string[]) {
  const answers: Array<readonly string[] | null> = [];
  act(() => {
    useRelayTurnStore.getState().requestKeepUndo({
      turnId: "turn-1",
      changeIds,
      resolve: (kept) => {
        answers.push(kept);
        useRelayTurnStore.getState().clearKeepUndo();
      },
    });
  });
  return answers;
}

beforeEach(() => {
  undoMock.mockReset();
  useRelayTurnStore.getState().reset();
});

afterEach(() => {
  cleanup();
});

describe("KeepUndoDialog (HH-M23)", () => {
  it("renders nothing while no request is open", () => {
    render(<KeepUndoDialog />);

    expect(screen.queryByTestId("relay-keep-undo")).toBeNull();
  });

  it("states how many changes the turn applied", () => {
    render(<KeepUndoDialog />);

    openRequest(["c1", "c2", "c3"]);

    expect(screen.getByText("Keep the changes from this reply?")).toBeTruthy();
    expect(screen.getByText(/3 changes were applied/)).toBeTruthy();
  });

  it("uses the singular for one change", () => {
    render(<KeepUndoDialog />);

    openRequest(["c1"]);

    expect(screen.getByText(/1 change was applied/)).toBeTruthy();
  });

  it("Keep them hands every change back as kept and closes", async () => {
    render(<KeepUndoDialog />);
    const answers = openRequest(["c1", "c2"]);

    fireEvent.click(screen.getByTestId("relay-keep-undo-keep"));

    await waitFor(() => expect(screen.queryByTestId("relay-keep-undo")).toBeNull());
    expect(answers[0]).toEqual(["c1", "c2"]);
    expect(undoMock).not.toHaveBeenCalled();
  });

  it("Undo them reverts newest first and reports nothing kept", async () => {
    undoMock.mockResolvedValue({ ok: true });
    render(<KeepUndoDialog />);
    const answers = openRequest(["c1", "c2", "c3"]);

    fireEvent.click(screen.getByTestId("relay-keep-undo-undo"));

    await waitFor(() => expect(answers).toHaveLength(1));
    expect(undoMock.mock.calls.map(([id]) => id)).toEqual(["c3", "c2", "c1"]);
    expect(answers[0]).toEqual([]);
  });

  it("a change that cannot be undone stays and is reported back as kept", async () => {
    undoMock.mockImplementation(async (id: string) =>
      id === "c2" ? { ok: false, reason: "edited" } : { ok: true },
    );
    render(<KeepUndoDialog />);
    const answers = openRequest(["c1", "c2", "c3"]);

    fireEvent.click(screen.getByTestId("relay-keep-undo-undo"));

    await waitFor(() => expect(answers).toHaveLength(1));
    expect(undoMock).toHaveBeenCalledTimes(3);
    expect(answers[0]).toEqual(["c2"]);
  });

  it("disables every button while the undo is running", async () => {
    let finish: (value: { ok: boolean }) => void = () => {};
    undoMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    render(<KeepUndoDialog />);
    const answers = openRequest(["c1"]);

    fireEvent.click(screen.getByTestId("relay-keep-undo-undo"));

    await waitFor(() =>
      expect(
        (screen.getByTestId("relay-keep-undo-keep") as HTMLButtonElement)
          .disabled,
      ).toBe(true),
    );
    expect(
      (screen.getByTestId("relay-keep-undo-cancel") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByTestId("relay-keep-undo-undo") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(answers).toEqual([]);

    await act(async () => finish({ ok: true }));
    await waitFor(() => expect(answers[0]).toEqual([]));
  });

  it("Cancel backs out: the action is not cut and nothing is undone", async () => {
    render(<KeepUndoDialog />);
    const answers = openRequest(["c1"]);

    fireEvent.click(screen.getByTestId("relay-keep-undo-cancel"));

    await waitFor(() => expect(answers).toHaveLength(1));
    expect(answers[0]).toBeNull();
    expect(undoMock).not.toHaveBeenCalled();
  });

  it("Escape also backs out", async () => {
    render(<KeepUndoDialog />);
    const answers = openRequest(["c1"]);

    fireEvent.keyDown(screen.getByTestId("relay-keep-undo"), { key: "Escape" });

    await waitFor(() => expect(answers).toHaveLength(1));
    expect(answers[0]).toBeNull();
  });
});
