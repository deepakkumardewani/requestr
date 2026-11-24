"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { usePanelRef } from "react-resizable-panels";
import { RequestTabs } from "@/components/request/RequestTabs";
import { UrlBar } from "@/components/request/UrlBar";
import { ResponsePanel } from "@/components/response/ResponsePanel";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useSendRequest } from "@/hooks/useSendRequest";
import { TOUR_ANCHORS } from "@/lib/tour/tourAnchors";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import { EmptyState } from "./EmptyState";
import { RequestBreadcrumb } from "./RequestBreadcrumb";
import { TabBar } from "./TabBar";

export function RightPanel() {
  const { setSplitRatio } = useUIStore();
  const { activeTabId, tabs, hydrated } = useTabsStore();
  const responsePanelRef = usePanelRef();
  const [responseCollapsed, setResponseCollapsed] = useState(false);

  // Single useSendRequest instance per active tab — shared by UrlBar and ResponsePanel
  // so that the AbortController (and Cancel button) is always correct.
  const { send, sendForce, cancel, isLoading } = useSendRequest(
    activeTabId ?? "",
  );

  const activeTab = tabs.find((t) => t.tabId === activeTabId);
  const hideHttpResponsePanel =
    activeTab?.type === "websocket" || activeTab?.type === "socketio";

  function toggleResponsePanel() {
    const panel = responsePanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setResponseCollapsed(false);
    } else {
      panel.collapse();
      setResponseCollapsed(true);
    }
  }

  const requestColumn = activeTabId ? (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <RequestTabs tabId={activeTabId} />
    </div>
  ) : null;

  return (
    <div className="flex h-full flex-col">
      <RequestBreadcrumb tabId={activeTabId} />
      <TabBar />
      {activeTabId ? (
        <>
          <UrlBar
            tabId={activeTabId}
            send={send}
            cancel={cancel}
            isLoading={isLoading}
          />
          {hideHttpResponsePanel ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {requestColumn}
            </div>
          ) : (
            <ResizablePanelGroup
              orientation="vertical"
              className="flex-1 overflow-hidden"
              onLayoutChanged={(sizes) => {
                if (sizes[0] !== undefined) setSplitRatio(sizes[0]);
              }}
            >
              <ResizablePanel defaultSize="50%" minSize="20%">
                {requestColumn}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                panelRef={responsePanelRef}
                defaultSize="50%"
                minSize="20%"
                maxSize="70%"
                collapsible
                collapsedSize="32px"
              >
                {/* Anchors the tour on the whole panel so it is visible collapsed and before any send. */}
                <div data-tour={TOUR_ANCHORS.response} className="h-full">
                  {/* Collapse / expand toggle bar — matches CodeGenPanel style */}
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex h-9 cursor-pointer items-center border-b px-3"
                    onClick={toggleResponsePanel}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleResponsePanel();
                      }
                    }}
                  >
                    <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      {responseCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      Response
                    </span>
                  </div>
                  {!responseCollapsed && (
                    <div className="h-[calc(100%-2rem)] overflow-hidden">
                      <ResponsePanel
                        tabId={activeTabId}
                        onSendForce={sendForce}
                      />
                    </div>
                  )}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </>
      ) : hydrated ? (
        <EmptyState />
      ) : null}
    </div>
  );
}
