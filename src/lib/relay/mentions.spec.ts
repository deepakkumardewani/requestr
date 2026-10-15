import { describe, expect, it } from "vitest";
import { findActiveMention, replaceMention } from "./mentions";

describe("findActiveMention", () => {
  it("[success] finds an @ at the start of the text", () => {
    expect(findActiveMention("@pay", 4)).toEqual({ start: 0, end: 4, query: "pay" });
  });

  it("[success] finds an @ after whitespace", () => {
    expect(findActiveMention("check @login", 12)).toEqual({ start: 6, end: 12, query: "login" });
  });

  it("[success] returns an empty query right after the @", () => {
    expect(findActiveMention("hi @", 4)).toEqual({ start: 3, end: 4, query: "" });
  });

  it("[success] only reads up to the caret", () => {
    expect(findActiveMention("@payments rest", 4)).toEqual({ start: 0, end: 4, query: "pay" });
  });

  it("[success] finds the mention the caret sits in when several exist", () => {
    expect(findActiveMention("@a @bc", 6)).toEqual({ start: 3, end: 6, query: "bc" });
  });

  it("[invalid] ignores an @ inside an email address", () => {
    expect(findActiveMention("mail me@example.com", 19)).toBeNull();
  });

  it("[success] returns null when whitespace sits between the @ and the caret", () => {
    expect(findActiveMention("@pay now", 8)).toBeNull();
    expect(findActiveMention("@pay\nnow", 8)).toBeNull();
  });

  it("[success] returns null without an @", () => {
    expect(findActiveMention("plain text", 10)).toBeNull();
  });

  it("[success] returns null for empty text or a caret at zero", () => {
    expect(findActiveMention("", 0)).toBeNull();
    expect(findActiveMention("@pay", 0)).toBeNull();
  });

  it("[success] returns null when the caret is right after whitespace", () => {
    expect(findActiveMention("hi ", 3)).toBeNull();
  });
});

describe("replaceMention", () => {
  it("[success] swaps the query for the label and moves the caret past the token", () => {
    const mention = { start: 6, end: 10, query: "log" };
    expect(replaceMention("check @log now", mention, "Login")).toEqual({
      text: "check @Login  now",
      caret: 13,
    });
  });

  it("[success] replaces a mention at the end of the text", () => {
    expect(replaceMention("see @", { start: 4, end: 5, query: "" }, "Prod")).toEqual({
      text: "see @Prod ",
      caret: 10,
    });
  });

  it("[success] round-trips with findActiveMention", () => {
    const mention = findActiveMention("@pa", 3);
    expect(mention).not.toBeNull();
    expect(replaceMention("@pa", mention!, "Payments")).toEqual({ text: "@Payments ", caret: 10 });
  });
});
