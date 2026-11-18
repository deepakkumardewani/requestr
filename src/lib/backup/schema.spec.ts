import { describe, expect, it } from "vitest";
import { BACKUP_APP_ID } from "./constants";
import { backupEnvelopeSchema } from "./schema";

const valid = () => ({
  app: BACKUP_APP_ID,
  schemaVersion: 1,
  idbVersion: 6,
  exportedAt: "2026-01-02T03:04:05.000Z",
  appVersion: "1.2.3",
  includesSecrets: false,
  sections: ["collections", "settings"],
  data: {
    collections: [{ id: "c" }],
    settings: { theme: "dark" },
    preferences: { rq_collapsed_folders: "[]" },
  },
});

describe("backupEnvelopeSchema", () => {
  it("accepts a complete envelope", () => {
    expect(backupEnvelopeSchema.safeParse(valid()).success).toBe(true);
  });

  it("accepts empty data and no sections", () => {
    const result = backupEnvelopeSchema.safeParse({
      ...valid(),
      sections: [],
      data: {},
    });
    expect(result.success).toBe(true);
  });

  it("accepts a schemaVersion newer than the current one", () => {
    expect(
      backupEnvelopeSchema.safeParse({ ...valid(), schemaVersion: 99 }).success,
    ).toBe(true);
  });

  it.each([
    ["foreign app id", { app: "other-app" }],
    ["fractional schemaVersion", { schemaVersion: 1.5 }],
    ["zero schemaVersion", { schemaVersion: 0 }],
    ["string schemaVersion", { schemaVersion: "1" }],
    ["negative idbVersion", { idbVersion: -1 }],
    ["non-ISO exportedAt", { exportedAt: "yesterday" }],
    ["non-string appVersion", { appVersion: 1 }],
    ["non-boolean includesSecrets", { includesSecrets: "no" }],
    ["unknown section", { sections: ["bogus"] }],
    ["non-array sections", { sections: "collections" }],
    ["array data", { data: [] }],
    ["non-array collections", { data: { collections: {} } }],
    ["non-record settings", { data: { settings: [] } }],
    ["non-string preference", { data: { preferences: { a: 1 } } }],
  ])("rejects %s", (_name, override) => {
    expect(
      backupEnvelopeSchema.safeParse({ ...valid(), ...override }).success,
    ).toBe(false);
  });

  it("rejects a missing required field", () => {
    const { appVersion: _omit, ...rest } = valid();
    expect(backupEnvelopeSchema.safeParse(rest).success).toBe(false);
  });
});
