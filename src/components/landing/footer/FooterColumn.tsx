import { cn } from "@/lib/utils";
import { FooterLink } from "./FooterLink";
import type { FooterColumnData } from "./footerLinks";

interface FooterColumnProps {
  column: FooterColumnData;
  className?: string;
  /** Lets a long column flow into CSS columns. */
  listClassName?: string;
}

function headingId(title: string): string {
  return `footer-${title.toLowerCase()}`;
}

export function FooterColumn({
  column,
  className,
  listClassName,
}: FooterColumnProps) {
  const id = headingId(column.title);
  return (
    <div className={cn("space-y-4", className)}>
      <h3
        id={id}
        className="font-mono text-xs uppercase tracking-widest text-muted-foreground"
      >
        {column.title}
      </h3>
      {/* Bottom padding, not space-y, so items split cleanly across CSS columns. */}
      <ul aria-labelledby={id} className={listClassName}>
        {column.links.map((link) => (
          <li key={link.href} className="break-inside-avoid pb-2.5">
            <FooterLink {...link} />
          </li>
        ))}
      </ul>
    </div>
  );
}
