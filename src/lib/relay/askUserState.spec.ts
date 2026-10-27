import { describe, expect, it } from "vitest";
import {
  ASK_IDLE,
  type AskState,
  askStateFromPart,
  canSend,
  pendingAnswer,
  reduceAsk,
} from "./askUserState";

describe("reduceAsk", () => {
  it("select moves idle to selected and replaces an earlier selection", () => {
    const first = reduceAsk(ASK_IDLE, { type: "select", option: "Dev" });
    expect(first).toEqual({ phase: "selected", option: "Dev" });
    expect(reduceAsk(first, { type: "select", option: "Prod" })).toEqual({
      phase: "selected",
      option: "Prod",
    });
  });

  it("typing replaces a selection and clearing the text returns to idle", () => {
    const selected: AskState = { phase: "selected", option: "Dev" };
    const typed = reduceAsk(selected, { type: "type", text: "Staging" });
    expect(typed).toEqual({ phase: "typed", text: "Staging" });
    expect(reduceAsk(typed, { type: "type", text: "" })).toEqual({
      phase: "idle",
    });
  });

  it("selecting after typing replaces the typed text", () => {
    const typed: AskState = { phase: "typed", text: "Staging" };
    expect(reduceAsk(typed, { type: "select", option: "Dev" })).toEqual({
      phase: "selected",
      option: "Dev",
    });
  });

  it("send delivers the selected option", () => {
    expect(
      reduceAsk({ phase: "selected", option: "Prod" }, { type: "send" }),
    ).toEqual({ phase: "sent", answer: "Prod" });
  });

  it("send delivers trimmed typed text", () => {
    expect(
      reduceAsk({ phase: "typed", text: "  Staging  " }, { type: "send" }),
    ).toEqual({ phase: "sent", answer: "Staging" });
  });

  it("send with nothing sendable keeps the same state", () => {
    const blank: AskState = { phase: "typed", text: "   " };
    expect(reduceAsk(blank, { type: "send" })).toBe(blank);
    expect(reduceAsk(ASK_IDLE, { type: "send" })).toBe(ASK_IDLE);
  });

  it("a composer answer closes an open card with that text", () => {
    expect(
      reduceAsk(ASK_IDLE, { type: "composerAnswer", text: "the third one" }),
    ).toEqual({ phase: "answeredViaComposer", answer: "the third one" });
  });

  it("skip closes an open card", () => {
    expect(
      reduceAsk({ phase: "selected", option: "Dev" }, { type: "skip" }),
    ).toEqual({ phase: "skipped" });
  });

  it("ignores every event once the card is settled", () => {
    const settled: AskState[] = [
      { phase: "sent", answer: "Dev" },
      { phase: "answeredViaComposer", answer: "x" },
      { phase: "skipped" },
    ];
    for (const state of settled) {
      expect(reduceAsk(state, { type: "select", option: "Prod" })).toBe(state);
      expect(reduceAsk(state, { type: "type", text: "y" })).toBe(state);
      expect(reduceAsk(state, { type: "send" })).toBe(state);
      expect(reduceAsk(state, { type: "composerAnswer", text: "z" })).toBe(
        state,
      );
      expect(reduceAsk(state, { type: "skip" })).toBe(state);
    }
  });
});

describe("pendingAnswer and canSend", () => {
  it("returns the option, the trimmed text, or null", () => {
    expect(pendingAnswer({ phase: "selected", option: "Dev" })).toBe("Dev");
    expect(pendingAnswer({ phase: "typed", text: " hi " })).toBe("hi");
    expect(pendingAnswer({ phase: "typed", text: "  " })).toBeNull();
    expect(pendingAnswer(ASK_IDLE)).toBeNull();
    expect(pendingAnswer({ phase: "sent", answer: "Dev" })).toBeNull();
  });

  it("Send is allowed only with a selection or non-blank text", () => {
    expect(canSend({ phase: "selected", option: "Dev" })).toBe(true);
    expect(canSend({ phase: "typed", text: "hi" })).toBe(true);
    expect(canSend({ phase: "typed", text: " " })).toBe(false);
    expect(canSend(ASK_IDLE)).toBe(false);
    expect(canSend({ phase: "skipped" })).toBe(false);
  });
});

describe("askStateFromPart", () => {
  it("is idle while the part is pending, whatever the output", () => {
    expect(askStateFromPart(true, undefined)).toEqual({ phase: "idle" });
    expect(
      askStateFromPart(true, { data: { choice: "Dev" } }),
    ).toEqual({ phase: "idle" });
  });

  it("shows a chosen value as sent", () => {
    expect(
      askStateFromPart(false, { ok: true, data: { choice: "Dev" } }),
    ).toEqual({ phase: "sent", answer: "Dev" });
  });

  it("shows a composer-delivered value as answeredViaComposer", () => {
    expect(
      askStateFromPart(false, {
        ok: true,
        data: { choice: "third", viaComposer: true },
      }),
    ).toEqual({ phase: "answeredViaComposer", answer: "third" });
  });

  it("treats a missing, declined or non-string result as skipped", () => {
    expect(askStateFromPart(false, undefined)).toEqual({ phase: "skipped" });
    expect(askStateFromPart(false, null)).toEqual({ phase: "skipped" });
    expect(askStateFromPart(false, { autoDeclined: true })).toEqual({
      phase: "skipped",
    });
    expect(askStateFromPart(false, { data: { choice: 3 } })).toEqual({
      phase: "skipped",
    });
  });
});
