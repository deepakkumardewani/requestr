"use client";

import { useTranslations } from "next-intl";
import { JsonVisualizePage } from "@/components/json-visualize/JsonVisualizePage";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";

export default function JsonVisualizePage_() {
  const t = useTranslations("navigation");
  const breadcrumbItems = [
    { label: t("breadcrumbHome"), href: "/app" },
    { label: "JSON Visualize" },
  ];

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center border-b px-4 py-2">
        <AppBreadcrumb items={breadcrumbItems} />
        <h1 className="sr-only">JSON Visualize</h1>
      </header>

      <main id="app-main" className="min-h-0 flex-1 overflow-hidden">
        <JsonVisualizePage />
      </main>
    </div>
  );
}
