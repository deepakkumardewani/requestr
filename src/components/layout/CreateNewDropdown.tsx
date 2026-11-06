"use client";

import {
  ArrowLeftRight,
  Braces,
  FolderPlus,
  GitBranch,
  Globe,
  Globe2,
  Plus,
  Upload,
  Zap,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TAB_TYPES } from "@/lib/constants";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";

type CreateNewDropdownProps = {
  onNewChain: () => void;
  onImport: () => void;
};

export function CreateNewDropdown({
  onNewChain,
  onImport,
}: CreateNewDropdownProps) {
  const openTab = useTabsStore((s) => s.openTab);
  const { setIsCreatingCollection, setIsCreatingEnv } = useUIStore();
  const t = useTranslations("navigation");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("createNew")}
            data-testid="create-new-dropdown-trigger"
          />
        }
      >
        <Plus className="h-4 w-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("createGroupRequests")}</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => openTab({ type: TAB_TYPES.HTTP })}>
            <Globe className="mr-2 h-3.5 w-3.5" />
            {t("newHttp")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openTab({ type: TAB_TYPES.GRAPHQL })}
          >
            <Braces className="mr-2 h-3.5 w-3.5" />
            {t("newGraphql")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openTab({ type: TAB_TYPES.WEBSOCKET })}
          >
            <ArrowLeftRight className="mr-2 h-3.5 w-3.5" />
            {t("newWebSocket")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => openTab({ type: TAB_TYPES.SOCKETIO })}
          >
            <Zap className="mr-2 h-3.5 w-3.5" />
            {t("newSocketIO")}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("createGroupWorkspace")}</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => setIsCreatingCollection(true)}
            data-testid="create-collection-item"
          >
            <FolderPlus className="mr-2 h-3.5 w-3.5" />
            {t("newCollection")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsCreatingEnv(true)}>
            <Globe2 className="mr-2 h-3.5 w-3.5" />
            {t("newEnvironment")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onNewChain}
            data-testid="create-chain-item"
          >
            <GitBranch className="mr-2 h-3.5 w-3.5" />
            {t("newChain")}
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("createGroupImport")}</DropdownMenuLabel>
          <DropdownMenuItem onClick={onImport}>
            <Upload className="mr-2 h-3.5 w-3.5" />
            {t("createGroupImport")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
