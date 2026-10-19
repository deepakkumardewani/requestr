"use client";

import type { UIMessage } from "ai";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useRelayChat } from "@/hooks/useRelayChat";
import { useRelayFocus } from "@/hooks/useRelayFocus";
import {
  RELAY_CLOSE_DURATION_MS,
  RELAY_MAX_WIDTH_VW,
  RELAY_MIN_WIDTH_PX,
  RELAY_OPEN_DURATION_MS,
} from "@/lib/relay/constants";
import { messageText } from "@/lib/relay/messageText";
import { trackRelayEvent } from "@/lib/relay/telemetry";
import { cn } from "@/lib/utils";
import { useRelayStore } from "@/stores/useRelayStore";
import { ErrorBubble } from "./ErrorBubble";
import { RelayComposer } from "./RelayComposer";
import { RelayConversation } from "./RelayConversation";
import { RelayHeader } from "./RelayHeader";
import { RelayOnboarding } from "./RelayOnboarding";
import { ResizeHandle } from "./ResizeHandle";

export type RelayDockVariant = "aside" | "sheet";

type RelayDockProps = {
  variant: RelayDockVariant;
};

const SAFE_AREA_STYLE = {
  paddingTop: "env(safe-area-inset-top)",
  paddingBottom: "env(safe-area-inset-bottom)",
} as const;

const ASIDE_BOUNDS_STYLE = {
  minWidth: RELAY_MIN_WIDTH_PX,
  maxWidth: `${RELAY_MAX_WIDTH_VW}vw`,
} as const;

function lastUserMessageText(messages: UIMessage[]): string | null {
  const last = messages.findLast((message) => message.role === "user");
  const text = last ? messageText(last) : "";
  return text || null;
}

export function RelayDock({ variant }: RelayDockProps) {
  const t = useTranslations("relay");
  const open = useRelayStore((s) => s.open);
  const width = useRelayStore((s) => s.width);
  const setOpen = useRelayStore((s) => s.setOpen);
  const setWidth = useRelayStore((s) => s.setWidth);
  const dockRef = useRef<HTMLElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const chat = useRelayChat();
  const [draft, setDraft] = useState("");
  const composerPrefill = useRelayStore((s) => s.composerPrefill);
  const lastUserText = lastUserMessageText(chat.messages);

  // An entry point (Open in Relay) hands text over through the store.
  useEffect(() => {
    if (composerPrefill === null) return;
    setDraft(composerPrefill);
    useRelayStore.getState().clearComposerPrefill();
  }, [composerPrefill]);
  const focusRequest = useRelayStore((s) => s.focusRequest);
  const errorCode = chat.error?.code;

  // Count a closed-to-open change the user asked for. focusRequest stays 0
  // when `open` is restored from storage, so a reload never counts.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current && focusRequest > 0) {
      trackRelayEvent("relay_opened", {});
    }
    wasOpenRef.current = open;
  }, [open, focusRequest]);

  useEffect(() => {
    if (errorCode) trackRelayEvent("relay_error", { code: errorCode });
  }, [errorCode]);

  const handleSend = (text: string) => {
    trackRelayEvent("relay_message_sent", { length: text.length });
    chat.send(text);
  };

  const handleResolveTool: typeof chat.resolveTool = (
    toolCallId,
    resolution,
  ) => {
    if (resolution.kind === "decline") {
      trackRelayEvent("relay_confirm_declined", {});
    }
    chat.resolveTool(toolCallId, resolution);
  };
  const generating = chat.status === "submitted" || chat.status === "streaming";

  const handleEditMessage = () => {
    if (lastUserText) setDraft(lastUserText);
    chat.clearError();
    composerRef.current?.focus();
  };

  useRelayFocus({ dockRef, composerRef, twoStepEscape: variant === "aside" });

  const isSheet = variant === "sheet";
  const body = (
    <>
      <RelayHeader onClose={() => setOpen(false)} touchTargets={isSheet} />
      {open ? <RelayOnboarding /> : null}
      <RelayConversation
        messages={chat.messages}
        status={chat.status}
        interruptedMessageId={chat.interruptedMessageId}
        onRegenerate={chat.regenerate}
        onEditResend={chat.editAndResend}
        onSendPrompt={handleSend}
        onResolveTool={handleResolveTool}
        aria-label={t("messagesLabel")}
      />
      <div className="flex shrink-0 flex-col gap-2 border-t p-3">
        {chat.error ? (
          <ErrorBubble
            error={chat.error}
            online={chat.online}
            onRetry={chat.regenerate}
            onEditMessage={handleEditMessage}
          />
        ) : null}
        <RelayComposer
          value={draft}
          onValueChange={setDraft}
          onSend={handleSend}
          onStop={chat.stop}
          generating={generating}
          online={chat.online}
          lastUserText={lastUserText}
          textareaRef={composerRef}
          touchTargets={isSheet}
          threadHasMessages={chat.messages.length > 0}
        />
      </div>
    </>
  );

  if (isSheet) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          aria-label={t("title")}
          data-testid="relay-dock"
          initialFocus={composerRef}
          style={SAFE_AREA_STYLE}
          className="data-[side=right]:w-full data-[side=right]:max-w-none data-[side=right]:sm:max-w-none gap-0 overflow-x-hidden"
        >
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      ref={dockRef}
      aria-label={t("title")}
      data-testid="relay-dock"
      data-state={open ? "open" : "closed"}
      // `inert` takes a closed dock out of the tab order and the a11y tree
      // while it stays mounted for the exit transition.
      inert={!open}
      style={{
        ...ASIDE_BOUNDS_STYLE,
        width,
        transitionDuration: `${open ? RELAY_OPEN_DURATION_MS : RELAY_CLOSE_DURATION_MS}ms`,
      }}
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex flex-col border-l bg-background shadow-lg transition-[transform,visibility] ease-in-out motion-reduce:transition-none",
        open ? "visible translate-x-0" : "invisible translate-x-full",
      )}
    >
      <ResizeHandle width={width} onWidthChange={setWidth} />
      {body}
    </aside>
  );
}
