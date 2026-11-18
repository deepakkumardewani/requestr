import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import {
  type CapturedDownload,
  dumpIdb,
  dumpIdbStore,
  downloadCapture,
  type IdbDump,
  twoContexts,
} from "../../fixtures/relayV2Helpers";

const SHOT_DIR = "agent_docs/qa/relay-v2-backup";
const SETTINGS_RECORD_KEY = "app";
const BACKUP_SENTINEL_REQUEST = "qa-v2bk-req-a1";
const MISSING_REQUEST_ID = "qa-v2bk-gone-request";
const MISSING_TAB_ID = "qa-v2bk-tab-gone";
const PRESENT_TAB_ID = "qa-v2bk-tab-present";
const RELOAD_MARKER = "__bakRoundTrip";
const BLANK = "";
const PROXY_WITH_PASSWORD = "http://proxyuser:PROXY-PASS-5e1d@proxy.example.com:8080";
const PROXY_BLANKED = "http://proxyuser:@proxy.example.com:8080";
const SECRET_LEAF_KEYS = new Set([
  "token",
  "password",
  "value",
  "initialValue",
  "currentValue",
]);
/** Stores the default "Everything" export covers (Relay threads are opt-in). */
const BACKED_UP_STORES = [
  "collections",
  "folders",
  "requests",
  "chainConfigs",
  "environments",
  "chains",
  "history",
  "chainRuns",
  "settings",
] as const;
/** localStorage keys on the BAK-06 allow-list that this spec seeds in the source profile. */
const SEEDED_PREFERENCES: Record<string, string> = {
  rq_collapsed_folders: JSON.stringify(["qa-v2bk-folder-a"]),
  requestly_imported_hub_slugs: JSON.stringify(["qa-v2bk-hub-slug"]),
};

type BackupFile = {
  includesSecrets: boolean;
  sections: string[];
  data: { preferences?: Record<string, string> };
};

const SOURCE_SETTINGS = {
  theme: "dark",
  proxyUrl: PROXY_WITH_PASSWORD,
  sslVerify: true,
  followRedirects: true,
  globalBaseUrl: "https://example.com",
  globalHeaders: [
    {
      id: "qa-v2bk-gh-1",
      key: "Authorization",
      value: "SECRET-GLOBAL-HEADER-3b8f",
      enabled: true,
    },
    { id: "qa-v2bk-gh-2", key: "X-Trace", value: "keep-me", enabled: true },
  ],
  pinnedRequestIds: [BACKUP_SENTINEL_REQUEST],
  chainMigrationV5: true,
};

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
}

/** Writes the global settings record and allow-listed preferences into the source profile. */
async function seedSourceSettings(page: Page) {
  await page.goto("/settings");
  await page.evaluate(
    async ({ settings, prefs, key }) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("requestly");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("settings", "readwrite");
          tx.objectStore("settings").put(settings, key);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
      for (const [name, value] of Object.entries(prefs)) {
        localStorage.setItem(name, value);
      }
    },
    { settings: SOURCE_SETTINGS, prefs: SEEDED_PREFERENCES, key: SETTINGS_RECORD_KEY },
  );
}

async function exportBackup(
  page: Page,
  includeSecrets: boolean,
): Promise<CapturedDownload> {
  await page.goto("/settings");
  await page.getByTestId("nav-data").click();
  await page.getByTestId("backup-export-btn").click();
  await expect(page.getByTestId("backup-download-btn")).toBeEnabled();
  if (includeSecrets) await page.getByTestId("backup-secrets-toggle").click();
  const toggle = page.getByTestId("backup-secrets-toggle");
  if (includeSecrets) await expect(toggle).toBeChecked();
  else await expect(toggle).not.toBeChecked();
  return downloadCapture(page, () =>
    page.getByTestId("backup-download-btn").click(),
  );
}

async function markPage(page: Page) {
  await page.evaluate((marker) => {
    (window as unknown as Record<string, unknown>)[marker] = true;
  }, RELOAD_MARKER);
}

const hasMarker = (page: Page) =>
  page.evaluate(
    (marker) => (window as unknown as Record<string, unknown>)[marker] === true,
    RELOAD_MARKER,
  );

/** Resolves once a page that was marked with `markPage` has reloaded. */
function waitForReload(page: Page) {
  return page.waitForFunction(
    (marker) => !(window as unknown as Record<string, unknown>)[marker],
    RELOAD_MARKER,
  );
}

async function importWithReplace(
  page: Page,
  file: CapturedDownload,
): Promise<void> {
  await page.goto("/settings");
  await page.getByTestId("nav-data").click();
  await page.getByTestId("backup-import-btn").click();
  await page.getByTestId("backup-file-input").setInputFiles({
    name: file.filename,
    mimeType: "application/json",
    buffer: Buffer.from(file.text),
  });
  await expect(page.getByTestId("backup-preview")).toBeVisible();
  await page.getByTestId("backup-mode-replace").check();
  await page.getByTestId("backup-restore-btn").click();
  await expect(page.getByTestId("backup-replace-confirm")).toBeVisible();
  await page.getByTestId("backup-replace-confirm-btn").click();
  await expect(page.getByTestId("backup-summary")).toBeVisible();
}

/** Imports with Replace and waits for the post-restore reload of this page. */
async function restoreInto(page: Page, file: CapturedDownload): Promise<void> {
  await page.goto("/settings");
  await markPage(page);
  const reloaded = waitForReload(page);
  await importWithReplace(page, file);
  await shot(page, "restore-summary");
  await reloaded;
  await expect(page.getByTestId("nav-data")).toBeVisible();
}

async function storedPreferences(
  page: Page,
  keys: string[],
): Promise<Record<string, string>> {
  return page.evaluate(
    (names) =>
      Object.fromEntries(
        names
          .map((name) => [name, localStorage.getItem(name)] as const)
          .filter(([, value]) => value !== null),
      ),
    keys,
  ) as Promise<Record<string, string>>;
}

type Leaves = Map<string, unknown>;

/** Flattens a JSON value into dotted-path leaves so two dumps can be diffed field by field. */
function flatten(value: unknown, path: string, out: Leaves = new Map()): Leaves {
  if (Array.isArray(value)) {
    if (value.length === 0) out.set(path, []);
    value.forEach((item, i) => flatten(item, `${path}.${i}`, out));
  } else if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) out.set(path, {});
    for (const [key, item] of entries) flatten(item, `${path}.${key}`, out);
  } else {
    out.set(path, value);
  }
  return out;
}

/** True for the leaf paths BAK-08 may blank (secret auth, variables, headers, proxy password). */
function isSecretPath(path: string): boolean {
  const segments = path.split(".");
  const leaf = segments[segments.length - 1];
  const parent = segments[segments.length - 2];
  return (
    SECRET_LEAF_KEYS.has(leaf) ||
    parent === "headers" ||
    path.endsWith(".proxyUrl")
  );
}

async function sourceAndTarget(
  browser: Parameters<typeof twoContexts>[0],
  includeSecrets: boolean,
) {
  const pair = await twoContexts(browser);
  await seedSourceSettings(pair.source);
  const file = await exportBackup(pair.source, includeSecrets);
  const sourceDump = await dumpIdb(pair.source, BACKED_UP_STORES);
  return { pair, file, sourceDump };
}

function sourceHoldsEverything(dump: IdbDump) {
  for (const store of BACKED_UP_STORES) {
    expect(dump[store].length, `${store} must hold source rows`).toBeGreaterThan(0);
  }
}

test.describe("Relay v2 backup round trip @qa", () => {
  test("[REL-V2-BACKUP-01] export all sections with secrets on in context A, import with Replace in a fresh context B, and every IDB store dump (ids, fields, ordering) plus the data.preferences keys equals the source", { tag: ["@qa", "@critical"] }, async ({
    browser,
  }) => {
    const { pair, file, sourceDump } = await sourceAndTarget(browser, true);
    try {
      const backup = file.json<BackupFile>();
      expect(backup.includesSecrets).toBe(true);
      expect(backup.sections).toEqual(
        expect.arrayContaining(["collections", "environments", "chains", "history", "settings"]),
      );
      sourceHoldsEverything(sourceDump);
      await pair.target.goto("/settings");
      expect(await dumpIdbStore(pair.target, "requests")).not.toEqual(sourceDump.requests);

      await restoreInto(pair.target, file);
      await shot(pair.target, "round-trip-secrets-on");

      expect(await dumpIdb(pair.target, BACKED_UP_STORES)).toEqual(sourceDump);

      const preferenceKeys = Object.keys(backup.data.preferences ?? {});
      expect(preferenceKeys).toEqual(expect.arrayContaining(Object.keys(SEEDED_PREFERENCES)));
      expect(await storedPreferences(pair.target, preferenceKeys)).toEqual(
        backup.data.preferences,
      );
      expect(backup.data.preferences).toMatchObject(SEEDED_PREFERENCES);
    } finally {
      await pair.close();
    }
  });

  test("[REL-V2-BACKUP-02] the same round trip with secrets off differs only in the blanked BAK-08 fields", { tag: ["@qa", "@critical"] }, async ({
    browser,
  }) => {
    const { pair, file, sourceDump } = await sourceAndTarget(browser, false);
    try {
      expect(file.json<BackupFile>().includesSecrets).toBe(false);
      sourceHoldsEverything(sourceDump);

      await restoreInto(pair.target, file);
      await shot(pair.target, "round-trip-secrets-off");
      const targetDump = await dumpIdb(pair.target, BACKED_UP_STORES);

      const differing: string[] = [];
      for (const store of BACKED_UP_STORES) {
        const source = flatten(sourceDump[store], store);
        const target = flatten(targetDump[store], store);
        // No record or field is missing or added.
        expect([...target.keys()]).toEqual([...source.keys()]);
        for (const [path, sourceValue] of source) {
          const targetValue = target.get(path);
          if (JSON.stringify(targetValue) === JSON.stringify(sourceValue)) continue;
          differing.push(path);
          expect(isSecretPath(path), `${path} changed but is not a BAK-08 field`).toBe(true);
          const expected = path.endsWith("proxyUrl") ? PROXY_BLANKED : BLANK;
          expect(targetValue, `${path} must be blanked`).toBe(expected);
        }
      }
      // Non-vacuous: the seeded secrets really were blanked.
      expect(differing.length).toBeGreaterThan(0);
      for (const expected of [
        /^requests\.\d+\.auth\.token$/,
        /^requests\.\d+\.auth\.password$/,
        /^requests\.\d+\.auth\.value$/,
        /^requests\.\d+\.headers\.\d+\.value$/,
        /^environments\.\d+\.variables\.\d+\.currentValue$/,
        /^settings\.\d+\.globalHeaders\.0\.value$/,
        /^settings\.\d+\.proxyUrl$/,
      ]) {
        expect(differing.some((path) => expected.test(path)), `${expected} blanked`).toBe(true);
      }
      expect(JSON.stringify(targetDump)).not.toContain("SECRET-");
      expect(JSON.stringify(targetDump)).not.toContain("PROXY-PASS");
    } finally {
      await pair.close();
    }
  });

  test("[REL-V2-BACKUP-03] after Replace the page reloads and a second open tab of the same profile receives the reload message", { tag: ["@qa", "@high"] }, async ({
    browser,
  }) => {
    const { pair, file } = await sourceAndTarget(browser, false);
    try {
      const targetContext = pair.target.context();
      const sibling = await targetContext.newPage();
      await sibling.goto("/app");
      await expect(sibling.getByTestId("tab-bar")).toBeVisible();
      await markPage(sibling);
      await pair.source.goto("/app");
      await markPage(pair.source);

      const siblingReloaded = waitForReload(sibling);
      await restoreInto(pair.target, file);
      await siblingReloaded;
      await shot(sibling, "second-tab-reloaded");

      // A different profile never hears the broadcast.
      expect(await hasMarker(pair.source)).toBe(true);
    } finally {
      await pair.close();
    }
  });

  test("[REL-V2-BACKUP-04] tabs for requests missing after the restore are closed", { tag: ["@qa", "@high"] }, async ({
    browser,
  }) => {
    const { pair, file } = await sourceAndTarget(browser, false);
    try {
      await pair.target.goto("/app");
      await expect(pair.target.getByTestId("tab-bar")).toBeVisible();
      await seedTabs(pair.target);
      await pair.target.reload();
      await expect(pair.target.getByTestId("tab")).toHaveCount(2);
      await shot(pair.target, "tabs-before-restore");

      await restoreInto(pair.target, file);
      await pair.target.goto("/app");

      const tabs = pair.target.getByTestId("tab");
      await expect(tabs).toHaveCount(1);
      await expect(tabs.first()).toContainText("Present request");
      const stored = (await dumpIdbStore(pair.target, "tabs")) as {
        tabId: string;
        requestId: string | null;
      }[];
      expect(stored.map((tab) => tab.tabId)).toEqual([PRESENT_TAB_ID]);
      expect(stored.map((tab) => tab.requestId)).not.toContain(MISSING_REQUEST_ID);
      await shot(pair.target, "tabs-after-restore");
    } finally {
      await pair.close();
    }
  });
});

/** Replaces the persisted tabs: one for a request outside the backup, one for a request inside it. */
async function seedTabs(page: Page) {
  const base = {
    type: "http",
    isDirty: false,
    url: "https://example.com",
    headers: [],
    method: "GET",
    params: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    assertions: [],
  };
  const tabs = [
    { ...base, tabId: MISSING_TAB_ID, requestId: MISSING_REQUEST_ID, name: "Gone request" },
    { ...base, tabId: PRESENT_TAB_ID, requestId: BACKUP_SENTINEL_REQUEST, name: "Present request" },
  ];
  await page.evaluate(
    (rows) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("requestly");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("tabs", "readwrite");
          const store = tx.objectStore("tabs");
          store.clear();
          for (const row of rows) store.put(row);
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    tabs,
  );
}
