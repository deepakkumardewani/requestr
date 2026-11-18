import {
  SIGN_OFF_LINE,
  SIGN_OFF_STATUS_CODE,
  SIGN_OFF_STATUS_TEXT,
} from "./constants";

/** The page's closing status line, styled like a response status in the app. */
export function FooterSignOff() {
  return (
    <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-[var(--landing-accent)] shadow-[0_0_8px_var(--landing-accent)]"
      />
      <span className="font-medium text-compare-accent">
        {SIGN_OFF_STATUS_CODE} {SIGN_OFF_STATUS_TEXT}
      </span>
      <span aria-hidden="true">·</span>
      <span>{SIGN_OFF_LINE}</span>
    </p>
  );
}
