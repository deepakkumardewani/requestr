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
  it("offers each option and reports the pick once", () => {
    const onChoose = vi.fn();
    render(<AskUserCard question="Which env?" options={["Dev", "Prod"]} onChoose={onChoose} />);
    expect(screen.getAllByTestId("relay-ask-option").map((b) => b.textContent)).toEqual(["Dev", "Prod"]);
    fireEvent.click(screen.getByText("Prod"));
    expect(onChoose).toHaveBeenCalledExactlyOnceWith("Prod");
    expect(screen.queryAllByTestId("relay-ask-option")).toHaveLength(0);
    expect(screen.getByTestId("relay-ask-answer").textContent).toBe("You chose: Prod");
  });

  it("shows an earlier answer read-only", () => {
    const onChoose = vi.fn();
    render(<AskUserCard question="Which env?" options={["Dev", "Prod"]} choice="Dev" onChoose={onChoose} />);
    expect(screen.queryAllByTestId("relay-ask-option")).toHaveLength(0);
    expect(screen.getByTestId("relay-ask-answer").textContent).toContain("Dev");
    expect(onChoose).not.toHaveBeenCalled();
  });
});
