import type { Shortcut } from "@/app/settings/constants";
import { ShortcutKeys } from "@/components/common/ShortcutKeys";

type ShortcutRowProps = {
  shortcut: Shortcut;
  onMac: boolean;
  /** Text shown for the action; callers pass the localized label. */
  label: string;
  /** Optional caveat (e.g. browser conflicts) rendered under the row. */
  note?: string;
  /** Tighter vertical padding for surfaces that must fit many rows on screen. */
  dense?: boolean;
};

export function ShortcutRow({
  shortcut,
  onMac,
  label,
  note,
  dense = false,
}: ShortcutRowProps) {
  return (
    <div>
      <div
        className={`flex items-center justify-between px-4 ${dense ? "py-1" : "py-2.5"}`}
      >
        <span className="text-sm">{label}</span>
        <ShortcutKeys shortcut={shortcut} onMac={onMac} />
      </div>
      {note ? (
        <p
          className={`px-4 text-xs text-muted-foreground ${dense ? "pb-1.5" : "-mt-1.5 pb-2.5"}`}
          data-testid="shortcut-note"
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}
