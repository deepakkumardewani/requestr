import type { InjectionTargetField } from "@/types/chain";

/** Message keys (namespace `chain`) for the key-input label of each injection target. */
export const TARGET_FIELD_LABEL_KEYS = {
  url: "injectionEditorTargetLabelUrl",
  path: "injectionEditorTargetLabelPath",
  header: "injectionEditorTargetLabelHeader",
  body: "injectionEditorTargetLabelBody",
} as const satisfies Record<InjectionTargetField, string>;

/** Message keys (namespace `chain`) for the short field-selector button of each injection target. */
export const TARGET_FIELD_BUTTON_KEYS = {
  url: "injectionEditorFieldQuery",
  path: "injectionEditorFieldPath",
  header: "injectionEditorFieldHeader",
  body: "injectionEditorFieldBody",
} as const satisfies Record<InjectionTargetField, string>;
