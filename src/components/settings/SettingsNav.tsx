"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  getSettingsSections,
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
import { useRelayAvailable } from "@/hooks/useRelayAvailable";
import { cn } from "@/lib/utils";

type Props = {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
};

export function SettingsNav({ activeSection, onSectionChange }: Props) {
  const st = useTranslations("settings");
  const nt = useTranslations("navigation");
  const relayAvailable = useRelayAvailable();

  return (
    <nav className="shrink-0 border-b p-4 md:w-52 md:border-r md:border-b-0">
      <div className="mb-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/app" />}>
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

      <div className="flex gap-1 overflow-x-auto md:block md:space-y-0.5 md:overflow-visible">
        {getSettingsSections().map(([id]) => (
          <button
            key={id}
            data-testid={`nav-${id}`}
            type="button"
            onClick={() => onSectionChange(id)}
            className={cn(
              "flex shrink-0 items-center whitespace-nowrap rounded px-3 py-2 text-sm transition-colors md:w-full",
              activeSection === id
                ? "border-l-2 border-l-theme-accent bg-theme-accent/10 pl-[calc(0.75rem-2px)] font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {st(`sections.${id}`)}
            {id === "relay" && !relayAvailable && (
              <span
                className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                data-testid="nav-relay-off"
              >
                {st("sections.relayOff")}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
