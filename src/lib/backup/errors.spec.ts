import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BACKUP_ERROR_MESSAGE_KEYS,
  type BackupErrorCode,
  describeBackupError,
  IMPORT_PAGE_PATH,
} from "./errors";

const MESSAGES_DIR = path.resolve(__dirname, "../../../messages");
const LOCALES = ["en", "fr", "ja"];
const CODES = Object.keys(BACKUP_ERROR_MESSAGE_KEYS) as BackupErrorCode[];

function lookup(locale: string, dottedKey: string): unknown {
  const json = JSON.parse(
    readFileSync(path.join(MESSAGES_DIR, locale, "settings.json"), "utf8")
  );
  return dottedKey
    .split(".")
    .reduce((node, part) => (node as Record<string, unknown>)?.[part], json);
}

describe("describeBackupError", () => {
  it("maps newerVersion to its key and exposes the file version as n", () => {
    expect(
      describeBackupError({ code: "newerVersion", schemaVersion: 7 })
    ).toEqual({
      key: "backup.errors.newerVersion",
      values: { n: 7, section: undefined },
    });
  });

  it("maps damagedSection to its key and exposes the section", () => {
    expect(
      describeBackupError({ code: "damagedSection", section: "history" })
    ).toEqual({
      key: "backup.errors.damagedSection",
      values: { n: undefined, section: "history" },
    });
  });

  it("maps a plain code with no values", () => {
    expect(describeBackupError({ code: "invalidJson" })).toEqual({
      key: "backup.errors.invalidJson",
      values: { n: undefined, section: undefined },
    });
  });

  it("points foreign files at the import page", () => {
    expect(IMPORT_PAGE_PATH).toBe("/import");
  });
});

describe("backup error message keys", () => {
  it.each(LOCALES.flatMap((locale) => CODES.map((code) => [locale, code])))(
    "%s has non-empty copy for %s",
    (locale, code) => {
      const value = lookup(
        locale,
        BACKUP_ERROR_MESSAGE_KEYS[code as BackupErrorCode]
      );

      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    }
  );
});
