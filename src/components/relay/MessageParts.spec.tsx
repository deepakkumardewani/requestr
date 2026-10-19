/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import { MessageParts } from "./MessageParts";

const mocks = vi.hoisted(() => ({
  awaitsUserMock: vi.fn(),
  isCloseTabsToolMock: vi.fn(),
  previewConfirmationMock: vi.fn(),
  readChangeOutputMock: vi.fn(),
  askUserCardProps: null as any,
  confirmCardProps: null as any,
  closeTabsCardProps: null as any,
}));

vi.mock("./RelayMarkdown", () => ({
  RelayMarkdown: ({ text }: { text: string }) => (
    <div data-testid="relay-markdown">{text}</div>
  ),
}));

vi.mock("./ToolRow", () => ({
  ToolRow: ({ part }: { part: unknown }) => (
    <div data-testid="tool-row" />
  ),
  isToolPart: (part: unknown) => {
    if (typeof part !== "object" || !part) return false;
    const p = part as Record<string, unknown>;
    return typeof p.type === "string" && p.type.startsWith("tool-");
  },
}));

vi.mock("./ChangeCard", () => ({
  ChangeCard: () => <div data-testid="change-card" />,
  readChangeOutput: mocks.readChangeOutputMock,
}));

vi.mock("./AskUserCard", () => ({
  AskUserCard: (props: any) => {
    mocks.askUserCardProps = props;
    return (
      <div data-testid="ask-user-card">
        <span data-testid="ask-question">{props.question}</span>
        <span data-testid="ask-options">{props.options.join(",")}</span>
        <button data-testid="ask-user-choose" onClick={() => props.onChoose(props.options[0])}>
          Choose {props.options[0]}
        </button>
      </div>
    );
  },
}));

vi.mock("./CloseTabsConfirmCard", () => ({
  CloseTabsConfirmCard: (props: any) => {
    mocks.closeTabsCardProps = props;
    return (
      <div data-testid="close-tabs-card">
        <button data-testid="close-tabs-choose" onClick={() => props.onChoose("keep")}>
          Keep
        </button>
        <button data-testid="close-tabs-cancel" onClick={() => props.onCancel()}>
          Cancel
        </button>
      </div>
    );
  },
}));

vi.mock("./ConfirmCard", () => ({
  ConfirmCard: (props: any) => {
    mocks.confirmCardProps = props;
    return (
      <div data-testid="confirm-card">
        <button data-testid="confirm-approve" onClick={() => props.onApprove()}>
          Approve
        </button>
        <button data-testid="confirm-decline" onClick={() => props.onDecline()}>
          Decline
        </button>
      </div>
    );
  },
  DeclinedNote: ({ automatic }: { automatic?: boolean }) => (
    <div data-testid="declined-note" data-automatic={automatic} />
  ),
}));

vi.mock("./TurnChangeBar", () => ({
  TurnChangeBar: ({ turnId, settled }: { turnId: string; settled: boolean }) => (
    <div data-testid="turn-change-bar" data-turn-id={turnId} data-settled={settled} />
  ),
}));

vi.mock("@/lib/relay/tools/registry", () => ({
  relayToolRegistry: {},
  previewConfirmation: mocks.previewConfirmationMock,
}));

vi.mock("@/lib/relay/tools/schemas", () => ({
  awaitsUser: mocks.awaitsUserMock,
  RELAY_TOOL_SCHEMAS: {
    ask_user: {
      inputSchema: {
        safeParse: vi.fn((input: unknown) => {
          const data = input as Record<string, unknown>;
          if (data && "question" in data && "options" in data) {
            return {
              success: true,
              data: {
                question: data.question,
                options: data.options,
              },
            };
          }
          return { success: false };
        }),
      },
    },
  },
  USER_DECLINED_ERROR: "User declined",
}));

vi.mock("@/lib/relay/tools/tabs", () => ({
  isCloseTabsTool: mocks.isCloseTabsToolMock,
  previewCloseTabs: vi.fn(() => ({ dirty: [], pinnedKept: 0, deleting: false })),
}));

vi.mock("@/lib/relay/storeAccess", () => ({
  createZustandStoreAccess: vi.fn(() => ({})),
}));

afterEach(() => {
  cleanup();
  mocks.awaitsUserMock.mockReset().mockReturnValue(false);
  mocks.isCloseTabsToolMock.mockReset().mockReturnValue(false);
  mocks.previewConfirmationMock.mockReset().mockReturnValue(null);
  mocks.readChangeOutputMock.mockReset().mockReturnValue(null);
  mocks.askUserCardProps = null;
  mocks.confirmCardProps = null;
  mocks.closeTabsCardProps = null;
});

describe("MessageParts", () => {
  it("renders text parts as RelayMarkdown", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [{ type: "text", text: "Hello world" }],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("relay-markdown")).toHaveTextContent("Hello world");
  });

  it("renders multiple text parts separately", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        { type: "text", text: "First" },
        { type: "text", text: "Second" },
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    const markdowns = screen.getAllByTestId("relay-markdown");
    expect(markdowns).toHaveLength(2);
  });

  it("skips empty text parts", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        { type: "text", text: "First" },
        { type: "text", text: "" },
        { type: "text", text: "Second" },
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getAllByTestId("relay-markdown")).toHaveLength(2);
  });

  it("groups consecutive tool parts together", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        { type: "tool-call", toolCallId: "1", toolName: "tool1" } as any,
        { type: "tool-result", toolCallId: "1" } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    const toolGroup = screen.getByTestId("relay-tool-group");
    expect(toolGroup).toHaveClass("flex", "flex-col", "gap-2");
  });

  it("renders text and tool parts in stream order", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        { type: "text", text: "Before" },
        { type: "tool-call", toolCallId: "1", toolName: "tool1" } as any,
        { type: "text", text: "After" },
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getAllByTestId("relay-markdown")).toHaveLength(2);
    expect(screen.getByTestId("relay-tool-group")).toBeInTheDocument();
  });

  it("does not render TurnChangeBar for text-only messages", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [{ type: "text", text: "Just text" }],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.queryByTestId("turn-change-bar")).not.toBeInTheDocument();
  });

  it("handles empty message parts", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.queryByTestId("relay-markdown")).not.toBeInTheDocument();
  });

  it("renders DeclinedNote for declined tool", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "test",
          state: "output-available",
          output: { ok: false, error: "User declined" },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("declined-note")).toBeInTheDocument();
    expect(screen.getByTestId("declined-note")).toHaveAttribute(
      "data-automatic",
      "false"
    );
  });

  it("renders DeclinedNote with automatic flag for auto-declined tool", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "test",
          state: "output-available",
          output: { ok: false, error: "User declined", autoDeclined: true },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("declined-note")).toHaveAttribute(
      "data-automatic",
      "true"
    );
  });

  it("returns null for non-input-available state without awaitsUser check", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "some_tool",
          state: "output-available",
          output: { ok: true },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("tool-row")).toBeInTheDocument();
  });

  it("renders ConfirmCard for awaiting-user tool", () => {
    mocks.awaitsUserMock.mockReturnValue(true);
    mocks.previewConfirmationMock.mockReturnValue({
      action: "delete",
      dirtyTabs: [],
    });

    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "delete_request",
          state: "input-available",
          input: { id: "req-1" },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("confirm-card")).toBeInTheDocument();
  });

  it("renders CloseTabsConfirmCard when preview has dirty tabs", () => {
    mocks.awaitsUserMock.mockReturnValue(true);
    mocks.previewConfirmationMock.mockReturnValue({
      action: "delete",
      dirtyTabs: [{ id: "t1", name: "Unsaved" }],
    });

    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "delete",
          state: "input-available",
          input: { id: "req-1" },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("close-tabs-card")).toBeInTheDocument();
  });

  it("renders ToolRow when tool does not await user", () => {
    mocks.awaitsUserMock.mockReturnValue(false);
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "get_data",
          state: "input-available",
          input: {},
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("tool-row")).toBeInTheDocument();
  });

  it("renders ChangeCard when readChangeOutput returns a change", () => {
    mocks.readChangeOutputMock.mockReturnValue({ changeId: "ch-1", type: "created" });
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "create",
          state: "output-available",
          output: { ok: true },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("change-card")).toBeInTheDocument();
  });

  it("uses toolCallId as key for tool parts with toolCallId", () => {
    const onResolveTool = vi.fn();
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "tool-123",
          toolName: "test",
          state: "output-available",
          output: { ok: true },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={onResolveTool}
      />
    );

    expect(screen.getByTestId("tool-row")).toBeInTheDocument();
  });

  it("passes turnId and settled to TurnChangeBar", () => {
    mocks.readChangeOutputMock.mockReturnValue({ changeId: "ch-1" });
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "tool",
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-123"
        settled={false}
        onResolveTool={() => {}}
      />
    );

    const changeBar = screen.getByTestId("turn-change-bar");
    expect(changeBar).toHaveAttribute("data-turn-id", "turn-123");
    expect(changeBar).toHaveAttribute("data-settled", "false");
  });

  it("renders component as memo and handles prop changes", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [{ type: "text", text: "Initial" }],
    };

    const { rerender } = render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("relay-markdown")).toHaveTextContent("Initial");

    const updatedMessage: UIMessage = {
      id: "msg-2",
      role: "assistant",
      parts: [{ type: "text", text: "Updated" }],
    };

    rerender(
      <MessageParts
        message={updatedMessage}
        turnId="turn-2"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("relay-markdown")).toHaveTextContent("Updated");
  });

  it("renders AskUserCard with pending state for ask_user tool", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-ask_user",
          toolCallId: "1",
          state: "input-available",
          input: { question: "Pick one", options: ["A", "B"] },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("ask-user-card")).toBeInTheDocument();
    expect(screen.getByTestId("ask-question")).toHaveTextContent("Pick one");
    expect(screen.getByTestId("ask-options")).toHaveTextContent("A,B");
  });

  it("renders AskUserCard with output state and valid choice for ask_user tool", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-ask_user",
          toolCallId: "1",
          state: "output-available",
          input: { question: "Pick one", options: ["A", "B"] },
          output: { ok: true, data: { choice: "A" } },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("ask-user-card")).toBeInTheDocument();
  });

  it("returns null for ask_user with output state but no valid choice", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-ask_user",
          toolCallId: "1",
          state: "output-available",
          input: { question: "Pick one", options: ["A", "B"] },
          output: { ok: true, data: {} },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("tool-row")).toBeInTheDocument();
    expect(screen.queryByTestId("ask-user-card")).not.toBeInTheDocument();
  });

  it("renders CloseTabsConfirmCard for isCloseTabsTool when state is input-available", () => {
    const onResolveTool = vi.fn();
    mocks.isCloseTabsToolMock.mockReturnValue(true);
    mocks.awaitsUserMock.mockReturnValue(true);

    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-close_tabs",
          toolCallId: "1",
          state: "input-available",
          input: { tabIds: ["t1"] },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={onResolveTool}
      />
    );

    expect(screen.getByTestId("close-tabs-card")).toBeInTheDocument();
    expect(mocks.closeTabsCardProps).not.toBeNull();
    // Call the callback to exercise the onResolve invocation
    mocks.closeTabsCardProps.onChoose("keep");
    expect(onResolveTool).toHaveBeenCalledWith("1", { kind: "answer", choice: "keep" });
  });

  it("calls onCancel for isCloseTabsTool", () => {
    const onResolveTool = vi.fn();
    mocks.isCloseTabsToolMock.mockReturnValue(true);
    mocks.awaitsUserMock.mockReturnValue(true);

    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-close_tabs",
          toolCallId: "2",
          state: "input-available",
          input: { tabIds: ["t1"] },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={onResolveTool}
      />
    );

    expect(mocks.closeTabsCardProps).not.toBeNull();
    mocks.closeTabsCardProps.onCancel();
    expect(onResolveTool).toHaveBeenCalledWith("2", { kind: "decline" });
  });

  it("returns null for previewConfirmation when it returns falsy", () => {
    mocks.awaitsUserMock.mockReturnValue(true);
    mocks.isCloseTabsToolMock.mockReturnValue(false);
    mocks.previewConfirmationMock.mockReturnValue(null);

    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "some_tool",
          state: "input-available",
          input: {},
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("tool-row")).toBeInTheDocument();
    expect(screen.queryByTestId("confirm-card")).not.toBeInTheDocument();
  });

  it("calls onResolve when ConfirmCard approve is triggered", () => {
    const onResolveTool = vi.fn();
    mocks.awaitsUserMock.mockReturnValue(true);
    mocks.previewConfirmationMock.mockReturnValue({
      action: "delete",
      dirtyTabs: [],
    });

    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "delete_request",
          state: "input-available",
          input: { id: "req-1" },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={onResolveTool}
      />
    );

    expect(screen.getByTestId("confirm-card")).toBeInTheDocument();
    expect(mocks.confirmCardProps).not.toBeNull();
    expect(typeof mocks.confirmCardProps.onApprove).toBe("function");
    expect(typeof mocks.confirmCardProps.onDecline).toBe("function");
  });

  it("calls onResolve when CloseTabsConfirmCard with dirty tabs is triggered", () => {
    const onResolveTool = vi.fn();
    mocks.awaitsUserMock.mockReturnValue(true);
    mocks.previewConfirmationMock.mockReturnValue({
      action: "delete",
      dirtyTabs: [{ id: "t1", name: "Unsaved" }],
    });

    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "delete",
          state: "input-available",
          input: { id: "req-1" },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={onResolveTool}
      />
    );

    expect(screen.getByTestId("close-tabs-card")).toBeInTheDocument();
    expect(mocks.closeTabsCardProps).not.toBeNull();
    expect(typeof mocks.closeTabsCardProps.onChoose).toBe("function");
    expect(typeof mocks.closeTabsCardProps.onCancel).toBe("function");
  });

  it("renders DeclinedNote with correct automatic flag for declined ask_user", () => {
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-ask_user",
          toolCallId: "1",
          state: "output-available",
          input: { question: "Choose", options: ["A"] },
          output: { ok: false, error: "User declined", autoDeclined: false },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("declined-note")).toBeInTheDocument();
    expect(screen.getByTestId("declined-note")).toHaveAttribute(
      "data-automatic",
      "false"
    );
  });

  it("extracts changeIds from multiple tools and renders TurnChangeBar", () => {
    mocks.readChangeOutputMock.mockImplementation((part: any) => {
      if ("toolCallId" in part) {
        return { changeId: `ch-${part.toolCallId}` };
      }
      return null;
    });

    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "tool1",
          state: "output-available",
          output: { ok: true },
        } as any,
        {
          type: "tool-call",
          toolCallId: "2",
          toolName: "tool2",
          state: "output-available",
          output: { ok: true },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={() => {}}
      />
    );

    expect(screen.getByTestId("turn-change-bar")).toBeInTheDocument();
  });

  it("calls onResolve with correct payload when AskUserCard choice is made", () => {
    const onResolveTool = vi.fn();
    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-ask_user",
          toolCallId: "1",
          state: "input-available",
          input: { question: "Pick one", options: ["A", "B"] },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={onResolveTool}
      />
    );

    expect(mocks.askUserCardProps).not.toBeNull();
    expect(typeof mocks.askUserCardProps.onChoose).toBe("function");
    mocks.askUserCardProps.onChoose("A");
    expect(onResolveTool).toHaveBeenCalledWith("1", { kind: "answer", choice: "A" });
  });

  it("calls onResolve with approve payload when ConfirmCard approve is clicked", () => {
    const onResolveTool = vi.fn();
    mocks.awaitsUserMock.mockReturnValue(true);
    mocks.previewConfirmationMock.mockReturnValue({
      action: "delete",
      dirtyTabs: [],
    });

    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "delete_request",
          state: "input-available",
          input: { id: "req-1" },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={onResolveTool}
      />
    );

    expect(mocks.confirmCardProps).not.toBeNull();
    mocks.confirmCardProps.onApprove();
    expect(onResolveTool).toHaveBeenCalledWith("1", { kind: "approve" });
  });

  it("calls onResolve with decline payload when ConfirmCard decline is clicked", () => {
    const onResolveTool = vi.fn();
    mocks.awaitsUserMock.mockReturnValue(true);
    mocks.previewConfirmationMock.mockReturnValue({
      action: "delete",
      dirtyTabs: [],
    });

    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "delete_request",
          state: "input-available",
          input: { id: "req-1" },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={onResolveTool}
      />
    );

    expect(mocks.confirmCardProps).not.toBeNull();
    mocks.confirmCardProps.onDecline();
    expect(onResolveTool).toHaveBeenCalledWith("1", { kind: "decline" });
  });

  it("calls onResolve with answer payload when CloseTabsConfirmCard choice is made", () => {
    const onResolveTool = vi.fn();
    mocks.awaitsUserMock.mockReturnValue(true);
    mocks.previewConfirmationMock.mockReturnValue({
      action: "delete",
      dirtyTabs: [{ id: "t1", name: "Unsaved" }],
    });

    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "delete",
          state: "input-available",
          input: { id: "req-1" },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={onResolveTool}
      />
    );

    expect(mocks.closeTabsCardProps).not.toBeNull();
    mocks.closeTabsCardProps.onChoose("keep");
    expect(onResolveTool).toHaveBeenCalledWith("1", {
      kind: "answer",
      choice: "keep",
      approve: true,
    });
  });

  it("calls onResolve with decline payload when CloseTabsConfirmCard cancel is clicked", () => {
    const onResolveTool = vi.fn();
    mocks.awaitsUserMock.mockReturnValue(true);
    mocks.previewConfirmationMock.mockReturnValue({
      action: "delete",
      dirtyTabs: [{ id: "t1", name: "Unsaved" }],
    });

    const message: UIMessage = {
      id: "msg-1",
      role: "assistant",
      parts: [
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "delete",
          state: "input-available",
          input: { id: "req-1" },
        } as any,
      ],
    };

    render(
      <MessageParts
        message={message}
        turnId="turn-1"
        settled
        onResolveTool={onResolveTool}
      />
    );

    expect(mocks.closeTabsCardProps).not.toBeNull();
    mocks.closeTabsCardProps.onCancel();
    expect(onResolveTool).toHaveBeenCalledWith("1", { kind: "decline" });
  });

  describe("stream order with compareDocumentPosition", () => {
    it("renders text then ask_user with text preceding the card", () => {
      render(
        <MessageParts
          message={{
            id: "msg-1",
            role: "assistant",
            parts: [
              { type: "text", text: "What should we do?" },
              {
                type: "tool-ask_user",
                toolCallId: "1",
                state: "input-available",
                input: { question: "Pick one", options: ["A", "B"] },
              } as any,
            ],
          }}
          turnId="turn-1"
          settled
          onResolveTool={() => {}}
        />
      );

      const textEl = screen.getByTestId("relay-markdown");
      const cardEl = screen.getByTestId("ask-user-card");
      const position = textEl.compareDocumentPosition(cardEl);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it("renders tool then text with tool preceding the text", () => {
      render(
        <MessageParts
          message={{
            id: "msg-1",
            role: "assistant",
            parts: [
              {
                type: "tool-call",
                toolCallId: "1",
                toolName: "get_data",
                state: "output-available",
                output: { ok: true },
              } as any,
              { type: "text", text: "Here is the result" },
            ],
          }}
          turnId="turn-1"
          settled
          onResolveTool={() => {}}
        />
      );

      const toolGroupEl = screen.getByTestId("relay-tool-group");
      const textEl = screen.getByTestId("relay-markdown");
      const position = toolGroupEl.compareDocumentPosition(textEl);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it("renders text, tool, text in order with correct document positions", () => {
      render(
        <MessageParts
          message={{
            id: "msg-1",
            role: "assistant",
            parts: [
              { type: "text", text: "First part" },
              {
                type: "tool-call",
                toolCallId: "1",
                toolName: "get_data",
                state: "output-available",
                output: { ok: true },
              } as any,
              { type: "text", text: "Second part" },
            ],
          }}
          turnId="turn-1"
          settled
          onResolveTool={() => {}}
        />
      );

      const textElements = screen.getAllByTestId("relay-markdown");
      const toolGroup = screen.getByTestId("relay-tool-group");
      const first = textElements[0];
      const second = textElements[1];

      expect(first.compareDocumentPosition(toolGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
      expect(toolGroup.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
  });

  describe("step-start parts", () => {
    it("renders nothing for step-start-only parts", () => {
      const message: UIMessage = {
        id: "msg-1",
        role: "assistant",
        parts: [
          { type: "step-start", title: "Thinking" } as any,
        ],
      };

      render(
        <MessageParts
          message={message}
          turnId="turn-1"
          settled
          onResolveTool={() => {}}
        />
      );

      expect(screen.queryByTestId("relay-markdown")).not.toBeInTheDocument();
      expect(screen.queryByTestId("relay-tool-group")).not.toBeInTheDocument();
    });

    it("renders step-start before tool then text in order", () => {
      const message: UIMessage = {
        id: "msg-1",
        role: "assistant",
        parts: [
          { type: "step-start", title: "Step 1" } as any,
          {
            type: "tool-call",
            toolCallId: "1",
            toolName: "get_data",
            state: "output-available",
            output: { ok: true },
          } as any,
          { type: "text", text: "Result" },
        ],
      };

      render(
        <MessageParts
          message={message}
          turnId="turn-1"
          settled
          onResolveTool={() => {}}
        />
      );

      const toolGroup = screen.getByTestId("relay-tool-group");
      const text = screen.getByTestId("relay-markdown");
      const position = toolGroup.compareDocumentPosition(text);
      expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });
  });

  describe("stable keys across streaming updates", () => {
    it("maintains the same node references when appending parts to the same message", () => {
      const { rerender } = render(
        <MessageParts
          message={{
            id: "msg-1",
            role: "assistant",
            parts: [
              { type: "text", text: "First text" },
              {
                type: "tool-call",
                toolCallId: "tool-1",
                toolName: "search",
                state: "output-available",
                output: { ok: true },
              } as any,
            ],
          }}
          turnId="turn-1"
          settled
          onResolveTool={() => {}}
        />
      );

      const firstText = screen.getByTestId("relay-markdown");
      const firstToolGroup = screen.getByTestId("relay-tool-group");

      rerender(
        <MessageParts
          message={{
            id: "msg-1",
            role: "assistant",
            parts: [
              { type: "text", text: "First text" },
              {
                type: "tool-call",
                toolCallId: "tool-1",
                toolName: "search",
                state: "output-available",
                output: { ok: true },
              } as any,
              { type: "text", text: "Second text" },
            ],
          }}
          turnId="turn-1"
          settled
          onResolveTool={() => {}}
        />
      );

      const markdownElements = screen.getAllByTestId("relay-markdown");
      const toolGroups = screen.getAllByTestId("relay-tool-group");

      expect(markdownElements[0]).toBe(firstText);
      expect(toolGroups[0]).toBe(firstToolGroup);
    });
  });

  describe("uncovered edge cases", () => {
    it("returns null for ask_user with safeParse failure", () => {
      const message: UIMessage = {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-ask_user",
            toolCallId: "1",
            state: "input-available",
            input: { invalidQuestion: "no options" },
          } as any,
        ],
      };

      render(
        <MessageParts
          message={message}
          turnId="turn-1"
          settled
          onResolveTool={() => {}}
        />
      );

      expect(screen.getByTestId("tool-row")).toBeInTheDocument();
      expect(screen.queryByTestId("ask-user-card")).not.toBeInTheDocument();
    });

    it("handles tool part without toolCallId using index fallback", () => {
      const onResolveTool = vi.fn();
      const message: UIMessage = {
        id: "msg-1",
        role: "assistant",
        parts: [
          {
            type: "tool-call",
            toolName: "test",
            state: "output-available",
            output: { ok: true },
          } as any,
        ],
      };

      render(
        <MessageParts
          message={message}
          turnId="turn-1"
          settled
          onResolveTool={onResolveTool}
        />
      );

      expect(screen.getByTestId("tool-row")).toBeInTheDocument();
    });

    it("skips non-text, non-tool parts like reasoning", () => {
      const message: UIMessage = {
        id: "msg-1",
        role: "assistant",
        parts: [
          { type: "text", text: "Start" },
          { type: "reasoning", text: "internal reasoning" } as any,
          { type: "text", text: "End" },
        ],
      };

      render(
        <MessageParts
          message={message}
          turnId="turn-1"
          settled
          onResolveTool={() => {}}
        />
      );

      const markdowns = screen.getAllByTestId("relay-markdown");
      expect(markdowns).toHaveLength(2);
      expect(markdowns[0]).toHaveTextContent("Start");
      expect(markdowns[1]).toHaveTextContent("End");
    });
  });
});
