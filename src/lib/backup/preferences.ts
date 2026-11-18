import { RELAY_STORAGE_KEYS } from "@/lib/relay/constants";
import { SHARE_VALUES_KEY, SPEECH_ENGINE_KEY } from "@/stores/useRelayStore";

/** Set on import so a restored workspace never shows first-run onboarding. */
const ONBOARDING_COMPLETE_KEY = "rq_onboarding_complete";

/**
 * The only localStorage keys a backup carries. Everything else (anon id,
 * volatile Relay state, `rq_chain_*`, the tabs store) is deliberately absent.
 * Literals mirror the owning modules, whose constants are not all exported.
 */
export const BACKUP_PREFERENCE_KEYS: readonly string[] = [
  "requestly_active_env_id",
  "rq_collapsed_folders",
  "rq_sidebar_open_sections",
  "requestly_imported_hub_slugs",
  RELAY_STORAGE_KEYS.enabled,
  RELAY_STORAGE_KEYS.permission,
  SHARE_VALUES_KEY,
  SPEECH_ENGINE_KEY,
];

const ALLOWED_KEYS: ReadonlySet<string> = new Set(BACKUP_PREFERENCE_KEYS);

/** Allow-listed keys that currently hold a value. */
export function readPreferences(): Record<string, string> {
  const preferences: Record<string, string> = {};
  for (const key of BACKUP_PREFERENCE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) preferences[key] = value;
  }
  return preferences;
}

/** Writes allow-listed keys from a backup, ignores the rest, and marks onboarding complete. */
export function writePreferences(preferences: Record<string, string>): void {
  for (const [key, value] of Object.entries(preferences)) {
    if (ALLOWED_KEYS.has(key)) localStorage.setItem(key, value);
  }
  localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
}
