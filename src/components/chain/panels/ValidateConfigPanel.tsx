"use client";

import { AlertCircle, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ValidateBlock } from "@/types/chain";
import { ConfigPanelShell } from "./ConfigPanelShell";
import { JSON_SCHEMA_PLACEHOLDER } from "./schemaPlaceholder";
import { useSyncOnNode } from "./useSyncOnNode";

const CodeEditor = dynamic(() => import("@/components/request/CodeEditor"), {
  ssr: false,
});

type ValidateConfigPanelProps = {
  open: boolean;
  node: ValidateBlock | null;
  onClose: () => void;
  onSave: (node: ValidateBlock) => void;
  onDelete: (nodeId: string) => void;
};

/** Save-time guard: the schema must parse as a JSON object (or boolean schema). */
function isSchemaDocument(schema: string): boolean {
  try {
    const parsed: unknown = JSON.parse(schema);
    return typeof parsed === "object" && parsed !== null
      ? !Array.isArray(parsed)
      : typeof parsed === "boolean";
  } catch {
    // Unparseable draft is an expected invalid state, surfaced by disabling Save.
    return false;
  }
}

export function ValidateConfigPanel({
  open,
  node,
  onClose,
  onSave,
  onDelete,
}: ValidateConfigPanelProps) {
  const t = useTranslations("chain");
  const [schema, setSchema] = useState("");
  const [sourceJsonPath, setSourceJsonPath] = useState("");

  useSyncOnNode(node, (n) => {
    setSchema(n.schema);
    setSourceJsonPath(n.sourceJsonPath);
  });

  if (!node) return null;

  const schemaValid = isSchemaDocument(schema);
  // Blank is the untouched initial state; only flag a draft the user typed.
  const showSchemaError = schema.trim() !== "" && !schemaValid;

  function handleSave() {
    if (!node || !schemaValid) return;
    onSave({ ...node, schema, sourceJsonPath: sourceJsonPath.trim() });
  }

  return (
    <ConfigPanelShell
      open={open}
      title={t("validateConfigTitle")}
      icon={ShieldCheck}
      iconClassName="text-emerald-400"
      widthClass="w-[440px]"
      canSave={schemaValid}
      saveButtonTestId="validate-config-save-btn"
      onSave={handleSave}
      onDelete={() => onDelete(node.id)}
      onClose={onClose}
    >
      {/* Source JSONPath */}
      <div data-testid="validate-config-form" className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("validateConfigSourceLabel")}
        </Label>
        <Input
          data-testid="validate-config-source-path"
          value={sourceJsonPath}
          onChange={(e) => setSourceJsonPath(e.target.value)}
          placeholder={t("validateConfigSourcePlaceholder")}
          className="h-8 text-sm font-mono"
        />
        <p className="text-[10px] text-muted-foreground leading-snug">
          {t("validateConfigSourceHint")}
        </p>
      </div>

      {/* Schema */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          {t("validateConfigSchemaLabel")}
        </Label>
        <div
          data-testid="validate-config-schema"
          className="h-64 overflow-hidden rounded-md border border-border"
        >
          <CodeEditor
            value={schema}
            onChange={setSchema}
            language="json"
            placeholder={JSON_SCHEMA_PLACEHOLDER}
          />
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          {t("validateConfigSchemaHint")}
        </p>
        {showSchemaError && (
          <p
            role="alert"
            className="flex items-center gap-1 text-[10px] text-destructive leading-snug"
          >
            <AlertCircle className="h-3 w-3 shrink-0" />
            {t("validateConfigSchemaInvalid")}
          </p>
        )}
      </div>
    </ConfigPanelShell>
  );
}
