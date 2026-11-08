import type { ChangeCard } from "./scenarios";

const UNDO_TARGET_MIN_SIZE = "min-h-11 min-w-11";

interface ChangeCardMockProps {
  card: ChangeCard;
  undone: boolean;
  onToggleUndo: (cardId: string) => void;
}

export function ChangeCardMock({
  card,
  undone,
  onToggleUndo,
}: ChangeCardMockProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium text-foreground ${undone ? "line-through opacity-60" : ""}`}
        >
          {card.title}
        </p>
        <p className="truncate font-mono text-xs text-muted-foreground">
          {card.detail}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onToggleUndo(card.id)}
        className={`${UNDO_TARGET_MIN_SIZE} shrink-0 rounded-md border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
      >
        {undone ? "Redo" : "Undo"}
      </button>
    </div>
  );
}
