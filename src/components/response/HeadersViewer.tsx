"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type HeadersViewerProps = {
  headers: Record<string, string>;
};

export function HeadersViewer({ headers }: HeadersViewerProps) {
  const entries = Object.entries(headers);
  const t = useTranslations("response");
  const et = useTranslations("errors");

  async function copyHeader(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(`${key}: ${value}`);
      toast.success(et("copiedToClipboard"));
    } catch {
      toast.error(et("failedToCopy"));
    }
  }

  return (
    <ScrollArea className="h-full">
      <Table data-testid="response-headers-table">
        <TableHeader>
          <TableRow>
            <TableHead className="h-7 text-xs">{t("headers.name")}</TableHead>
            <TableHead className="h-7 text-xs">{t("headers.value")}</TableHead>
            <TableHead className="h-7 w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(([key, value]) => (
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
                className="py-1 font-mono text-[11px] text-muted-foreground"
                data-testid="response-header-value"
              >
                {value}
              </TableCell>
              <TableCell className="py-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => copyHeader(key, value)}
                  data-testid="response-header-copy-btn"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
