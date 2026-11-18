import type { Page } from "@playwright/test";
import { expect, test } from "../../fixtures/qa";
import { openRelay, sendMessage } from "../../fixtures/relayE2eHelpers";
import { installRelayRoutes } from "../../fixtures/relayRoutes";
import {
  downloadCapture,
  dumpIdbStore,
} from "../../fixtures/relayV2Helpers";

const WORKSPACE_PATH = "/app";
const BACKUP_APP_ID = "requestr-backup";
const SCHEMA_VERSION = 1;
const EXPORTED_AT = "2026-03-04T10:30:00.000Z";
const SECRETS_WARNING = /Anyone with this file can read your secrets/;
const DECLINED_RESULT = "cancelled";
const USER_DECLINED_RESULT = "user declined";

type ExportInput = {
  sections: string[];
  collectionIds: null;
  environmentIds: null;
  chainIds: null;
  includeSecrets: boolean | null;
};

const exportInput = (
  sections: string[],
  includeSecrets: boolean | null = null,
): ExportInput => ({
  sections,
  collectionIds: null,
  environmentIds: null,
  chainIds: null,
  includeSecrets,
});

const card = (page: Page) => page.getByTestId("relay-confirm-card");
const approve = (page: Page) => page.getByTestId("relay-confirm-approve");
const decline = (page: Page) => page.getByTestId("relay-confirm-decline");
const exportRow = (page: Page, section: string) =>
  page.getByTestId(`relay-export-backup-${section}`);

/** Opens Relay with a script that calls one tool, then answers once the result is back. */
async function startTurn(
  page: Page,
  toolName: string,
  input: unknown,
  prompt: string,
) {
  const routes = await installRelayRoutes(page, [
    { kind: "clientTools", calls: [{ toolName, input }] },
    { kind: "text", text: "All done." },
  ]);
  await page.goto(WORKSPACE_PATH);
  await openRelay(page);
  await sendMessage(page, prompt);
  await expect(card(page)).toBeVisible();
  return routes;
}

/** The `tool-<name>` output the client sent back to the model in the follow-up request. */
async function sentToolOutput(
  bodies: unknown[],
  toolName: string,
): Promise<unknown> {
  await expect.poll(() => bodies.length).toBeGreaterThanOrEqual(2);
  const body = bodies.at(-1) as { messages?: { parts?: unknown[] }[] };
  const parts = (body.messages ?? []).flatMap(
    (message) => message.parts ?? [],
  ) as { type?: string; output?: unknown; errorText?: string }[];
  const part = parts.findLast((p) => p.type === `tool-${toolName}`);
  return part?.output ?? part?.errorText;
}

function countFromCard(page: Page, section: string) {
  return exportRow(page, section).textContent();
}

function backupFile(name: string) {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: SCHEMA_VERSION,
    idbVersion: 6,
    exportedAt: EXPORTED_AT,
    appVersion: "0.0.0-e2e",
    includesSecrets: false,
    sections: ["collections"],
    data: {
      collections: [
        {
          id: `qa-toolbak-${name}`,
          name,
          description: "",
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ],
      folders: [],
      requests: [],
      chainConfigs: [],
    },
  };
}

async function pickFile(page: Page, content: unknown) {
  await page.getByTestId("relay-import-backup-input").setInputFiles({
    name: "relay-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(content)),
  });
}

async function collectionNames(page: Page): Promise<string[]> {
  const rows = (await dumpIdbStore(page, "collections")) as { name: string }[];
  return rows.map((row) => row.name);
}

test.describe("Relay v2 backup tools @qa", () => {
  test("[REL-V2-TOOLBAK-01] export_backup shows an approval card with sections and counts and nothing downloads until approved @critical", async ({
    seededPage: page,
    snap,
  }) => {
    const downloads: string[] = [];
    page.on("download", (d) => downloads.push(d.suggestedFilename()));
    const routes = await startTurn(
      page,
      "export_backup",
      exportInput(["collections", "environments"]),
      "Back up my collections and environments",
    );

    await expect(page.getByTestId("relay-export-backup")).toBeVisible();
    await expect(exportRow(page, "collections")).toContainText("Collections");
    await expect(exportRow(page, "environments")).toContainText("Environments");
    await expect(exportRow(page, "collections")).toContainText(/\d+ items?/);
    await expect(exportRow(page, "environments")).toContainText(/\d+ items?/);
    await expect(exportRow(page, "history")).toHaveCount(0);
    await expect(approve(page)).toBeEnabled();
    await snap("01-export-card");

    // The tool has not run: no download and no follow-up chat request yet.
    expect(downloads).toHaveLength(0);
    expect(routes.requestBodies).toHaveLength(1);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      approve(page).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^requestr-backup-\d{4}-\d{2}-\d{2}\.json$/,
    );
  });

  test("[REL-V2-TOOLBAK-02] with includeSecrets true the card shows the secrets warning @critical", async ({
    seededPage: page,
    snap,
  }) => {
    await startTurn(
      page,
      "export_backup",
      exportInput(["collections"], true),
      "Back up my collections with secrets",
    );
    const warning = page.getByTestId("relay-export-backup-secrets");
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(SECRETS_WARNING);
    await snap("02-secrets-warning");
  });

  test("[REL-V2-TOOLBAK-03] after approval the downloaded file matches the card's sections @high", async ({
    seededPage: page,
  }) => {
    const routes = await startTurn(
      page,
      "export_backup",
      exportInput(["collections", "environments"]),
      "Back up my collections and environments",
    );
    await expect(exportRow(page, "collections")).toContainText(/\d+ items?/);
    const collectionsLine = await countFromCard(page, "collections");
    const cardCount = Number(collectionsLine?.match(/(\d+) items?/)?.[1]);

    const file = await downloadCapture(page, () => approve(page).click());
    const backup = file.json<{
      sections: string[];
      includesSecrets: boolean;
      data: { collections?: unknown[] };
    }>();

    expect([...backup.sections].sort()).toEqual(["collections", "environments"]);
    expect(backup.includesSecrets).toBe(false);
    expect(cardCount).toBeGreaterThan(0);
    expect(backup.data.collections).toHaveLength(cardCount);
    const output = JSON.stringify(
      await sentToolOutput(routes.requestBodies, "export_backup"),
    );
    expect(output).toContain(file.filename);
  });

  test("[REL-V2-TOOLBAK-04] import_backup shows Choose file, then the preview after the file is picked, offers Merge only, and the tool result sent back has counts and no file content @critical", async ({
    seededPage: page,
    snap,
  }) => {
    const name = `ToolBak import ${Date.now()}`;
    const routes = await startTurn(
      page,
      "import_backup",
      {},
      "Import a backup file",
    );

    await expect(
      page.getByTestId("relay-import-backup-choose"),
    ).toHaveText(/Choose file/);
    await expect(approve(page)).toBeDisabled();
    await expect(page.getByTestId("backup-preview")).toHaveCount(0);
    await snap("04-choose-file");

    await pickFile(page, backupFile(name));

    const preview = page.getByTestId("backup-preview");
    await expect(preview).toBeVisible();
    await expect(page.getByTestId("backup-preview-collections")).toContainText(
      "1 item",
    );
    await expect(page.getByTestId("relay-import-backup-merge")).toContainText(
      "Merge",
    );
    await expect(card(page).getByText("Replace")).toHaveCount(0);
    await expect(approve(page)).toBeEnabled();
    await snap("04-preview-merge-only");

    await approve(page).click();

    const output = JSON.stringify(
      await sentToolOutput(routes.requestBodies, "import_backup"),
    );
    expect(output).toMatch(/"added":1/);
    expect(output).not.toContain(name);
    expect(output).not.toContain("qa-toolbak-");
    await expect.poll(() => collectionNames(page)).toContain(name);
  });

  test("[REL-V2-TOOLBAK-05] declining or cancelling returns \"cancelled\" and writes nothing @high", async ({
    seededPage: page,
  }) => {
    const name = `ToolBak cancelled ${Date.now()}`;
    const downloads: string[] = [];
    page.on("download", (d) => downloads.push(d.suggestedFilename()));
    const routes = await startTurn(
      page,
      "import_backup",
      {},
      "Import a backup file",
    );
    await pickFile(page, backupFile(name));
    await expect(page.getByTestId("backup-preview")).toBeVisible();

    await decline(page).click();

    const output = JSON.stringify(
      await sentToolOutput(routes.requestBodies, "import_backup"),
    );
    expect(output).toContain(DECLINED_RESULT);
    expect(output).not.toContain(name);
    expect(await collectionNames(page)).not.toContain(name);
    expect(downloads).toHaveLength(0);

    // Declining an export is the same: nothing downloads and the model is told.
    const exportRoutes = await installRelayRoutes(page, [
      {
        kind: "clientTools",
        calls: [
          { toolName: "export_backup", input: exportInput(["collections"]) },
        ],
      },
      { kind: "text", text: "Left it alone." },
    ]);
    await sendMessage(page, "Back up my collections");
    await expect(exportRow(page, "collections")).toBeVisible();
    await decline(page).click();
    const exportOutput = JSON.stringify(
      await sentToolOutput(exportRoutes.requestBodies, "export_backup"),
    );
    expect(exportOutput).toContain(USER_DECLINED_RESULT);
    expect(downloads).toHaveLength(0);
  });
});
