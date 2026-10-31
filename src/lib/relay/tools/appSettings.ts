import { redactHeaderList, redactProxyUrl } from "@/lib/backup/secrets";
import { useRelayPermissionStore } from "@/stores/useRelayPermissionStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { readStoredTheme } from "../changeLog";
import type { ToolImpl } from "./registry";

/**
 * Read-only view of the app settings (TOOL-01). Proxy credentials are always
 * masked and secret header values are masked unless the user shares values,
 * both through the backup masking so there is one list of secret names.
 */

const DEFAULT_THEME = "dark";

const getAppSettings: ToolImpl<"get_app_settings"> = {
  name: "get_app_settings",
  run: () => {
    const settings = useSettingsStore.getState();
    const relay = useRelayStore.getState();
    return {
      ok: true,
      data: {
        theme: readStoredTheme() ?? DEFAULT_THEME,
        language: settings.locale,
        accentColor: settings.accentColor,
        proxy: {
          proxyUrl: redactProxyUrl(settings.proxyUrl),
          sslVerify: settings.sslVerify,
          followRedirects: settings.followRedirects,
        },
        global: {
          baseUrl: settings.globalBaseUrl,
          headers: relay.shareValues
            ? settings.globalHeaders
            : redactHeaderList(settings.globalHeaders),
        },
        relay: {
          enabled: relay.enabled,
          shareValues: relay.shareValues,
          speechEngine: relay.speechEngine,
        },
        approvalMode: {
          value: useRelayPermissionStore.getState().mode,
          readOnly: true,
        },
      },
    };
  },
};

export const appSettingsTools = [getAppSettings] as const;
