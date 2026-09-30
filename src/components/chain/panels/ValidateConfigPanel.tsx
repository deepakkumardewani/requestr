"use client";

import { ShieldCheck, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ValidateBlock } from "@/types/chain";

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

export function ValidateConfigPanel({
  open,
  node,
  onClose,
  onSave,
  onDelete,
}: ValidateConfigPanelProps) {
  const [schema, setSchema] = useState("");
  const [sourceJsonPath, setSourceJsonPath] = useState("");

  useEffect(() => {
    if (!node) return;
    setSchema(node.schema);
    setSourceJsonPath(node.sourceJsonPath);
  }, [node]);

  if (!node) return null;

  function handleSave() {
    if (!node) return;
    onSave({ ...node, schema, sourceJsonPath: sourceJsonPath.trim() });
    onClose();
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent side="right" className="w-[440px] flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Configure Validate
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Source JSONPath */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Source JSONPath
            </Label>
            <Input
              value={sourceJsonPath}
              onChange={(e) => setSourceJsonPath(e.target.value)}
              placeholder="$.data.token (blank validates the whole response)"
              className="h-8 text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground leading-snug">
              Leave blank to validate the upstream response body as a whole.
            </p>
          </div>

          {/* Schema */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">JSON Schema</Label>
            <div className="h-64 overflow-hidden rounded-md border border-border">
              <CodeEditor
                value={schema}
                onChange={setSchema}
                language="json"
                placeholder='{"type": "object", "required": ["id"]}'
              />
            </div>
            <p className="text-[10px] text-muted-foreground leading-snug">
              A JSON-Schema document. Validation fails with the first three
              errors.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onClose}
          >
            Cancel
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              onDelete(node.id);
              onClose();
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete node
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
