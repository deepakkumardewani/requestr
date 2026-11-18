import { afterEach, describe, expect, it } from "vitest";
import { BACKUP_SCHEMA_VERSION } from "./constants";
import { migrateBackup } from "./migrations";

describe("migrateBackup", () => {
  it("returns the file unchanged when it is already at the current version", () => {
    const raw = {
      app: "requestr-backup",
      schemaVersion: BACKUP_SCHEMA_VERSION,
    };

    expect(migrateBackup(raw, BACKUP_SCHEMA_VERSION)).toBe(raw);
  });

  it("returns null when a step from an older version is missing", () => {
    const raw = { app: "requestr-backup", schemaVersion: 0 };

    expect(migrateBackup(raw, 0)).toBeNull();
  });

  it("returns null for any older version while no migrations are registered", () => {
    expect(migrateBackup({}, BACKUP_SCHEMA_VERSION - 5)).toBeNull();
  });

  describe("with a registered step", () => {
    // The registry is private and empty while only v1 exists. It is a plain
    // object, so a step on Object.prototype is found by the same lookup.
    const FROM = 0;
    afterEach(() => {
      delete (Object.prototype as unknown as Record<number, unknown>)[FROM];
    });

    it("applies the step and stamps the next schema version", () => {
      (Object.prototype as unknown as Record<number, unknown>)[FROM] = (
        raw: Record<string, unknown>
      ) => ({ ...raw, upgraded: true });

      expect(migrateBackup({ app: "x", schemaVersion: FROM }, FROM)).toEqual({
        app: "x",
        schemaVersion: BACKUP_SCHEMA_VERSION,
        upgraded: true,
      });
    });
  });
});
