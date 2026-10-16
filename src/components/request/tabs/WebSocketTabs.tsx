"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { HeadersEditor } from "../HeadersEditor";
import { MessageLog } from "../MessageLog";

type WebSocketTabsProps = {
  tabId: string;
};

export function WebSocketTabs({ tabId }: WebSocketTabsProps) {
  const { tabs, updateTabState } = useTabsStore();
  const { connections, sendWebSocketMessage } = useConnectionStore();
  const tab = tabs.find((t) => t.tabId === tabId);

  if (!tab || tab.type !== "websocket") return null;

  const draft = tab.draft ?? "";

  const conn = connections[tabId] ?? {
    isConnected: false,
    isConnecting: false,
    error: null,
  };

  function handleSend() {
    if (!draft) return;
    sendWebSocketMessage(tabId, draft);
    updateTabState(tabId, { draft: "" });
  }

  function handleClearLog() {
    updateTabState(tabId, { messageLog: [] });
  }

  return (
    <Tabs defaultValue="messages" className="flex h-full flex-col">
      <TabsList className="h-9 shrink-0 rounded-none border-b bg-transparent px-3 justify-start gap-0">
        <TabsTrigger
          value="messages"
          data-testid="request-tab-ws-messages"
          className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-b-theme-accent data-[state=active]:text-theme-accent"
        >
          Messages
        </TabsTrigger>
        <TabsTrigger
          value="headers"
          data-testid="request-tab-headers"
          className="h-8 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-b-theme-accent data-[state=active]:text-theme-accent"
        >
          Headers
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-hidden">
        <TabsContent
          value="messages"
          className="mt-0 flex h-full min-h-0 flex-col overflow-hidden"
        >
          <div className="shrink-0 space-y-2 border-b border-border p-3">
            <Textarea
              value={draft}
              onChange={(e) => updateTabState(tabId, { draft: e.target.value })}
              placeholder="Message to send…"
              className="min-h-20 font-mono text-xs"
              data-testid="ws-message-input"
            />
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={!conn.isConnected}
              onClick={handleSend}
              data-testid="ws-send-btn"
            >
              Send
            </Button>
          </div>
          <div className="min-h-0 flex-1">
            <MessageLog messages={tab.messageLog} onClear={handleClearLog} />
          </div>
        </TabsContent>
        <TabsContent value="headers" className="mt-0 h-full overflow-auto">
          <HeadersEditor tabId={tabId} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
