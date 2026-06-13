"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Braces,
  FileJson,
  FileUp,
  Moon,
  ScanSearch,
  Terminal,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  IMPORT_FORMAT_LABELS,
  type ImportScanResult,
  type ImportScanSuccess,
  SUPPORTED_IMPORT_FORMATS,
  scanCurlText,
  scanFileContent,
} from "@/lib/importScanner";
import { generateId } from "@/lib/utils";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useTabsStore } from "@/stores/useTabsStore";

type ImportDialogProps = {
  open: boolean;
  onClose: () => void;
};

type InputTab = "file" | "curl";
type DialogStep = "input" | "review";
type ScanState = "idle" | "scanning";

const FORMAT_ICONS = {
  postman: FileJson,
  insomnia: Moon,
  openapi: Braces,
  swagger: Braces,
  curl: Terminal,
} as const;

function resetInputState() {
  return {
    step: "input" as DialogStep,
    inputTab: "file" as InputTab,
    pendingFile: null as { name: string; text: string } | null,
    curlInput: "",
    scanState: "idle" as ScanState,
    scanError: null as string | null,
    scanResult: null as ImportScanSuccess | null,
  };
}

function SupportedFormats() {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Supported formats
      </p>
      <div className="flex flex-wrap gap-2">
        {SUPPORTED_IMPORT_FORMATS.map((format) => {
          const Icon = FORMAT_ICONS[format.id];
          return (
            <div
              key={format.id}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 px-2 py-1"
              title={format.hint}
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{format.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrustWarning() {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
      Make sure you trust the import source before continuing.
    </p>
  );
}

function ImportReviewSummary({ scan }: { scan: ImportScanSuccess }) {
  const formatLabel = IMPORT_FORMAT_LABELS[scan.format];

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <FileJson className="mt-0.5 h-4 w-4 shrink-0 text-theme-accent" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium leading-snug">
            {formatLabel} resources from{" "}
            <span className="font-mono text-xs">{scan.sourceLabel}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Review the summary below, then import when ready.
          </p>
        </div>
      </div>

      <ul className="space-y-1 text-sm">
        <li>
          {scan.summary.requestCount} request
          {scan.summary.requestCount === 1 ? "" : "s"}
        </li>
        {scan.summary.folderCount > 0 && (
          <li>
            {scan.summary.folderCount} folder
            {scan.summary.folderCount === 1 ? "" : "s"}
          </li>
        )}
        {scan.format === "insomnia" && scan.summary.collectionCount > 1 && (
          <li>{scan.summary.collectionCount} collections</li>
        )}
        {scan.format !== "curl" && (
          <li>
            Collection:{" "}
            <span className="font-medium">{scan.summary.primaryName}</span>
          </li>
        )}
        {scan.summary.additionalNames.length > 0 && (
          <li className="text-xs text-muted-foreground">
            Also: {scan.summary.additionalNames.join(", ")}
          </li>
        )}
        {scan.format === "curl" && (
          <li>
            Opens as a new tab:{" "}
            <span className="font-mono text-xs">
              {scan.summary.primaryName}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}

export function ImportDialog({ open, onClose }: ImportDialogProps) {
  const [state, setState] = useState(resetInputState);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { createCollection, addRequest, importParsedPostmanCollection } =
    useCollectionsStore();
  const openTab = useTabsStore((s) => s.openTab);

  function handleClose() {
    setState(resetInputState());
    onClose();
  }

  function handleBackToInput() {
    setState((prev) => ({
      ...prev,
      step: "input",
      scanState: "idle",
      scanError: null,
      scanResult: null,
    }));
  }

  function queueFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text !== "string") return;
      setState((prev) => ({
        ...prev,
        pendingFile: { name: file.name, text },
        scanError: null,
        scanResult: null,
        step: "input",
      }));
    };
    reader.readAsText(file);
  }

  function runScan(scanFn: () => ImportScanResult) {
    setState((prev) => ({ ...prev, scanState: "scanning", scanError: null }));
    const result = scanFn();
    if (!result.ok) {
      setState((prev) => ({
        ...prev,
        scanState: "idle",
        scanError: result.error,
        scanResult: null,
      }));
      return;
    }
    setState((prev) => ({
      ...prev,
      scanState: "idle",
      scanError: null,
      scanResult: result,
      step: "review",
    }));
  }

  function handleScan() {
    if (state.inputTab === "file") {
      const file = state.pendingFile;
      if (!file) {
        setState((prev) => ({
          ...prev,
          scanError: "Choose a file to scan first.",
        }));
        return;
      }
      runScan(() => scanFileContent(file.text, file.name));
      return;
    }

    if (state.inputTab === "curl") {
      if (!state.curlInput.trim()) {
        setState((prev) => ({
          ...prev,
          scanError: "Paste a cURL command to scan.",
        }));
        return;
      }
      runScan(() => scanCurlText(state.curlInput));
    }
  }

  function handleImport() {
    const scan = state.scanResult;
    if (!scan) return;

    switch (scan.payload.format) {
      case "postman":
        importParsedPostmanCollection(scan.payload.data);
        toast.success(
          `Imported "${scan.sourceLabel}" — ${scan.summary.requestCount} request${scan.summary.requestCount === 1 ? "" : "s"}`,
        );
        break;
      case "insomnia":
        importParsedPostmanCollection(scan.payload.data);
        toast.success(
          `Imported "${scan.sourceLabel}" — ${scan.summary.requestCount} request${scan.summary.requestCount === 1 ? "" : "s"}`,
        );
        break;
      case "openapi": {
        const collection = createCollection(scan.payload.collectionName);
        for (const req of scan.payload.requests) {
          addRequest(collection.id, {
            tabId: generateId(),
            requestId: null,
            isDirty: false,
            ...req,
          });
        }
        toast.success(
          `Imported "${scan.sourceLabel}" — ${scan.summary.requestCount} request${scan.summary.requestCount === 1 ? "" : "s"}`,
        );
        break;
      }
      case "curl": {
        const parsed = scan.payload.parsed;
        openTab({
          type: "http",
          name: `${parsed.method} request`,
          method: parsed.method,
          url: parsed.url,
          headers: parsed.headers,
          body: parsed.body,
          auth: parsed.auth,
        });
        toast.success("cURL imported — opened in new tab");
        break;
      }
    }

    handleClose();
  }

  const canScan =
    state.scanState !== "scanning" &&
    ((state.inputTab === "file" && state.pendingFile !== null) ||
      (state.inputTab === "curl" && state.curlInput.trim().length > 0));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-xl flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>
            {state.step === "review" ? "Review import" : "Import"}
          </DialogTitle>
          <DialogDescription>
            {state.step === "review"
              ? "Confirm what will be imported into your workspace."
              : "Scan a file or pasted content before importing."}
          </DialogDescription>
        </DialogHeader>

        {state.step === "review" && state.scanResult ? (
          <div className="flex flex-col gap-4 min-h-0">
            <ImportReviewSummary scan={state.scanResult} />
            <TrustWarning />
          </div>
        ) : (
          <div className="flex flex-col gap-4 min-h-0">
            <Tabs
              value={state.inputTab}
              onValueChange={(value) =>
                setState((prev) => ({
                  ...prev,
                  inputTab: value as InputTab,
                  scanError: null,
                }))
              }
            >
              <TabsList className="w-full">
                <TabsTrigger value="file" className="flex-1 gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  File
                </TabsTrigger>
                <TabsTrigger value="curl" className="flex-1 gap-1.5">
                  <Terminal className="h-3.5 w-3.5" />
                  cURL
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="mt-3">
                <div
                  className={`flex min-h-[180px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                    state.pendingFile
                      ? "border-theme-accent/40 bg-theme-accent/5"
                      : "border-border hover:border-theme-accent/40"
                  }`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) queueFile(file);
                  }}
                >
                  {state.pendingFile ? (
                    <>
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <FileJson className="h-4 w-4 text-theme-accent" />
                      </div>
                      <p className="text-sm font-medium">
                        {state.pendingFile.name}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 text-xs"
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            pendingFile: null,
                            scanError: null,
                          }))
                        }
                      >
                        Choose a different file
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium">
                        Drag and drop or{" "}
                        <button
                          type="button"
                          className="text-theme-accent hover:underline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          choose a file
                        </button>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Postman, Insomnia, OpenAPI, or Swagger
                      </p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".json,.yaml,.yml,application/json,text/yaml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) queueFile(file);
                      e.target.value = "";
                    }}
                  />
                </div>
              </TabsContent>

              <TabsContent value="curl" className="mt-3 space-y-2">
                <Textarea
                  className="min-h-[180px] font-mono text-xs resize-none break-all"
                  placeholder={`Paste cURL command…\ncurl -X GET 'https://api.example.com/v1/users' -H 'Authorization: Bearer TOKEN'`}
                  value={state.curlInput}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      curlInput: e.target.value,
                      scanError: null,
                    }))
                  }
                />
              </TabsContent>
            </Tabs>

            {state.scanError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {state.scanError}
              </p>
            )}

            <TrustWarning />
            <SupportedFormats />
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {state.step === "review" ? (
            <>
              <Button
                variant="ghost"
                className="gap-1.5"
                onClick={handleBackToInput}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                className="gap-1.5 bg-theme-accent text-[#0d1117] hover:bg-theme-accent/90"
                onClick={handleImport}
              >
                <FileUp className="h-3.5 w-3.5" />
                Import
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                className="gap-1.5 bg-theme-accent text-[#0d1117] hover:bg-theme-accent/90"
                disabled={!canScan}
                onClick={handleScan}
              >
                <ScanSearch className="h-3.5 w-3.5" />
                {state.scanState === "scanning" ? "Scanning…" : "Scan"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
