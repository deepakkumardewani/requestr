import { METHOD_BADGE_CLASSES, METHOD_PALETTE } from "@/lib/constants";
import type { HttpMethod } from "@/types";

/** Returns `rgb(r g b)` string for a given HTTP method. */
export function methodRgb(method: HttpMethod): string {
  const { r, g, b } = METHOD_PALETTE[method];
  return `rgb(${r} ${g} ${b})`;
}

/** Maps each method to its CSS variable name defined in globals.css. */
export const METHOD_CSS_VAR: Record<HttpMethod, string> = {
  GET: "--method-get",
  POST: "--method-post",
  PUT: "--method-put",
  PATCH: "--method-patch",
  DELETE: "--method-delete",
  HEAD: "--method-head",
  OPTIONS: "--method-options",
};

export { METHOD_PALETTE, METHOD_BADGE_CLASSES };
