import { cn } from "@/lib/utils";

type RelayLogoProps = {
  className?: string;
  /**
   * Accessible name for when the logo is the only content of a control.
   * Omit it next to text: the logo is then decorative and hidden from assistive tech.
   */
  label?: string;
};

/** Paper-plane mark of Relay, drawn with `currentColor` so it follows the theme. */
export function RelayLogo({ className, label }: RelayLogoProps) {
  return (
    <svg
      data-testid="relay-logo"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("size-4 shrink-0", className)}
      role={label ? "img" : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    >
      {label ? <title>{label}</title> : null}
      <path d="M21.5 2.5 2.5 10l7 3.2 12-10.7Z" />
      <path d="m9.5 13.2 2 7.8 10-18.5" />
      <path d="m9.5 13.2 5 4" />
    </svg>
  );
}
