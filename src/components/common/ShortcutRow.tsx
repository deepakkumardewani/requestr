import type { Shortcut } from "@/app/settings/constants";
import { ShortcutKeys } from "@/components/common/ShortcutKeys";

type ShortcutRowProps = {
  shortcut: Shortcut;
  onMac: boolean;
  /** Text shown for the action; callers pass the localized label. */
  label: string;
  /** Optional caveat (e.g. browser conflicts) rendered under the row. */
  note?: string;
};

export function ShortcutRow({
  shortcut,
  onMac,
  label,
  note,
}: ShortcutRowProps) {
  return (
    <div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-sm">{label}</span>
        <ShortcutKeys shortcut={shortcut} onMac={onMac} />
      </div>
      {note ? (
        <p
          className="-mt-1.5 px-4 pb-2.5 text-xs text-muted-foreground"
          data-testid="shortcut-note"
        >
          {note}
        </p>
      ) : null}
    </div>
  );
}
