/**
 * Rows of the `+` launcher (RP-215). Pure: the component supplies the stores'
 * snapshots and a translator, and gets back ordered sections ready to render.
 */

import { type ContextChip, type ContextChipKind, chipKey } from "./chips";
import { LAUNCHER_ACTION_IDS, RELAY_RECENTS_CAP } from "./constants";
import {
  getPermissionOption,
  RELAY_DEFAULT_PERMISSION_MODE,
  type RelayPermissionMode,
} from "./permission";
import type { SlashCommand } from "./slashCommands";

export type LauncherSectionId = "recent" | "attach" | "actions" | "settings";

export type LauncherAttachId =
  | "currentTab"
  | "request"
  | "collection"
  | "environment"
  | "chain"
  | "pasteCurl";

/** What choosing a row does; the component maps each to an in-app handler. */
export type LauncherTarget =
  | { type: "recent"; chip: ContextChip }
  | { type: "attach"; attach: LauncherAttachId }
  | { type: "action"; command: SlashCommand }
  | { type: "setting"; setting: LauncherSettingId };

/** Settings reachable from the launcher; each hands off to its own control. */
export type LauncherSettingId = "permission" | "capabilities";

export type LauncherRow = {
  /** Unique within the launcher. */
  key: string;
  section: LauncherSectionId;
  /** Searchable text (name and description) cmdk filters on. */
  value: string;
  name: string;
  description: string;
  disabled: boolean;
  /** Choosing the row opens a sub-list in place instead of acting at once. */
  opensList: boolean;
  /** Current value shown muted at the row's end (settings rows). */
  valueLabel?: string;
  target: LauncherTarget;
};

export type LauncherSection = {
  id: LauncherSectionId;
  rows: LauncherRow[];
};

export type LauncherRecent = Pick<ContextChip, "kind" | "id"> & {
  name: string;
};

type Translate = (key: string) => string;

type BuildLauncherSectionsArgs = {
  recents: readonly LauncherRecent[];
  /** `chipKey` of every item already attached. */
  attachedKeys: ReadonlySet<string>;
  hasTab: boolean;
  slashCommands: readonly SlashCommand[];
  /** Shown as the Permission mode row's value. */
  permissionMode?: RelayPermissionMode;
  /** Resolves message keys; defaults to the key itself. */
  translate?: Translate;
};

const ATTACH_ORDER: readonly LauncherAttachId[] = [
  "currentTab",
  "request",
  "collection",
  "environment",
  "chain",
  "pasteCurl",
];

/** Attach rows that open a searchable list of that kind. */
export const LAUNCHER_LIST_KINDS = {
  request: "request",
  collection: "collection",
  environment: "environment",
  chain: "chain",
} as const satisfies Partial<Record<LauncherAttachId, ContextChipKind>>;

export type LauncherListId = keyof typeof LAUNCHER_LIST_KINDS;

export const isListAttach = (id: LauncherAttachId): id is LauncherListId =>
  id in LAUNCHER_LIST_KINDS;

const KIND_LABEL_KEYS = {
  tab: "context.kindTab",
  request: "context.kindRequest",
  chain: "context.kindChain",
  collection: "context.kindCollection",
  environment: "context.kindEnvironment",
} as const satisfies Record<ContextChipKind, string>;

const identity: Translate = (key) => key;

const searchValue = (name: string, description: string) =>
  `${name} ${description}`.trim();

function recentRows(
  recents: readonly LauncherRecent[],
  attachedKeys: ReadonlySet<string>,
  translate: Translate,
): LauncherRow[] {
  return recents
    .filter((item) => !attachedKeys.has(chipKey(item)))
    .slice(0, RELAY_RECENTS_CAP)
    .map((item) => {
      const description = translate(KIND_LABEL_KEYS[item.kind]);
      return {
        key: `recent:${chipKey(item)}`,
        section: "recent",
        value: searchValue(item.name, description),
        name: item.name,
        description,
        disabled: false,
        opensList: false,
        target: {
          type: "recent",
          chip: { kind: item.kind, id: item.id, label: item.name },
        },
      };
    });
}

function attachRows(hasTab: boolean, translate: Translate): LauncherRow[] {
  return ATTACH_ORDER.map((attach) => {
    const name = translate(`launcher.attach.${attach}.label`);
    const unavailable = attach === "currentTab" && !hasTab;
    const description = translate(
      unavailable
        ? "launcher.attach.currentTab.unavailable"
        : `launcher.attach.${attach}.description`,
    );
    return {
      key: `attach:${attach}`,
      section: "attach",
      value: searchValue(name, description),
      name,
      description,
      disabled: unavailable,
      opensList: isListAttach(attach),
      target: { type: "attach", attach },
    };
  });
}

function actionRows(
  slashCommands: readonly SlashCommand[],
  translate: Translate,
): LauncherRow[] {
  return LAUNCHER_ACTION_IDS.flatMap((id) => {
    const command = slashCommands.find((candidate) => candidate.id === id);
    if (!command) return [];
    const description = translate(command.descriptionKey);
    return [
      {
        key: `action:${command.id}`,
        section: "actions" as const,
        value: searchValue(command.name, description),
        name: command.name,
        description,
        disabled: false,
        opensList: false,
        target: { type: "action" as const, command },
      },
    ];
  });
}

interface SettingRowOptions {
  setting: "permission" | "capabilities";
  translate: Translate;
  valueLabel?: string;
}

function settingRow({
  setting,
  translate,
  valueLabel,
}: SettingRowOptions): LauncherRow {
  const name = translate(`launcher.settings.${setting}.label`);
  const description = translate(`launcher.settings.${setting}.description`);
  return {
    key: `setting:${setting}`,
    section: "settings",
    value: searchValue(name, description),
    name,
    description,
    disabled: false,
    opensList: false,
    ...(valueLabel === undefined ? {} : { valueLabel }),
    target: { type: "setting", setting },
  };
}

/** Permission mode first, then What Relay can do. */
function settingRows(
  permissionMode: RelayPermissionMode,
  translate: Translate,
): LauncherRow[] {
  return [
    settingRow({
      setting: "permission",
      translate,
      valueLabel: translate(getPermissionOption(permissionMode).labelKey),
    }),
    settingRow({ setting: "capabilities", translate }),
  ];
}

/** Sections in the fixed order recent, attach, actions, settings; empty ones are omitted. */
export function buildLauncherSections({
  recents,
  attachedKeys,
  hasTab,
  slashCommands,
  permissionMode = RELAY_DEFAULT_PERMISSION_MODE,
  translate = identity,
}: BuildLauncherSectionsArgs): LauncherSection[] {
  const sections: LauncherSection[] = [
    { id: "recent", rows: recentRows(recents, attachedKeys, translate) },
    { id: "attach", rows: attachRows(hasTab, translate) },
    { id: "actions", rows: actionRows(slashCommands, translate) },
    { id: "settings", rows: settingRows(permissionMode, translate) },
  ];
  return sections.filter((section) => section.rows.length > 0);
}

const MATCH_SCORE = 1;

/**
 * cmdk filter: every typed word must appear in the row's name or description.
 * Rows pass a unique key as cmdk's `value` and their searchable text as
 * `keywords`, so the haystack is the keywords when present.
 * cmdk's default is a loose subsequence match ("run" would hit "Turn a cURL"),
 * and a constant score keeps the section order stable while filtering.
 */
export function launcherFilter(
  value: string,
  search: string,
  keywords: readonly string[] = [],
): number {
  const haystack = (
    keywords.length > 0 ? keywords.join(" ") : value
  ).toLowerCase();
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((word) => haystack.includes(word)) ? MATCH_SCORE : 0;
}
