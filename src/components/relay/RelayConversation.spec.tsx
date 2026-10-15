/** @vitest-environment happy-dom */

import type { UIMessage } from "ai";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RelayChatStatus } from "@/hooks/useRelayChat";
import { RELAY_VIRTUALIZE_THRESHOLD } from "@/lib/relay/constants";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { RelayConversation } from "./RelayConversation";

// happy-dom has no layout, so the real virtualizer would render no rows.
const VIRTUAL_WINDOW = 15;
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    estimateSize,
    getItemKey,
    getScrollElement,
  }: {
    getScrollElement: () => unknown;
    count: number;
    estimateSize: (index: number) => number;
    getItemKey: (index: number) => string;
  }) => {
    getScrollElement();
    return {
    getVirtualItems: () =>
      Array.from({ length: Math.min(count, VIRTUAL_WINDOW) }, (_, index) => ({
        index,
        key: getItemKey(index),
        start: index * estimateSize(index),
      })),
    getTotalSize: () => count * estimateSize(0),
    measureElement: () => undefined,
    };
  },
}));

// The pill renders only while scrolled away from the bottom, which happy-dom
// cannot produce, so the scroll context is overridden by a flag.
const scrollState = vi.hoisted(() => ({ isAtBottom: true, scrollToBottom: vi.fn() }));
vi.mock("use-stick-to-bottom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("use-stick-to-bottom")>();
  return {
    ...actual,
    useStickToBottomContext: () => {
      const real = actual.useStickToBottomContext();
      return scrollState.isAtBottom
        ? real
        : { ...real, isAtBottom: false, scrollToBottom: scrollState.scrollToBottom };
    },
  };
});

afterEach(() => {
  cleanup();
  scrollState.isAtBottom = true;
  scrollState.scrollToBottom.mockClear();
});

const msg = (id: string, role: "user" | "assistant", text: string): UIMessage => ({
  id,
  role,
  parts: [{ type: "text", text }],
});

function setup(
  messages: UIMessage[],
  status: RelayChatStatus = "ready",
  extra: { interruptedMessageId?: string | null; onRegenerate?: () => void } = {},
) {
  return render(
    <RelayConversation
      messages={messages}
      status={status}
      interruptedMessageId={extra.interruptedMessageId ?? null}
      onRegenerate={extra.onRegenerate ?? (() => {})}
      onResolveTool={vi.fn()}
      aria-label="Relay conversation"
    />,
  );
}

describe("RelayConversation", () => {
  it("is a polite labelled log region", () => {
    setup([]);
    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).toHaveAttribute("aria-label", "Relay conversation");
    expect(log).toHaveAttribute("data-testid", "relay-messages");
  });

  it("shows the empty state only when there are no messages", () => {
    const { rerender } = setup([]);
    expect(screen.getByTestId("relay-empty")).toBeInTheDocument();
    rerender(
      <RelayConversation
        messages={[msg("u1", "user", "hi")]}
        status="ready"
        interruptedMessageId={null}
        onRegenerate={() => {}}
        onResolveTool={vi.fn()}
        aria-label="x"
      />,
    );
    expect(screen.queryByTestId("relay-empty")).toBeNull();
  });

  it("renders user text verbatim and assistant text as markdown", () => {
    setup([msg("u1", "user", "**not bold**"), msg("a1", "assistant", "**bold**")]);
    expect(screen.getByText("**not bold**")).toBeInTheDocument();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("shows the caret only on the last assistant message while streaming", () => {
    const { rerender } = setup([msg("u1", "user", "q"), msg("a1", "assistant", "par")], "streaming");
    expect(screen.getAllByTestId("relay-caret")).toHaveLength(1);
    rerender(
      <RelayConversation
        messages={[msg("u1", "user", "q"), msg("a1", "assistant", "par")]}
        status="ready"
        interruptedMessageId={null}
        onRegenerate={() => {}}
        onResolveTool={vi.fn()}
        aria-label="x"
      />,
    );
    expect(screen.queryByTestId("relay-caret")).toBeNull();
  });

  it("disables caret animation under reduced motion", () => {
    setup([msg("a1", "assistant", "par")], "streaming");
    expect(screen.getByTestId("relay-caret").className).toContain(
      "motion-reduce:animate-none",
    );
  });

  it("shows the Thinking indicator while submitted and no reply has started", () => {
    setup([msg("u1", "user", "q")], "submitted");
    const indicator = screen.getByTestId("relay-activity");
    expect(indicator).toHaveAttribute("data-kind", "thinking");
    expect(indicator).toHaveAttribute("role", "status");
  });

  it("shows the labelled step for the tool call in flight", () => {
    const calling: UIMessage = {
      id: "a1",
      role: "assistant",
      parts: [
        {
          type: "tool-create_collection",
          toolCallId: "c1",
          state: "input-available",
          input: { name: "Orders", parentId: null },
        } as UIMessage["parts"][number],
      ],
    };
    setup([msg("u1", "user", "q"), calling], "streaming");
    expect(screen.getByTestId("relay-activity-label")).toHaveTextContent(
      "activity.tools.create_collection",
    );
  });

  it("hides the indicator once reply text is streaming or the turn is idle", () => {
    setup([msg("u1", "user", "q"), msg("a1", "assistant", "par")], "streaming");
    expect(screen.queryByTestId("relay-activity")).toBeNull();
    cleanup();
    setup([msg("u1", "user", "q")], "ready");
    expect(screen.queryByTestId("relay-activity")).toBeNull();
  });

  it("offers Regenerate on the last assistant turn only, and calls back", () => {
    const onRegenerate = vi.fn();
    setup(
      [msg("a0", "assistant", "old"), msg("u1", "user", "q"), msg("a1", "assistant", "new")],
      "ready",
      { onRegenerate },
    );
    const buttons = screen.getAllByTestId("relay-regenerate");
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it("hides Regenerate while generating or when the last turn is the user's", () => {
    const { rerender } = setup([msg("a1", "assistant", "x")], "streaming");
    expect(screen.queryByTestId("relay-regenerate")).toBeNull();
    rerender(
      <RelayConversation
        messages={[msg("u1", "user", "q")]}
        status="ready"
        interruptedMessageId={null}
        onRegenerate={() => {}}
        onResolveTool={vi.fn()}
        aria-label="x"
      />,
    );
    expect(screen.queryByTestId("relay-regenerate")).toBeNull();
  });

  it("marks an interrupted message", () => {
    setup([msg("a1", "assistant", "cut")], "error", { interruptedMessageId: "a1" });
    expect(screen.getByText("interrupted")).toBeInTheDocument();
  });

  it("renders a row for each tool call of an assistant message", () => {
    setup([
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-get_request",
            toolCallId: "c1",
            state: "output-available",
            input: { requestId: "r1" },
            output: { ok: true, data: { method: "GET", url: "/orders" } },
          } as never,
          { type: "text", text: "Done" },
        ],
      },
    ]);
    expect(screen.getAllByTestId("relay-tool-row")).toHaveLength(1);
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  describe("write tools", () => {
    const writePart = (callId: string, changeId: string) =>
      ({
        type: "tool-update_request",
        toolCallId: callId,
        state: "output-available",
        input: {},
        output: { ok: true, data: { changeId, summary: `Edit ${callId}` } },
      }) as never;

    it("shows a Change Card instead of a row, and a failed write as an alert row", () => {
      setup([
        msg("u1", "user", "go"),
        {
          id: "a1",
          role: "assistant",
          parts: [
            writePart("c1", "chg-1"),
            {
              type: "tool-update_request",
              toolCallId: "c2",
              state: "output-available",
              output: { ok: false, error: "request not found: x" },
            } as never,
          ],
        },
      ]);
      expect(screen.getAllByTestId("relay-change-card")).toHaveLength(1);
      expect(screen.getByRole("alert")).toHaveTextContent("request not found: x");
      expect(screen.queryByTestId("relay-turn-blocked")).toBeNull();
    });

    it("adds the turn bar once a reply holds several changes", () => {
      setup([
        msg("u1", "user", "go"),
        { id: "a1", role: "assistant", parts: [writePart("c1", "chg-1"), writePart("c2", "chg-2")] },
      ]);
      expect(screen.getAllByTestId("relay-change-card")).toHaveLength(2);
      expect(screen.getByTestId("relay-turn-changes")).toBeInTheDocument();
    });
  });

  describe("prompt cards", () => {
    const toolMessage = (part: object): UIMessage[] => [
      msg("u1", "user", "go"),
      { id: "a1", role: "assistant", parts: [part as never] },
    ];

    it("shows a Confirmation Card for a pending destructive call and reports the answer", () => {
      const onResolveTool = vi.fn();
      render(
        <RelayConversation
          messages={toolMessage({
            type: "tool-delete_request",
            toolCallId: "d1",
            state: "input-available",
            input: { ids: ["r1"] },
          })}
          status="ready"
          interruptedMessageId={null}
          onRegenerate={() => {}}
          onResolveTool={onResolveTool}
          aria-label="Relay conversation"
        />,
      );
      fireEvent.click(screen.getByTestId("relay-confirm-decline"));
      expect(onResolveTool).toHaveBeenCalledWith("d1", { kind: "decline" });
    });

    it("reports approval from the Confirmation Card", () => {
      const onResolveTool = vi.fn();
      render(
        <RelayConversation
          messages={toolMessage({
            type: "tool-delete_request",
            toolCallId: "d2",
            state: "input-available",
            input: { ids: ["r1"] },
          })}
          status="ready"
          interruptedMessageId={null}
          onRegenerate={() => {}}
          onResolveTool={onResolveTool}
          aria-label="Relay conversation"
        />,
      );
      fireEvent.click(screen.getByTestId("relay-confirm-approve"));
      expect(onResolveTool).toHaveBeenCalledWith("d2", { kind: "approve" });
    });

    it("shows the question and reports the chosen option", () => {
      const onResolveTool = vi.fn();
      render(
        <RelayConversation
          messages={toolMessage({
            type: "tool-ask_user",
            toolCallId: "q1",
            state: "input-available",
            input: { question: "Which?", options: ["A", "B"] },
          })}
          status="ready"
          interruptedMessageId={null}
          onRegenerate={() => {}}
          onResolveTool={onResolveTool}
          aria-label="Relay conversation"
        />,
      );
      fireEvent.click(screen.getByText("B"));
      expect(onResolveTool).toHaveBeenCalledWith("q1", { kind: "answer", choice: "B" });
    });

    describe("with live tabs and requests", () => {
      const tab = (tabId: string, name: string, isDirty: boolean) => ({
        tabId,
        requestId: null,
        name,
        isDirty,
        type: "http",
      });
      const renderPending = (part: object, onResolveTool = vi.fn()) => {
        render(
          <RelayConversation
            messages={toolMessage(part)}
            status="ready"
            interruptedMessageId={null}
            onRegenerate={() => {}}
            onResolveTool={onResolveTool}
            aria-label="Relay conversation"
          />,
        );
        return onResolveTool;
      };
      const closeAll = {
        type: "tool-close_all_tabs",
        toolCallId: "x1",
        state: "input-available",
        input: { includePinned: null },
      };

      afterEach(() => {
        useTabsStore.setState({ tabs: [] });
        useCollectionsStore.setState({ requests: [] });
      });

      it("shows the dirty-close card listing the dirty tabs and answers with the decision", () => {
        useTabsStore.setState({
          tabs: [tab("t1", "Unsaved one", true), tab("t2", "Clean one", false)] as never,
        });
        const onResolveTool = renderPending(closeAll);
        const list = screen.getByTestId("relay-close-tabs-list");
        expect(list).toHaveTextContent("Unsaved one");
        expect(list).not.toHaveTextContent("Clean one");
        expect(screen.queryByTestId("relay-confirm-card")).toBeNull();
        fireEvent.click(screen.getByTestId("relay-close-tabs-save-all"));
        expect(onResolveTool).toHaveBeenCalledWith("x1", { kind: "answer", choice: "save-all" });
      });

      it("reports Discard as a discard answer and Cancel as a decline", () => {
        useTabsStore.setState({ tabs: [tab("t1", "Unsaved one", true)] as never });
        const onDiscard = renderPending(closeAll);
        fireEvent.click(screen.getByTestId("relay-close-tabs-discard"));
        expect(onDiscard).toHaveBeenCalledWith("x1", { kind: "answer", choice: "discard" });
        cleanup();
        const onCancel = renderPending(closeAll);
        fireEvent.click(screen.getByTestId("relay-close-tabs-cancel"));
        expect(onCancel).toHaveBeenCalledWith("x1", { kind: "decline" });
      });

      it("handles a single dirty tab closed by id", () => {
        useTabsStore.setState({ tabs: [tab("t1", "Unsaved one", true)] as never });
        renderPending({
          type: "tool-close_tab",
          toolCallId: "x2",
          state: "input-available",
          input: { tabId: "t1" },
        });
        expect(screen.getByTestId("relay-close-tabs-list")).toHaveTextContent("Unsaved one");
      });

      it("shows no card when no targeted tab is dirty", () => {
        useTabsStore.setState({ tabs: [tab("t1", "Clean one", false)] as never });
        renderPending(closeAll);
        expect(screen.queryByTestId("relay-close-tabs-card")).toBeNull();
        expect(screen.queryByTestId("relay-confirm-card")).toBeNull();
      });

      describe("deleting a request that has an unsaved tab", () => {
        const deleteOne = {
          type: "tool-delete_request",
          toolCallId: "dd1",
          state: "input-available",
          input: { ids: ["r1"] },
        };
        beforeEach(() => {
          useCollectionsStore.setState({
            collections: [],
            folders: [],
            requests: [{ id: "r1", name: "Orders", collectionId: "c1", folderId: null }] as never,
          });
          useTabsStore.setState({
            tabs: [
              { ...tab("t9", "Orders draft", true), requestId: "r1" },
              { ...tab("t8", "Other", false), requestId: "r2" },
            ] as never,
          });
        });

        it("shows the decision card with the delete title instead of the plain confirm card", () => {
          renderPending(deleteOne);
          expect(screen.getByTestId("relay-close-tabs-list")).toHaveTextContent("Orders draft");
          expect(screen.getByTestId("relay-close-tabs-list")).not.toHaveTextContent("Other");
          expect(screen.getByText("deleteTitle")).toBeInTheDocument();
          expect(screen.queryByTestId("relay-confirm-card")).toBeNull();
        });

        it("answers Save all with approval and Discard with approval", () => {
          const onSave = renderPending(deleteOne);
          fireEvent.click(screen.getByTestId("relay-close-tabs-save-all"));
          expect(onSave).toHaveBeenCalledWith("dd1", {
            kind: "answer",
            choice: "save-all",
            approve: true,
          });
          cleanup();
          const onDiscard = renderPending(deleteOne);
          fireEvent.click(screen.getByTestId("relay-close-tabs-discard"));
          expect(onDiscard).toHaveBeenCalledWith("dd1", {
            kind: "answer",
            choice: "discard",
            approve: true,
          });
        });

        it("declines on Cancel", () => {
          const onResolve = renderPending(deleteOne);
          fireEvent.click(screen.getByTestId("relay-close-tabs-cancel"));
          expect(onResolve).toHaveBeenCalledWith("dd1", { kind: "decline" });
        });

        it("falls back to the plain confirm card when the tab is clean", () => {
          useTabsStore.setState({ tabs: [{ ...tab("t9", "Orders", false), requestId: "r1" }] as never });
          renderPending(deleteOne);
          expect(screen.getByTestId("relay-confirm-card")).toBeInTheDocument();
          expect(screen.queryByTestId("relay-close-tabs-list")).toBeNull();
        });
      });

      it("shows the count and first names for a collection-wide delete", () => {
        useCollectionsStore.setState({
          collections: [{ id: "c1", name: "Orders" }] as never,
          folders: [],
          requests: Array.from({ length: 8 }, (_, i) => ({
            id: `r${i}`,
            name: `Req ${i}`,
            collectionId: "c1",
            folderId: null,
          })) as never,
        });
        renderPending({
          type: "tool-delete_requests_in_collection",
          toolCallId: "b1",
          state: "input-available",
          input: { collectionId: "c1" },
        });
        const card = screen.getByTestId("relay-confirm-card");
        expect(card).toHaveAttribute("data-severity", "danger");
        expect(card).toHaveAttribute("data-action", "delete");
        expect(screen.getByText("titleDeleteMany")).toBeInTheDocument();
        expect(screen.getByText("more")).toBeInTheDocument();
        expect(screen.getByTestId("relay-confirm-targets").querySelectorAll("li")).toHaveLength(6);
      });
    });

    it("keeps a declined note, marked automatic when the chat moved on", () => {
      setup(
        toolMessage({
          type: "tool-delete_request",
          toolCallId: "d1",
          state: "output-available",
          input: { ids: ["r1"] },
          output: { ok: false, error: "user declined", autoDeclined: true },
        }),
      );
      expect(screen.getByTestId("relay-confirm-declined")).toHaveAttribute("data-automatic", "true");
      expect(screen.queryByTestId("relay-confirm-card")).toBeNull();
    });
  });
});

describe("RelayConversation jump-to-latest pill", () => {
  it("is hidden while the thread is at the bottom", () => {
    setup([msg("u1", "user", "hi")]);
    expect(screen.queryByTestId("relay-jump-latest")).toBeNull();
  });

  it("is opaque, bordered, shadowed and above messages, and keeps its accessible name", () => {
    scrollState.isAtBottom = false;
    setup([msg("u1", "user", "hi")]);
    const pill = screen.getByTestId("relay-jump-latest");
    expect(pill).toHaveAccessibleName("jumpToLatest");
    for (const cls of ["z-20", "bg-popover", "border-border", "shadow-lg"]) {
      expect(pill).toHaveClass(cls);
    }
  });

  it("scrolls to the latest message when clicked", () => {
    scrollState.isAtBottom = false;
    setup([msg("u1", "user", "hi")]);
    fireEvent.click(screen.getByTestId("relay-jump-latest"));
    expect(scrollState.scrollToBottom).toHaveBeenCalledTimes(1);
  });

  it("reserves a bottom gutter so the last message is not covered", () => {
    setup([msg("u1", "user", "hi")]);
    const content = screen.getByTestId("relay-messages").querySelector(".pb-14");
    expect(content).not.toBeNull();
    expect(content).toHaveTextContent("hi");
  });
});

describe("RelayConversation announcements", () => {
  it("announces that Relay is typing only while a reply is in flight", () => {
    const messages = [msg("u1", "user", "q")];
    const { rerender } = setup(messages, "submitted");
    const announcer = screen.getByTestId("relay-announcer");
    expect(announcer).toHaveAttribute("role", "status");
    expect(announcer).toHaveTextContent("typing");
    rerender(
      <RelayConversation
        messages={messages}
        status="ready"
        interruptedMessageId={null}
        onRegenerate={() => {}}
        onResolveTool={vi.fn()}
        aria-label="x"
      />,
    );
    expect(screen.getByTestId("relay-announcer")).toHaveTextContent("");
  });
});

describe("RelayConversation step indicator", () => {
  const turn = (steps: number): UIMessage[] => [
    msg("u1", "user", "q"),
    {
      id: "a1",
      role: "assistant",
      parts: Array.from({ length: steps }, () => ({ type: "step-start" as const })),
    },
  ];

  it("stays hidden up to step 6", () => {
    setup(turn(6), "streaming");
    expect(screen.queryByTestId("relay-step-indicator")).toBeNull();
  });

  it("appears from step 7 and never exceeds the step cap", () => {
    const { rerender } = setup(turn(7), "streaming");
    expect(screen.getByTestId("relay-step-indicator")).toHaveTextContent("step");
    rerender(
      <RelayConversation
        messages={turn(40)}
        status="streaming"
        interruptedMessageId={null}
        onRegenerate={() => {}}
        onResolveTool={vi.fn()}
        aria-label="x"
      />,
    );
    expect(screen.getByTestId("relay-step-indicator")).toBeInTheDocument();
  });

  it("counts only the current turn", () => {
    setup([...turn(9), msg("u2", "user", "next")], "ready");
    expect(screen.queryByTestId("relay-step-indicator")).toBeNull();
  });
});

describe("RelayConversation long threads", () => {
  const PERF_BUDGET_MS = 200;
  const longThread = (count: number): UIMessage[] =>
    Array.from({ length: count }, (_, index) =>
      msg(`m${index}`, index % 2 === 0 ? "user" : "assistant", `message ${index}`),
    );

  it("renders a short thread in full with no virtual container", () => {
    setup(longThread(RELAY_VIRTUALIZE_THRESHOLD));
    expect(screen.queryByTestId("relay-virtual-messages")).toBeNull();
    expect(screen.getAllByTestId(/^relay-message-/)).toHaveLength(RELAY_VIRTUALIZE_THRESHOLD);
  });

  it("windows a 200-message thread and opens it inside the budget", () => {
    const messages = longThread(200);
    const started = performance.now();
    setup(messages);
    const elapsed = performance.now() - started;
    expect(screen.getByTestId("relay-virtual-messages")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^relay-message-/).length).toBeLessThanOrEqual(VIRTUAL_WINDOW);
    expect(elapsed).toBeLessThan(PERF_BUDGET_MS);
  });
});
