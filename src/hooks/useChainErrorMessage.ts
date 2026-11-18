import { useTranslations } from "next-intl";
import { useCallback } from "react";
import {
  type ChainErrorParams,
  isChainErrorCode,
} from "@/lib/chainRunner/errorCodes";

/**
 * The one place a recorded chain error becomes user-facing text. Returns a
 * translator `(code, params, fallback)`: a known `code` is translated with its
 * `params`; run history persisted before codes existed (or third-party messages
 * such as network errors) has no code, so the stored `fallback` is shown as-is.
 */
export function useChainErrorMessage() {
  const t = useTranslations("errors");
  return useCallback(
    (
      code: string | undefined,
      params: ChainErrorParams | undefined,
      fallback = "",
    ): string =>
      isChainErrorCode(code) ? t(`chain.runError.${code}`, params) : fallback,
    [t],
  );
}
