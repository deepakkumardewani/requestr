"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const PROMPT = "generate body for POST /orders";
const GENERATED_BODY = `{
  "productId": "sku_1042",
  "quantity": 2,
  "shippingMethod": "standard"
}`;

export function AiVisual() {
  const reduced = useReducedMotion();
  const [showResult, setShowResult] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(() => setShowResult(true), 900);
    return () => clearTimeout(timer);
  }, [reduced]);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/40 px-3 py-2">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            backgroundColor: "var(--landing-accent, var(--method-get))",
          }}
        />
        <span className="truncate font-mono text-sm text-foreground/90">
          {PROMPT}
        </span>
      </div>
      <pre
        className={`mt-3 overflow-x-auto rounded-lg border border-border/60 bg-background/60 p-3 font-mono text-xs leading-relaxed text-muted-foreground transition-opacity duration-500 motion-safe:duration-500 ${
          showResult ? "opacity-100" : "opacity-0"
        }`}
      >
        {GENERATED_BODY}
      </pre>
    </div>
  );
}
