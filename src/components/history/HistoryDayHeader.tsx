type HistoryDayHeaderProps = {
  label: string;
};

export function HistoryDayHeader({ label }: HistoryDayHeaderProps) {
  return (
    <div
      role="heading"
      aria-level={3}
      data-testid="history-day-header"
      className="sticky top-0 z-10 bg-sidebar px-2 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70"
    >
      {label}
    </div>
  );
}
