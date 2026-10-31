import { fetchSttConfigured } from "@/hooks/useSttConfigured";
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
import type { RelayToolInput } from "./schemas";

/**
 * Settings write tools (TOOL-01). Each change is logged per Settings section
 * with the section's previous values, so Undo puts them back. Nothing here can
 * touch the approval mode: no tool input names it (TOOL-05).
 */

const fail = (error: string): ToolOutcome => ({ ok: false, error });

const NOTHING_TO_CHANGE = "nothing to change: every field was null";
const PROXY_PASSWORD_REFUSED =
  "a proxy password cannot be set here: the user adds credentials in Settings";
const SECRET_HEADER_REFUSED = (key: string) =>
  `"${key}" is a secret header: its value cannot be set here. Leave the value empty and ask the user to fill it in.`;
const GROK_NOT_CONFIGURED =
  "speech by Grok is not set up on this server, so only the browser engine can be chosen";
const PROXY_URL_INVALID =
  "proxyUrl must be a full URL such as http://host:8080";

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

function proxyUrlProblem(proxyUrl: string): string | null {
  if (proxyUrl === "") return null;
  try {
    return new URL(proxyUrl).password ? PROXY_PASSWORD_REFUSED : null;
  } catch {
    return PROXY_URL_INVALID;
  }
}

const updateProxySettings: ToolImpl<"update_proxy_settings"> = {
  name: "update_proxy_settings",
  run: ({ proxyUrl, sslVerify, followRedirects }, { write }) => {
    const changes = Object.fromEntries(
      Object.entries({ proxyUrl, sslVerify, followRedirects }).filter(
        ([, value]) => hasValue(value),
      ),
    );
    if (Object.keys(changes).length === 0) return fail(NOTHING_TO_CHANGE);
    const problem = proxyUrl === null ? null : proxyUrlProblem(proxyUrl);
    if (problem) return fail(problem);
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

type RelayPreferencesInput = RelayToolInput<"set_relay_preferences">;

/** Preferences that apply now; turning Relay off waits for the end of the turn. */
function immediateRelayChanges({
  shareValues,
  speechEngine,
  enabled,
}: RelayPreferencesInput): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      shareValues,
      speechEngine,
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
    if (input.speechEngine === "grok" && !(await fetchSttConfigured())) {
      return fail(GROK_NOT_CONFIGURED);
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
