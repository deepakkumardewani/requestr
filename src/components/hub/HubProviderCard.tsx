"use client";

import { BookOpen, CheckCheck, Download, FileJson, Globe } from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useImportedHubSlugs } from "@/hooks/useImportedHubSlugs";
import { importHubEntry } from "@/lib/hub";
import { resolveHubLogoUrl } from "@/lib/hub-logo";
import type { HubCollection, HubEnvironment, HubMeta } from "@/types/hub";

type HubProviderCardProps = {
  slug: string;
  meta: HubMeta;
};

export function HubProviderCard({ slug, meta }: HubProviderCardProps) {
  const { resolvedTheme } = useTheme();
  const { importedSlugs, markImported } = useImportedHubSlugs();
  const [isImporting, setIsImporting] = useState(false);

  const isImported = importedSlugs.has(slug);
  const logoSrc = resolveHubLogoUrl(meta.logoUrl, resolvedTheme === "dark");
  const hasResourceLinks = Boolean(meta.docsUrl || meta.specUrl);

  async function handleImport() {
    setIsImporting(true);
    try {
      const [collectionRes, envRes] = await Promise.all([
        fetch(`/data/hub/${slug}/collection.json`),
        fetch(`/data/hub/${slug}/environment.json`),
      ]);

      if (!collectionRes.ok || !envRes.ok) {
        throw new Error("Failed to fetch hub data");
      }

      const [collection, environment] = await Promise.all([
        collectionRes.json() as Promise<HubCollection>,
        envRes.json() as Promise<HubEnvironment>,
      ]);

      importHubEntry(slug, collection, environment, meta);
      markImported(slug);
      toast.success(`"${meta.name}" imported`, {
        description: `${collection.requests.length} requests and environment variables added.`,
      });
    } catch (error) {
      toast.error("Import failed", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/30">
      {/* Provider logo */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background">
        {meta.logoUrl ? (
          <Image
            key={logoSrc}
            src={logoSrc}
            alt={`${meta.name} logo`}
            width={36}
            height={36}
            className="object-contain"
            loading="lazy"
            unoptimized
          />
        ) : (
          <Globe className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{meta.name}</span>
          {meta.category && (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {meta.category}
            </Badge>
          )}
        </div>

        <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
          {meta.description}
        </p>

        {hasResourceLinks && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {meta.docsUrl && (
              <a
                href={meta.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-0.5 font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                <BookOpen className="h-3 w-3 shrink-0" aria-hidden />
                <span>Docs</span>
              </a>
            )}
            {meta.docsUrl && meta.specUrl && (
              <span className="text-border select-none" aria-hidden>
                |
              </span>
            )}
            {meta.specUrl && (
              <a
                href={meta.specUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full min-w-0 items-center gap-0.5 font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                <FileJson className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">OpenAPI</span>
              </a>
            )}
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          {meta.requestCount !== undefined && (
            <span className="text-[11px] text-muted-foreground">
              {meta.requestCount} requests
            </span>
          )}

          {isImported ? (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-7 gap-1.5 text-xs text-muted-foreground"
              disabled
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Imported
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-7 gap-1.5 text-xs"
              onClick={handleImport}
              disabled={isImporting}
            >
              <Download className="h-3.5 w-3.5" />
              {isImporting ? "Importing…" : "Import"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
