"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { HeadersEditor } from "../HeadersEditor";
import { MessageLog } from "../MessageLog";

type SocketIOTabsProps = {
  tabId: string;
};

export function SocketIOTabs({ tabId }: SocketIOTabsProps) {
  const { tabs, updateTabState } = useTabsStore();
  const { connections, emitSocketIoMessage } = useConnectionStore();
  const tab = tabs.find((t) => t.tabId === tabId);
  const [eventName, setEventName] = useState("message");
  const [draft, setDraft] = useState("");

  if (!tab || tab.type !== "socketio") return null;

  const conn = connections[tabId] ?? {
    isConnected: false,
    isConnecting: false,
    error: null,
  };

  function handleSend() {
    if (!draft.trim()) return;
    const ev = eventName.trim() || "message";
    emitSocketIoMessage(tabId, ev, draft);
    setDraft("");
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
            {conn.error && (
              <p
                role="alert"
                className="text-xs text-destructive"
                data-testid="socketio-error"
              >
                {conn.error}
              </p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor={`socketio-event-${tabId}`} className="text-xs">
                Event name
              </Label>
              <Input
                id={`socketio-event-${tabId}`}
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="message"
                className="h-8 font-mono text-xs"
                data-testid="socketio-event-input"
              />
            </div>
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
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
