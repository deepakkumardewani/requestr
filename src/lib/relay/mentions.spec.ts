import { describe, expect, it } from "vitest";
import {
  findActiveMention,
  isMentionMenuAllowed,
  replaceMention,
  stripMentionToken,
} from "./mentions";

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

describe("isMentionMenuAllowed", () => {
  it("[success] allows the menu for plain text and an @ at index 0", () => {
    expect(isMentionMenuAllowed("@pay", 4)).toBe(true);
    expect(isMentionMenuAllowed("see @pay", 8)).toBe(true);
  });

  it("[success] blocks the menu while a slash query is active", () => {
    expect(isMentionMenuAllowed("/ex", 3)).toBe(false);
    expect(isMentionMenuAllowed("/", 1)).toBe(false);
  });

  it("[success] allows the menu once the slash command has a space", () => {
    expect(isMentionMenuAllowed("/explain @pay", 13)).toBe(true);
  });
});

describe("stripMentionToken", () => {
  it("[success] removes the token and its trailing space", () => {
    expect(stripMentionToken("run @Get users now", "Get users")).toBe("run now");
  });

  it("[success] removes a token at the start or the end of the text", () => {
    expect(stripMentionToken("@Prod hi", "Prod")).toBe("hi");
    expect(stripMentionToken("hi @Prod", "Prod")).toBe("hi ");
  });

  it("[success] removes only one of two identical tokens", () => {
    expect(stripMentionToken("@A x @A y", "A")).toBe("x @A y");
  });

  it("[success] is a no-op when the token is absent", () => {
    expect(stripMentionToken("nothing here", "Prod")).toBe("nothing here");
  });

  it("[invalid] ignores a mid-word match and a longer name that shares the prefix", () => {
    expect(stripMentionToken("a@Prod", "Prod")).toBe("a@Prod");
    expect(stripMentionToken("@Production x", "Prod")).toBe("@Production x");
  });

  it("[success] removes a token at the end with no trailing space", () => {
    expect(stripMentionToken("hello @Prod", "Prod")).toBe("hello ");
  });

  it("[success] deduplicates multiple instances by removing the first match only", () => {
    expect(stripMentionToken("x@a @a @a y", "a")).toBe("x@a @a y");
  });

  it("[success] handles consecutive tokens correctly", () => {
    expect(stripMentionToken("@A @B @C", "B")).toBe("@A @C");
  });
});
