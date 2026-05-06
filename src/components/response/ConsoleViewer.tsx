"use client";

import { useTranslations } from "next-intl";

type ConsoleViewerProps = {
  logs: string[];
};

export function ConsoleViewer({ logs }: ConsoleViewerProps) {
  const t = useTranslations("response");

  if (logs.length === 0) {
    return (
      <div
        data-testid="response-console-viewer"
        className="flex h-full items-center justify-center text-xs text-muted-foreground"
      >
        {t("console.empty")}
      </div>
    );
  }

  return (
    <div
      data-testid="response-console-viewer"
      className="h-full overflow-auto p-3 font-mono text-xs"
    >
      {logs.map((line, i) => (
        <div
          key={`${i}:${line}`}
          className={
            line.startsWith("[error]")
              ? "text-destructive"
              : line.startsWith("[warn]")
                ? "text-yellow-500"
                : "text-foreground"
          }
        >
          {line}
        </div>
      ))}
    </div>
  );
}
