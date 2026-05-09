"use client";

import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type HeadersViewerProps = {
  headers: Record<string, string>;
};

type HeaderGroup = {
  label: string;
  keys: string[];
};

const CORS_PREFIXES = ["access-control-"];
const CONTENT_KEYS = new Set([
  "content-type",
  "content-length",
  "content-encoding",
  "content-language",
  "content-location",
  "content-range",
  "transfer-encoding",
]);

export function classifyHeaders(
  headers: Record<string, string>,
): HeaderGroup[] {
  const corsKeys: string[] = [];
  const contentKeys: string[] = [];
  const otherKeys: string[] = [];

  for (const key of Object.keys(headers)) {
    const lower = key.toLowerCase();
    if (CORS_PREFIXES.some((p) => lower.startsWith(p))) {
      corsKeys.push(key);
    } else if (CONTENT_KEYS.has(lower)) {
      contentKeys.push(key);
    } else {
      otherKeys.push(key);
    }
  }

  const groups: HeaderGroup[] = [];
  if (otherKeys.length > 0)
    groups.push({ label: "Response Headers", keys: otherKeys });
  if (contentKeys.length > 0)
    groups.push({ label: "Content Headers", keys: contentKeys });
  if (corsKeys.length > 0)
    groups.push({ label: "CORS Headers", keys: corsKeys });
  return groups;
}

type HeaderGroupSectionProps = {
  group: HeaderGroup;
  headers: Record<string, string>;
  onCopy: (key: string, value: string) => void;
};

function HeaderGroupSection({
  group,
  headers,
  onCopy,
}: HeaderGroupSectionProps) {
  const [open, setOpen] = useState(true);

  return (
    <div
      data-testid={`header-group-${group.label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 border-b border-border bg-muted/30 px-3 py-1 text-left"
        data-testid="header-group-toggle"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {group.label}
        </span>
        <span className="ml-1 text-[11px] text-muted-foreground/60">
          ({group.keys.length})
        </span>
      </button>
      {open && (
        <Table data-testid="response-headers-table">
          <TableBody>
            {group.keys.map((key) => (
              <TableRow
                key={key}
                className="group"
                data-testid="response-header-row"
              >
                <TableCell
                  className="py-1 font-mono text-[11px] font-medium"
                  data-testid="response-header-name"
                >
                  {key}
                </TableCell>
                <TableCell
                  className={cn(
                    "py-1 font-mono text-[11px] text-muted-foreground",
                  )}
                  data-testid="response-header-value"
                >
                  {headers[key]}
                </TableCell>
                <TableCell className="py-1 w-10">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => onCopy(key, headers[key])}
                    data-testid="response-header-copy-btn"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export function HeadersViewer({ headers }: HeadersViewerProps) {
  const groups = classifyHeaders(headers);
  const et = useTranslations("errors");

  async function copyHeader(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(`${key}: ${value}`);
      toast.success(et("copiedToClipboard"));
    } catch {
      toast.error(et("failedToCopy"));
    }
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        No headers
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      {groups.map((group) => (
        <HeaderGroupSection
          key={group.label}
          group={group}
          headers={headers}
          onCopy={copyHeader}
        />
      ))}
    </ScrollArea>
  );
}
