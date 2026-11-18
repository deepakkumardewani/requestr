/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

import { AskUserCard } from "./AskUserCard";
import { relayMessages } from "./relayIntlMock";
const en = relayMessages("en");

describe("AskUserCard", () => {
  const options = ["Dev", "Prod"];
  const sendButton = () => screen.getByTestId("relay-ask-send");
  const input = () => screen.getByTestId("relay-ask-input");

  it("offers each option and keeps Send disabled with no selection and no text", () => {
    render(<AskUserCard question="Which env?" options={options} onChoose={vi.fn()} />);
    expect(screen.getAllByTestId("relay-ask-option").map((b) => b.textContent)).toEqual(options);
    expect(sendButton()).toBeDisabled();
  });

  it("answers at once when an option is clicked, no Send needed", () => {
    const onChoose = vi.fn();
    render(<AskUserCard question="Which env?" options={options} onChoose={onChoose} />);
    fireEvent.click(screen.getByText("Prod"));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith("Prod");
    expect(screen.queryAllByTestId("relay-ask-option")).toHaveLength(0);
    expect(screen.getByTestId("relay-ask-answer").textContent).toBe("You chose: Prod");
  });

  it("a double click still answers once", () => {
    const onChoose = vi.fn();
    render(<AskUserCard question="Which env?" options={options} onChoose={onChoose} />);
    const prod = screen.getByText("Prod");
    fireEvent.click(prod);
    fireEvent.click(prod);
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it("stacks options as full-width left-aligned rows that wrap long text", () => {
    render(<AskUserCard question="Which env?" options={options} onChoose={vi.fn()} />);
    const [first] = screen.getAllByTestId("relay-ask-option");
    expect(first.parentElement).toHaveClass("flex-col");
    expect(first).toHaveClass("w-full", "justify-start", "whitespace-normal");
  });

  it("renders Send as an icon-only button named 'Send answer'", () => {
    render(<AskUserCard question="Which env?" options={options} onChoose={vi.fn()} />);
    const send = screen.getByRole("button", { name: "Send answer" });
    expect(send).toBe(sendButton());
    expect(send.querySelector("svg")).not.toBeNull();
    expect(send.textContent).toBe("");
    expect(send).toHaveClass("text-white");
  });

  it("sends typed text with Send and with Enter", () => {
    const onChoose = vi.fn();
    render(<AskUserCard question="Which env?" options={options} onChoose={onChoose} />);
    fireEvent.change(input(), { target: { value: "Staging" } });
    expect(sendButton()).toBeEnabled();
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onChoose).toHaveBeenCalledExactlyOnceWith("Staging");
  });

  it("does not send on Enter while an IME composition is active", () => {
    const onChoose = vi.fn();
    render(<AskUserCard question="Which env?" options={options} onChoose={onChoose} />);
    fireEvent.change(input(), { target: { value: "Staging" } });
    fireEvent.keyDown(input(), { key: "Enter", isComposing: true });
    expect(onChoose).not.toHaveBeenCalled();
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onChoose).toHaveBeenCalledExactlyOnceWith("Staging");
  });

  it("keeps Send disabled for whitespace only", () => {
    render(<AskUserCard question="Which env?" options={options} onChoose={vi.fn()} />);
    fireEvent.change(input(), { target: { value: "   " } });
    expect(sendButton()).toBeDisabled();
  });

  it("shows an earlier answer read-only", () => {
    const onChoose = vi.fn();
    render(
      <AskUserCard
        question="Which env?"
        options={options}
        settled={{ phase: "sent", answer: "Dev" }}
        onChoose={onChoose}
      />,
    );
    expect(screen.queryAllByTestId("relay-ask-option")).toHaveLength(0);
    expect(screen.getByTestId("relay-ask-answer").textContent).toContain("Dev");
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("shows a composer answer as 'Answered: <text>'", () => {
    render(
      <AskUserCard
        question="Which env?"
        options={options}
        settled={{ phase: "answeredViaComposer", answer: "the third one" }}
        onChoose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("relay-ask-answer").textContent).toBe("Answered: the third one");
  });

  it("shows a closed card as the muted skipped line", () => {
    render(
      <AskUserCard question="Which env?" options={options} settled={{ phase: "skipped" }} onChoose={vi.fn()} />,
    );
    expect(screen.getByTestId("relay-confirm-declined")).toBeInTheDocument();
    expect(screen.queryByTestId("relay-ask-send")).toBeNull();
  });
});
