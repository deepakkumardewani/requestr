/** Server-safe: no store, DOM or React imports (the tool schemas import this). */

export const RELAY_PERMISSION_MODES = ["always-ask", "review", "skip"] as const;
export type RelayPermissionMode = (typeof RELAY_PERMISSION_MODES)[number];

export const RELAY_DEFAULT_PERMISSION_MODE: RelayPermissionMode = "review";

export function isRelayPermissionMode(
  value: unknown,
): value is RelayPermissionMode {
  return (
    typeof value === "string" &&
    (RELAY_PERMISSION_MODES as readonly string[]).includes(value)
  );
}

export type RelayPermissionTone = "default" | "recommended" | "caution";
export type RelayPermissionIcon =
  | "shield-question"
  | "shield-check"
  | "shield-alert";

export type RelayPermissionOption = {
  mode: RelayPermissionMode;
  /** Keys under the `relay` namespace, shared by the shield, Settings and launcher. */
  labelKey: `permission.option.${RelayPermissionMode}.label`;
  descriptionKey: `permission.option.${RelayPermissionMode}.description`;
  icon: RelayPermissionIcon;
  tone: RelayPermissionTone;
};

export const RELAY_PERMISSION_OPTIONS: readonly RelayPermissionOption[] = [
  {
    mode: "always-ask",
    labelKey: "permission.option.always-ask.label",
    descriptionKey: "permission.option.always-ask.description",
    icon: "shield-question",
    tone: "default",
  },
  {
    mode: "review",
    labelKey: "permission.option.review.label",
    descriptionKey: "permission.option.review.description",
    icon: "shield-check",
    tone: "recommended",
  },
  {
    mode: "skip",
    labelKey: "permission.option.skip.label",
    descriptionKey: "permission.option.skip.description",
    icon: "shield-alert",
    tone: "caution",
  },
];

export function getPermissionOption(
  mode: RelayPermissionMode,
): RelayPermissionOption {
  const option = RELAY_PERMISSION_OPTIONS.find((o) => o.mode === mode);
  if (!option) throw new Error(`Unknown relay permission mode: ${mode}`);
  return option;
}

/** Keys a radio group moves focus with (arrows wrap, Home/End jump). */
export const RADIO_NAV_KEYS = [
  "ArrowDown",
  "ArrowRight",
  "ArrowUp",
  "ArrowLeft",
  "Home",
  "End",
] as const;
export type RadioNavKey = (typeof RADIO_NAV_KEYS)[number];

export function isRadioNavKey(key: string): key is RadioNavKey {
  return (RADIO_NAV_KEYS as readonly string[]).includes(key);
}

/** Index a radio group focuses next for a navigation key. */
export function nextRadioIndex(
  key: RadioNavKey,
  index: number,
  count: number,
): number {
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return (index + 1) % count;
    case "ArrowUp":
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
  }
}
