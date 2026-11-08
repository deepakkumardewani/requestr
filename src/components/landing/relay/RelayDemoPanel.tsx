"use client";

import { useEffect, useRef, useState } from "react";
import { ChangeCardMock } from "./ChangeCardMock";
import { getAppliedBadges } from "./relayDemoEngine";
import { SidebarMock } from "./SidebarMock";
import { useRelayDemo } from "./useRelayDemo";

export function RelayDemoPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scenario, frame, isStatic } = useRelayDemo(containerRef);
  const [undone, setUndone] = useState<{
    scenarioId: string;
    ids: Set<string>;
  }>({ scenarioId: scenario.id, ids: new Set() });

  // Undo choices belong to one scenario; reset when the loop moves on.
  useEffect(() => {
    setUndone((prev) =>
      prev.scenarioId === scenario.id
        ? prev
        : { scenarioId: scenario.id, ids: new Set() },
    );
  }, [scenario.id]);

  function toggleUndo(cardId: string) {
    setUndone((prev) => {
      const ids = new Set(prev.ids);
      if (!ids.delete(cardId)) ids.add(cardId);
      return { ...prev, ids };
    });
  }

  const undoneIds =
    undone.scenarioId === scenario.id ? undone.ids : new Set<string>();
  const badges = getAppliedBadges(
    scenario.cards,
    frame.visibleCards,
    undoneIds,
  );
  const typing = !isStatic && frame.promptText.length < scenario.prompt.length;

  return (
    <div
      ref={containerRef}
      className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-6 md:grid-cols-[1fr_16rem]"
    >
      <div className="min-w-0 space-y-3">
        <div
          role="group"
          aria-label="Relay prompt"
          className="min-h-[3.5rem] rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-sm text-foreground/90"
        >
          {frame.promptText}
          {typing ? (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-foreground"
            />
          ) : null}
        </div>
        <p
          aria-live="off"
          className="min-h-[4.5rem] text-sm leading-relaxed text-muted-foreground"
        >
          {frame.replyText}
        </p>
        <div className="space-y-2">
          {scenario.cards.slice(0, frame.visibleCards).map((card) => (
            <ChangeCardMock
              key={card.id}
              card={card}
              undone={undoneIds.has(card.id)}
              onToggleUndo={toggleUndo}
            />
          ))}
        </div>
      </div>
      <SidebarMock badges={badges} />
    </div>
  );
}
