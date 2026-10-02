"use client";

import { useConnection } from "@xyflow/react";
import { useTranslations } from "next-intl";

/**
 * Screen-reader announcement while a connection drag hovers an invalid target.
 * The visual muted state is CSS (`.connectingto:not(.valid)` in globals.css),
 * so status is never conveyed by color alone.
 */
export function ConnectionFeedback() {
  const t = useTranslations("chain");
  const notAllowed = useConnection(
    (c) => c.inProgress && c.toHandle !== null && c.isValid === false,
  );

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {notAllowed ? t("connectionNotAllowed") : ""}
    </div>
  );
}
