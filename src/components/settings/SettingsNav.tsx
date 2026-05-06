"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "@/app/settings/constants";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

type Props = {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
};

export function SettingsNav({ activeSection, onSectionChange }: Props) {
  const st = useTranslations("settings");
  const nt = useTranslations("navigation");

  return (
    <nav className="w-52 shrink-0 border-r p-4">
      <div className="mb-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/" />}>
                {nt("home")}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{st("title")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="mt-3 text-lg font-semibold">{st("title")}</h1>
      </div>

      <div className="space-y-0.5">
        {SETTINGS_SECTIONS.map(([id]) => (
          <button
            key={id}
            data-testid={`nav-${id}`}
            type="button"
            onClick={() => onSectionChange(id)}
            className={cn(
              "flex w-full items-center rounded px-3 py-2 text-sm transition-colors",
              activeSection === id
                ? "border-l-2 border-l-theme-accent bg-theme-accent/10 pl-[calc(0.75rem-2px)] text-theme-accent font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {st(`sections.${id}`)}
          </button>
        ))}
      </div>
    </nav>
  );
}
