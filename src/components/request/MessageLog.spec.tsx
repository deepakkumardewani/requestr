/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WsMessage } from "@/types";
import { MessageLog } from "./MessageLog";

afterEach(cleanup);

describe("MessageLog", () => {
  it("shows empty state when there are no messages", () => {
    render(<MessageLog messages={[]} onClear={vi.fn()} />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("renders sent and received entries with data-direction", () => {
    const messages: WsMessage[] = [
      { id: "1", direction: "sent", data: "ping", timestamp: 1 },
      { id: "2", direction: "received", data: "pong", timestamp: 2 },
    ];

    render(<MessageLog messages={messages} onClear={vi.fn()} />);

    const entries = screen.getAllByTestId("ws-log-entry");
    expect(entries[0]).toHaveAttribute("data-direction", "sent");
    expect(entries[1]).toHaveAttribute("data-direction", "received");
    expect(screen.getByText("ping")).toBeInTheDocument();
    expect(screen.getByText("pong")).toBeInTheDocument();
  });

  it("invokes onClear when Clear is clicked", () => {
    const onClear = vi.fn();
    render(
      <MessageLog
        messages={[{ id: "1", direction: "sent", data: "x", timestamp: 1 }]}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByTestId("message-log-clear-btn"));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
