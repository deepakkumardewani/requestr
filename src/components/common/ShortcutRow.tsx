import type { Shortcut } from "@/app/settings/constants";
import { ShortcutKeys } from "@/components/common/ShortcutKeys";

type ShortcutRowProps = {
  shortcut: Shortcut;
  onMac: boolean;
  /** Text shown for the action; callers pass the localized label. */
  label: string;
};

export function ShortcutRow({ shortcut, onMac, label }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-sm">{label}</span>
      <ShortcutKeys shortcut={shortcut} onMac={onMac} />
    </div>
  );
}
