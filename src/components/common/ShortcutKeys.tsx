import type { Shortcut } from "@/app/settings/constants";
import { Kbd } from "@/components/ui/kbd";
import { getAliasKeyParts, getShortcutKeyParts } from "@/lib/shortcutFormat";

function KeyCaps({ parts }: { parts: string[] }) {
  return (
    <div className="flex items-center gap-0.5">
      {parts.map((part) => (
        <Kbd key={part}>{part}</Kbd>
      ))}
    </div>
  );
}

type ShortcutKeysProps = {
  shortcut: Shortcut;
  onMac: boolean;
};

/** Key caps for a shortcut's primary chord followed by its aliases. */
export function ShortcutKeys({ shortcut, onMac }: ShortcutKeysProps) {
  return (
    <div className="flex items-center gap-1.5">
      <KeyCaps parts={getShortcutKeyParts(shortcut, onMac)} />
      {shortcut.aliases?.map((alias) => (
        <div key={alias.key} className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">/</span>
          <KeyCaps parts={getAliasKeyParts(alias, onMac)} />
        </div>
      ))}
    </div>
  );
}
