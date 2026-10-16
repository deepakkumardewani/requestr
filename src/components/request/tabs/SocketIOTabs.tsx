"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { HeadersEditor } from "../HeadersEditor";
import { MessageLog } from "../MessageLog";

const DEFAULT_EVENT_NAME = "message";

type SocketIOTabsProps = {
  tabId: string;
};

export function SocketIOTabs({ tabId }: SocketIOTabsProps) {
  const { tabs, updateTabState } = useTabsStore();
  const { connections, emitSocketIoMessage } = useConnectionStore();
  const tab = tabs.find((t) => t.tabId === tabId);

  if (!tab || tab.type !== "socketio") return null;

  const eventName = tab.eventName ?? DEFAULT_EVENT_NAME;
  const draft = tab.draft ?? "";

  const conn = connections[tabId] ?? {
    isConnected: false,
    isConnecting: false,
    error: null,
  };

  function handleSend() {
    const ev = eventName.trim() || DEFAULT_EVENT_NAME;
    emitSocketIoMessage(tabId, ev, draft);
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
          data-testid="request-tab-socketio-messages"
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
          <div className="shrink-0 space-y-3 border-b border-border p-3">
            <div className="space-y-1.5">
              <Label htmlFor={`socketio-event-${tabId}`} className="text-xs">
                Event name
              </Label>
              <Input
                id={`socketio-event-${tabId}`}
                value={eventName}
                onChange={(e) =>
                  updateTabState(tabId, { eventName: e.target.value })
                }
                placeholder={DEFAULT_EVENT_NAME}
                className="h-8 font-mono text-xs"
                data-testid="socketio-event-input"
              />
            </div>
            <Textarea
              value={draft}
              onChange={(e) => updateTabState(tabId, { draft: e.target.value })}
              placeholder="Payload…"
              className="min-h-20 font-mono text-xs"
              data-testid="ws-message-input"
            />
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={!conn.isConnected}
              onClick={handleSend}
              data-testid="socketio-send-btn"
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
