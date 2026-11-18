import { DOCS_URL, LICENSE_URL, PRIVACY_PATH, TERMS_PATH } from "../constants";
import { APP_PATH, FEATURES_HUB_PATH } from "../data/links";
import {
  COMPARE_PAGES,
  FEATURE_PAGES,
  type FeatureSlug,
} from "../data/seoPages";

export interface FooterLinkItem {
  label: string;
  href: string;
  /** Opens in a new tab, for pages that live off this site. */
  external?: boolean;
}

export interface FooterColumnData {
  title: string;
  links: readonly FooterLinkItem[];
}

// h1s are too long for a footer column; Record keeps this complete when a page is added.
const FEATURE_LINK_LABELS: Record<FeatureSlug, string> = {
  relay: "Relay AI",
  "request-chains": "Request chains",
  "transform-playground": "Transform playground",
  "json-compare": "JSON compare",
  "json-visualize": "JSON visualizer",
  import: "Import",
  "collections-environments": "Collections and environments",
  "command-palette": "Command palette",
  "backup-restore": "Backup and restore",
};

export const PRODUCT_COLUMN: FooterColumnData = {
  title: "Product",
  links: [
    { label: "App", href: APP_PATH },
    { label: "Docs", href: DOCS_URL, external: true },
    { label: "License (MIT)", href: LICENSE_URL, external: true },
  ],
};

export const FEATURES_COLUMN: FooterColumnData = {
  title: "Features",
  links: [
    { label: "All features", href: FEATURES_HUB_PATH },
    ...FEATURE_PAGES.map((page) => ({
      label: FEATURE_LINK_LABELS[page.slug],
      href: page.route,
    })),
  ],
};

export const COMPARE_COLUMN: FooterColumnData = {
  title: "Compare",
  links: COMPARE_PAGES.map((page) => ({ label: page.h1, href: page.route })),
};

export const LEGAL_COLUMN: FooterColumnData = {
  title: "Legal",
  links: [
    { label: "Privacy", href: PRIVACY_PATH },
    { label: "Terms", href: TERMS_PATH },
  ],
};
