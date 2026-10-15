import { describe, expect, it } from "vitest";
import {
  filterSlashCommands,
  findSlashQuery,
  needsClearConfirm,
  SLASH_COMMANDS,
} from "./slashCommands";

const byId = (id: string) => {
  const command = SLASH_COMMANDS.find((c) => c.id === id);
  if (!command) throw new Error(`missing ${id}`);
  return command;
};

describe("SLASH_COMMANDS", () => {
  it("[success] defines the five commands in menu order", () => {
    expect(SLASH_COMMANDS.map((c) => c.name)).toEqual(["/explain", "/assert", "/curl", "/docs", "/clear"]);
  });

  it("[success] maps commands to their tools", () => {
    expect(byId("assert").tool).toBe("generate_tests");
    expect(byId("curl").tool).toBe("export_curl");
    expect(byId("docs").tool).toBe("generate_docs");
    expect(byId("explain").tool).toBeUndefined();
    expect(byId("clear").tool).toBeUndefined();
  });

  it("[success] maps prompts and descriptions to message keys", () => {
    expect(byId("assert").promptKey).toBe("slash.assert.prompt");
    expect(byId("curl").promptKey).toBe("slash.curl.prompt");
    expect(byId("docs").promptKey).toBe("slash.docs.prompt");
    expect(byId("explain").promptKey).toBe("slash.explain.prompt");
    expect(byId("clear").promptKey).toBeUndefined();
    expect(byId("clear").descriptionKey).toBe("slash.clear.description");
  });
});

describe("findSlashQuery", () => {
  it("[success] returns an empty query for a lone slash", () => {
    expect(findSlashQuery("/")).toBe("");
  });

  it("[success] returns the lowercased text typed after the slash", () => {
    expect(findSlashQuery("/CuR")).toBe("cur");
  });

  it("[invalid] stays closed when the slash is not at the start", () => {
    expect(findSlashQuery("hello /curl")).toBeNull();
    expect(findSlashQuery(" /curl")).toBeNull();
  });

  it("[invalid] stays closed once a space or newline is typed", () => {
    expect(findSlashQuery("/curl ")).toBeNull();
    expect(findSlashQuery("/curl\nx")).toBeNull();
  });

  it("[success] returns null for empty or plain text", () => {
    expect(findSlashQuery("")).toBeNull();
    expect(findSlashQuery("curl")).toBeNull();
  });
});

describe("filterSlashCommands", () => {
  it("[success] returns every command for an empty query", () => {
    expect(filterSlashCommands("")).toHaveLength(5);
  });

  it("[success] narrows by id prefix", () => {
    expect(filterSlashCommands("c").map((c) => c.id)).toEqual(["curl", "clear"]);
    expect(filterSlashCommands("cu").map((c) => c.id)).toEqual(["curl"]);
  });

  it("[success] returns nothing for an unknown prefix or a mid-word match", () => {
    expect(filterSlashCommands("zzz")).toEqual([]);
    expect(filterSlashCommands("url")).toEqual([]);
  });
});

describe("needsClearConfirm", () => {
  it("[success] confirms /clear only when the thread has messages", () => {
    expect(needsClearConfirm(byId("clear"), true)).toBe(true);
    expect(needsClearConfirm(byId("clear"), false)).toBe(false);
  });

  it("[success] never confirms other commands", () => {
    for (const id of ["explain", "assert", "curl", "docs"]) {
      expect(needsClearConfirm(byId(id), true)).toBe(false);
    }
  });
});
