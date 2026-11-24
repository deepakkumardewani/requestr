import enCommon from "../../../messages/en/common.json";

type MessageTree = { [key: string]: string | MessageTree };

/**
 * Test-only stand-in for `useTranslations("common.feedback")`: the global next-intl stub
 * only knows top-level namespaces, so resolve dotted keys from the real English catalog.
 */
export function translateFeedback(
  key: string,
  values?: Record<string, string | number>,
): string {
  let node: string | MessageTree | undefined = enCommon.feedback as MessageTree;
  for (const part of key.split(".")) {
    node = typeof node === "object" ? node[part] : undefined;
  }
  if (typeof node !== "string") return key;
  return node.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(values?.[name]),
  );
}
