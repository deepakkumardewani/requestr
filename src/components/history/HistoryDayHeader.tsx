type HistoryDayHeaderProps = {
  label: string;
};

export function HistoryDayHeader({ label }: HistoryDayHeaderProps) {
  return (
    <div
      role="heading"
      aria-level={3}
      data-testid="history-day-header"
      className="sticky top-0 z-10 bg-background px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
    >
      {label}
    </div>
  );
}
