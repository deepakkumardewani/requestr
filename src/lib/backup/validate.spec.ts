import { describe, expect, it } from "vitest";
import { BACKUP_SCHEMA_VERSION, BACKUP_SIZE_WARN_BYTES } from "./constants";
import { validateBackup } from "./validate";

type Data = Record<string, unknown>;

function file(overrides: Record<string, unknown> = {}, data: Data = {}) {
  return {
    app: "requestr-backup",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    idbVersion: 3,
    exportedAt: "2026-01-02T03:04:05.000Z",
    appVersion: "1.0.0",
    includesSecrets: false,
    sections: ["environments"],
    data: { environments: [{ id: "e1" }], ...data },
    ...overrides,
  };
}

const run = (value: unknown, size?: number) =>
  validateBackup(
    typeof value === "string" ? value : JSON.stringify(value),
    size
  );

describe("validateBackup", () => {
  it("accepts a well-formed file with no warnings", () => {
    const result = run(file());

    expect(result).toMatchObject({ ok: true, warnings: [] });
    expect(result.ok && result.envelope.sections).toEqual(["environments"]);
  });

  it("accepts settings and preferences sections", () => {
    const result = run(
      file(
        { sections: ["settings", "preferences"] },
        {
          environments: undefined,
          settings: { theme: "dark" },
          preferences: { a: "b" },
        }
      )
    );

    expect(result.ok).toBe(true);
  });

  it("accepts a multi-store section whose records all carry keys", () => {
    const result = run(
      file(
        { sections: ["collections"] },
        {
          environments: undefined,
          collections: [{ id: "c" }],
          folders: [],
          requests: [{ id: "r" }],
          chainConfigs: [{ collectionId: "c" }],
        }
      )
    );

    expect(result.ok).toBe(true);
  });

  it("rejects text that is not JSON", () => {
    expect(run("{nope")).toEqual({ ok: false, error: { code: "invalidJson" } });
  });

  it.each([["null"], ["[]"], ["42"]])(
    "rejects non-object JSON %s as a foreign file",
    (text) => {
      expect(run(text)).toEqual({ ok: false, error: { code: "foreignFile" } });
    }
  );

  it("rejects an object from another app as a foreign file", () => {
    expect(run({ info: { name: "Postman" }, item: [] })).toEqual({
      ok: false,
      error: { code: "foreignFile" },
    });
  });

  it.each([["1"], [1.5], [undefined]])(
    "rejects schemaVersion %s as an invalid file",
    (version) => {
      expect(run(file({ schemaVersion: version }))).toEqual({
        ok: false,
        error: { code: "invalidFile" },
      });
    }
  );

  it("reports a newer version with its number", () => {
    expect(run(file({ schemaVersion: BACKUP_SCHEMA_VERSION + 4 }))).toEqual({
      ok: false,
      error: { code: "newerVersion", schemaVersion: BACKUP_SCHEMA_VERSION + 4 },
    });
  });

  it("reports an older version with no migration as unsupported", () => {
    expect(run(file({ schemaVersion: 0 }))).toEqual({
      ok: false,
      error: { code: "unsupportedVersion" },
    });
  });

  it("rejects an envelope missing required fields as invalid", () => {
    const broken = file();
    delete (broken as Record<string, unknown>).exportedAt;

    expect(run(broken)).toEqual({ ok: false, error: { code: "invalidFile" } });
  });

  it("flags the section when a data list has the wrong shape", () => {
    expect(run(file({}, { environments: "oops" }))).toEqual({
      ok: false,
      error: { code: "damagedSection", section: "environments" },
    });
  });

  it("flags the section when a listed section's data is missing", () => {
    expect(run(file({}, { environments: undefined }))).toEqual({
      ok: false,
      error: { code: "damagedSection", section: "environments" },
    });
  });

  it("flags a section when only some of its stores are present", () => {
    const result = run(
      file(
        { sections: ["collections"] },
        { environments: undefined, collections: [] }
      )
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "damagedSection", section: "collections" },
    });
  });

  it("flags the section owning data that is not listed in sections", () => {
    const result = run(file({}, { chains: [{ id: "c" }] }));

    expect(result).toEqual({
      ok: false,
      error: { code: "damagedSection", section: "chains" },
    });
  });

  it("ignores a data key no section owns, since the envelope schema strips it", () => {
    const envelope = file();
    (envelope.data as Data).unknownStore = [];
    expect(run(envelope).ok).toBe(true);
  });

  it("flags a section whose record lacks its key field", () => {
    expect(run(file({}, { environments: [{ name: "no id" }] }))).toEqual({
      ok: false,
      error: { code: "damagedSection", section: "environments" },
    });
  });

  it("flags a record whose key is empty or non-string", () => {
    expect(run(file({}, { environments: [{ id: "" }] })).ok).toBe(false);
    expect(run(file({}, { environments: [{ id: 5 }] })).ok).toBe(false);
    expect(run(file({}, { environments: [null] })).ok).toBe(false);
  });

  it("uses collectionId as the key for chainConfigs", () => {
    const result = run(
      file(
        { sections: ["collections"] },
        {
          environments: undefined,
          collections: [],
          folders: [],
          requests: [],
          chainConfigs: [{ id: "x" }],
        }
      )
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "damagedSection", section: "collections" },
    });
  });

  it("points a settings type error at the settings section", () => {
    const result = run(
      file(
        { sections: ["settings"] },
        { environments: undefined, settings: [] }
      )
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "damagedSection", section: "settings" },
    });
  });

  it("warns about a large file but still validates it", () => {
    const result = run(file(), BACKUP_SIZE_WARN_BYTES + 1);

    expect(result).toMatchObject({ ok: true, warnings: ["largeFile"] });
  });

  it("does not warn at exactly the threshold", () => {
    expect(run(file(), BACKUP_SIZE_WARN_BYTES)).toMatchObject({
      ok: true,
      warnings: [],
    });
  });

  it("defaults the size to the text length", () => {
    expect(validateBackup(JSON.stringify(file()))).toMatchObject({
      ok: true,
      warnings: [],
    });
  });
});
