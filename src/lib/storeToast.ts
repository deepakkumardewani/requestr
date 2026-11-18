import { toast } from "sonner";
import { MESSAGES } from "@/i18n/messages";
import { useSettingsStore } from "@/stores/useSettingsStore";

// Stores run outside React, so they cannot call `useTranslations`. They raise
// toasts by key and the copy is resolved here against the active locale.
export type StoreToastKey = keyof typeof MESSAGES.en.errors.chain.toast;

function storeToastText(key: StoreToastKey): string {
  return MESSAGES[useSettingsStore.getState().locale].errors.chain.toast[key];
}

/** The message of a caught `Error`; anything else is reported as unknown. */
export function describeError(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : storeToastText("unknownError");
}

/** Raises a translated error toast; `cause`'s message (raw data) becomes the description. */
export function toastStoreError(
  key: StoreToastKey,
  options?: { cause: unknown },
): void {
  const message = storeToastText(key);
  if (!options) {
    toast.error(message);
    return;
  }
  toast.error(message, { description: describeError(options.cause) });
}
