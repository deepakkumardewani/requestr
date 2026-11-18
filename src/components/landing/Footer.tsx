import Link from "next/link";
import { cn } from "@/lib/utils";
import { SECTION_CONTAINER, SECTION_DIVIDER } from "./constants";
import { HOME_PATH } from "./data/links";
import { BRAND_TAGLINE, COPYRIGHT_HOLDER } from "./footer/constants";
import { FooterColumn } from "./footer/FooterColumn";
import { FooterSignOff } from "./footer/FooterSignOff";
import { FooterWordmark } from "./footer/FooterWordmark";
import {
  COMPARE_COLUMN,
  FEATURES_COLUMN,
  LEGAL_COLUMN,
  PRODUCT_COLUMN,
} from "./footer/footerLinks";
import { LINK_INTERACTIVE } from "./interactionStyles";

function FooterBrand() {
  return (
    <div className="col-span-2 space-y-3 sm:col-span-4 lg:col-span-3">
      <Link
        href={HOME_PATH}
        className={cn(
          LINK_INTERACTIVE,
          "font-display text-lg font-bold tracking-tight text-foreground hover:opacity-80 active:opacity-100",
        )}
      >
        Requestr
      </Link>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        {BRAND_TAGLINE}
      </p>
    </div>
  );
}

export function Footer() {
  return (
    <footer className={cn(SECTION_DIVIDER, "bg-muted/20")}>
      <div className={cn(SECTION_CONTAINER, "pt-14 sm:pt-16")}>
        {/* The long Features list sits beside the short columns, which stack
            together, so no column leaves a tall empty gap. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:grid-cols-12">
          <FooterBrand />
          <FooterColumn column={PRODUCT_COLUMN} className="lg:col-span-2" />
          <FooterColumn
            column={FEATURES_COLUMN}
            className="row-span-2 sm:col-span-2 sm:row-span-1 lg:col-span-5"
            listClassName="lg:columns-2 lg:gap-x-6"
          />
          <div className="space-y-10 lg:col-span-2">
            <FooterColumn column={COMPARE_COLUMN} />
            <FooterColumn column={LEGAL_COLUMN} />
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-border/50 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {COPYRIGHT_HOLDER}
          </p>
          <FooterSignOff />
        </div>
      </div>
      <FooterWordmark />
    </footer>
  );
}
