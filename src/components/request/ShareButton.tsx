"use client";

import { Link } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTabsStore } from "@/stores/useTabsStore";
import { ShareModal } from "./ShareModal";

type ShareButtonProps = {
  tabId: string;
};

export function ShareButton({ tabId }: ShareButtonProps) {
  const t = useTranslations("tooltips");
  const [open, setOpen] = useState(false);

  const tab = useTabsStore((s) => s.tabs.find((t) => t.tabId === tabId));

  const disabled = !tab?.url || tab.type !== "http";

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={disabled}
              onClick={() => setOpen(true)}
            />
          }
        >
          <Link className="h-3.5 w-3.5" />
        </TooltipTrigger>
        <TooltipContent>{t("shareRequestLink")}</TooltipContent>
      </Tooltip>

      {open && tab && tab.type === "http" && (
        <ShareModal open={open} onOpenChange={setOpen} tab={tab} />
      )}
    </>
  );
}
