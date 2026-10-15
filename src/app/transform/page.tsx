"use client";

import { useTranslations } from "next-intl";
import { AppBreadcrumb } from "@/components/layout/AppBreadcrumb";
import { TransformPage } from "@/components/transform/TransformPage";

export default function TransformPage_() {
  const t = useTranslations("navigation");
  const breadcrumbItems = [
    { label: t("breadcrumbHome"), href: "/app" },
    { label: "Transform Playground" },
  ];

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex shrink-0 items-center border-b px-4 py-2">
        <AppBreadcrumb items={breadcrumbItems} />
        <h1 className="sr-only">Transform Playground</h1>
      </header>

      <main id="app-main" className="min-h-0 flex-1 overflow-hidden">
        <TransformPage />
      </main>
    </div>
  );
}
