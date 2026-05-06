"use client";

import { ArrowLeftRight, Braces, Globe, X, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useConnectionStore } from "@/stores/useConnectionStore";
import type { TabState } from "@/types";

type TabProps = {
  tab: TabState;
  isActive: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
};

export function Tab({ tab, isActive, onSelect, onClose }: TabProps) {
  const t = useTranslations("common");
  const tabName = tab.name || t("newRequest");
  const conn = useConnectionStore((s) => s.connections[tab.tabId]);
  const showConnectionDot =
    (tab.type === "websocket" || tab.type === "socketio") &&
    (conn?.isConnected ?? false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      data-testid="tab"
      className={cn(
        "group relative flex h-9 max-w-[200px] min-w-[100px] shrink-0 items-center gap-1.5 border-r border-border px-3 text-xs transition-colors cursor-pointer outline-none focus-visible:bg-muted",
        isActive
          ? "bg-background text-foreground"
          : "bg-sidebar text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {tab.type === "http" && (
        <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      {tab.type === "graphql" && (
        <Braces className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      {tab.type === "websocket" && (
        <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      {tab.type === "socketio" && (
        <Zap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      )}
      <span className="flex-1 truncate text-left">{tabName}</span>
      {showConnectionDot && (
        <span
          data-testid="tab-connection-dot"
          className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
          title="Connected"
        />
      )}
      {tab.color && (
        <span
          data-testid="tab-color-dot"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: tab.color }}
          title={tab.group ? `Group: ${tab.group}` : undefined}
        />
      )}
      {tab.isDirty && (
        <span
          data-testid="tab-dirty-indicator"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400"
        />
      )}
      {/* div avoids nested <button> invalid HTML — close still handles mouse & keyboard */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClose(e as unknown as React.MouseEvent);
          }
        }}
        data-testid="tab-close-btn"
        aria-label={`Close ${tabName} tab`}
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded transition-opacity",
          isActive
            ? "opacity-60 hover:opacity-100"
            : "opacity-0 group-hover:opacity-60 hover:opacity-100!",
        )}
      >
        <X className="h-3 w-3" />
      </div>
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-method-accent" />
      )}
    </div>
  );
}
