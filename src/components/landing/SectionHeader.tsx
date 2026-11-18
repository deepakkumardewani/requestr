import { cn } from "@/lib/utils";
import { SECTION_EYEBROW, SECTION_HEADING, SECTION_LEDE } from "./constants";

interface SectionHeaderProps {
  /** Id for the h2, referenced by the section's aria-labelledby. */
  titleId: string;
  eyebrow: string;
  title: string;
  lede?: string;
  className?: string;
}

/** Left-aligned eyebrow, heading and lede shared by the landing sections. */
export function SectionHeader({
  titleId,
  eyebrow,
  title,
  lede,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-10 max-w-2xl", className)}>
      <p className={cn(SECTION_EYEBROW, "font-mono")}>{eyebrow}</p>
      <h2 id={titleId} className={SECTION_HEADING}>
        {title}
      </h2>
      {lede ? <p className={SECTION_LEDE}>{lede}</p> : null}
    </div>
  );
}
