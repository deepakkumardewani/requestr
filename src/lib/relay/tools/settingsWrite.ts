import { SECRET_HEADER_NAMES } from "@/lib/backup/secrets";
import { generateId } from "@/lib/utils";
import type { KVPair } from "@/types";
import {
  type ChangeSpec,
  commitChange,
  readSettingsGroup,
  type SettingsGroup,
  writeSettingsGroup,
} from "../changeLog";
import type { ToolImpl, ToolOutcome } from "./registry";
import { urlProblem } from "./requestWrite";
import { type RelayToolInput, registerRiskContext } from "./schemas";

/**
 * Settings write tools (TOOL-01). Each change is logged per Settings section
 * with the section's previous values, so Undo puts them back. Nothing here can
 * touch the approval mode: no tool input names it (TOOL-05).
 */

const fail = (error: string): ToolOutcome => ({ ok: false, error });

const NOTHING_TO_CHANGE = "nothing to change: every field was null";
const SECRET_HEADER_REFUSED = (key: string) =>
  `"${key}" is a secret header: its value cannot be set here. Leave the value empty and ask the user to fill it in.`;

/** Key on a tool result telling the chat to turn Relay off once the turn is over. */
export const DISABLE_AFTER_TURN = "disableAfterTurn";

const hasValue = (value: unknown): boolean => value !== null;

function settingsSpec(
  group: SettingsGroup,
  summary: string,
  changes: Record<string, unknown>,
): ChangeSpec {
  const before = readSettingsGroup(group);
  return {
    entity: "settings",
    entityId: group,
    summary,
    before,
    mutate: () => writeSettingsGroup(group, { ...before, ...changes }),
  };
}

const THEME_LABELS = {
  light: "light",
  dark: "dark",
  system: "the system setting",
} as const;
const LOCALE_LABELS = { en: "English", fr: "French", ja: "Japanese" } as const;

const setTheme: ToolImpl<"set_theme"> = {
  name: "set_theme",
  run: ({ theme }, { write }) =>
    commitChange(
      write,
      settingsSpec(
        "appearance",
        `Switched the theme to ${THEME_LABELS[theme]}`,
        { theme },
      ),
    ),
};

const setLanguage: ToolImpl<"set_language"> = {
  name: "set_language",
  run: ({ locale }, { write }) =>
    commitChange(
      write,
      settingsSpec(
        "language",
        `Changed the language to ${LOCALE_LABELS[locale]}`,
        { locale },
      ),
    ),
};

const updateProxySettings: ToolImpl<"update_proxy_settings"> = {
  name: "update_proxy_settings",
  run: ({ sslVerify, followRedirects }, { write }) => {
    const changes = Object.fromEntries(
      Object.entries({ sslVerify, followRedirects }).filter(([, value]) =>
        hasValue(value),
      ),
    );
    if (Object.keys(changes).length === 0) return fail(NOTHING_TO_CHANGE);
    return commitChange(
      write,
      settingsSpec("proxy", "Updated the proxy settings", changes),
    );
  },
};

type HeaderInput = NonNullable<
  RelayToolInput<"set_global_variables">["headers"]
>[number];

function toHeaderPair({ key, value, enabled }: HeaderInput): KVPair {
  return { id: generateId(), key, value, enabled: enabled ?? true };
}

const secretHeader = (
  headers: readonly HeaderInput[],
): HeaderInput | undefined =>
  headers.find(
    (header) =>
      header.value !== "" && SECRET_HEADER_NAMES.has(header.key.toLowerCase()),
  );

const setGlobalVariables: ToolImpl<"set_global_variables"> = {
  name: "set_global_variables",
  run: ({ baseUrl, headers }, { write }) => {
    if (baseUrl === null && headers === null) return fail(NOTHING_TO_CHANGE);
    const problem = baseUrl ? urlProblem(baseUrl) : null;
    if (problem) return fail(problem);
    const secret = headers ? secretHeader(headers) : undefined;
    if (secret) return fail(SECRET_HEADER_REFUSED(secret.key));
    const changes: Record<string, unknown> = {};
    if (baseUrl !== null) changes.globalBaseUrl = baseUrl;
    if (headers !== null) changes.globalHeaders = headers.map(toHeaderPair);
    return commitChange(
      write,
      settingsSpec(
        "global",
        "Updated the global base URL and headers",
        changes,
      ),
    );
  },
};

/** Gives `risk()` the current global settings to diff a call against, without schemas.ts touching stores. */
registerRiskContext(() => {
  const { globalBaseUrl, globalHeaders } = readSettingsGroup("global");
  return {
    globalBaseUrl: globalBaseUrl as string,
    globalHeaders: globalHeaders as readonly KVPair[],
  };
});

type RelayPreferencesInput = RelayToolInput<"set_relay_preferences">;

/** Preferences that apply now; turning Relay off waits for the end of the turn. */
function immediateRelayChanges({
  shareValues,
  enabled,
}: RelayPreferencesInput): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      shareValues,
      enabled: enabled === true ? true : null,
    }).filter(([, value]) => hasValue(value)),
  );
}

/** What turning Relay off records, once the turn that asked for it has ended. */
export const disableRelaySpec = (): ChangeSpec =>
  settingsSpec("relay", "Turned Relay off", { enabled: false });

const DISABLE_PENDING_SUMMARY = "Relay will turn off when this reply ends";

const setRelayPreferences: ToolImpl<"set_relay_preferences"> = {
  name: "set_relay_preferences",
  run: async (input, { write }) => {
    const changes = immediateRelayChanges(input);
    const disables = input.enabled === false;
    if (Object.keys(changes).length === 0 && !disables) {
      return fail(NOTHING_TO_CHANGE);
    }
    const deferred = disables ? { [DISABLE_AFTER_TURN]: true } : {};
    if (Object.keys(changes).length === 0) {
      return {
        ok: true,
        data: { summary: DISABLE_PENDING_SUMMARY, ...deferred },
      };
    }
    return commitChange(
      write,
      settingsSpec("relay", "Updated the Relay preferences", changes),
      deferred,
    );
  },
};

export const settingsWriteTools = [
  setTheme,
  setLanguage,
  updateProxySettings,
  setGlobalVariables,
  setRelayPreferences,
] as const;
