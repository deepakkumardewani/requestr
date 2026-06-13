"use client";

import { AnimatedContent, BorderGlow, GlareHover } from "@/components/reactbits";
import { FEATURES } from "./data/features";

/** Mini visual previews per feature — real UI representations, not icons */
function FeaturePreview({ id }: { id: string }) {
  switch (id) {
    case "multi-tab":
      return (
        <div className="flex gap-1 rounded-t-md bg-background/40 px-2 pt-2">
          <span className="rounded-t px-2 py-1 text-[10px] font-mono font-semibold text-emerald-400 bg-card border border-b-transparent border-border/60">GET /users</span>
          <span className="rounded-t px-2 py-1 text-[10px] font-mono text-muted-foreground/60">POST /auth</span>
          <span className="rounded-t px-2 py-1 text-[10px] font-mono text-muted-foreground/60">DELETE /42</span>
        </div>
      );
    case "env-vars":
      return (
        <div className="rounded-md bg-background/40 px-3 py-2 font-mono text-xs">
          <span className="text-muted-foreground/50">GET </span>
          <span className="text-purple-400">{"{{BASE_URL}}"}</span>
          <span className="text-muted-foreground">/users?token=</span>
          <span className="text-purple-400">{"{{API_KEY}}"}</span>
        </div>
      );
    case "collections":
      return (
        <div className="space-y-1 px-2 py-1 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-muted-foreground/70">
            <span>▾</span><span>📁 Auth</span>
          </div>
          <div className="flex items-center gap-1.5 pl-4 text-muted-foreground/50">
            <span className="text-blue-400">POST</span><span>/login</span>
          </div>
          <div className="flex items-center gap-1.5 pl-4 text-muted-foreground/50">
            <span className="text-blue-400">POST</span><span>/refresh</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground/70">
            <span>▾</span><span>📁 Users</span>
          </div>
          <div className="flex items-center gap-1.5 pl-4 text-muted-foreground/50">
            <span className="text-emerald-400">GET</span><span>/me</span>
          </div>
        </div>
      );
    case "response-viewer":
      return (
        <div className="rounded-md bg-[oklch(0.12_0.005_285)] px-3 py-2 font-mono text-xs space-y-0.5">
          <div className="flex gap-2 mb-1">
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">200</span>
            <span className="text-muted-foreground/40 text-[10px]">42 ms</span>
          </div>
          <div><span className="text-blue-400/80">"status"</span><span className="text-muted-foreground/40">: </span><span className="text-emerald-400/80">"ok"</span></div>
          <div><span className="text-blue-400/80">"count"</span><span className="text-muted-foreground/40">: </span><span className="text-amber-400/80">128</span></div>
        </div>
      );
    case "import-formats":
      return (
        <div className="flex flex-wrap gap-1.5 p-1">
          {["Postman", "Insomnia", "cURL"].map((fmt) => (
            <span key={fmt} className="rounded border border-border/50 bg-muted/50 px-2 py-1 text-[10px] font-medium text-muted-foreground">
              {fmt}
            </span>
          ))}
        </div>
      );
    case "method-theming":
      return (
        <div className="flex items-center gap-1.5 flex-wrap p-1">
          {[
            ["GET", "text-emerald-400", "bg-emerald-500/15"],
            ["POST", "text-blue-400", "bg-blue-500/15"],
            ["PUT", "text-amber-400", "bg-amber-500/15"],
            ["PATCH", "text-purple-400", "bg-purple-500/15"],
            ["DELETE", "text-red-400", "bg-red-500/15"],
          ].map(([m, text, bg]) => (
            <span key={m} className={`rounded px-2 py-0.5 text-[10px] font-mono font-semibold ${text} ${bg}`}>
              {m}
            </span>
          ))}
        </div>
      );
    default:
      return null;
  }
}

export function FeatureShowcase() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <AnimatedContent direction="up">
          <div className="mb-12 max-w-xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-widest text-muted-foreground/60">
              Features
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Everything you need.{" "}
              <span className="text-muted-foreground">Nothing you don't.</span>
            </h2>
          </div>
        </AnimatedContent>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => (
            <AnimatedContent key={feature.id} direction="up" delay={i * 0.07} duration={0.5}>
              <BorderGlow className="h-full">
                <GlareHover
                  className="h-full rounded-[inherit] bg-card"
                  glareColor="rgba(255,255,255,0.06)"
                >
                <div className="flex h-full flex-col p-4">
                  {/* Mini visual preview */}
                  <div className="mb-4 overflow-hidden rounded-lg border border-border/50 bg-background/50 min-h-[72px] flex items-center">
                    <FeaturePreview id={feature.id} />
                  </div>

                  <h3 className="mb-1.5 font-display text-base font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
                </GlareHover>
              </BorderGlow>
            </AnimatedContent>
          ))}
        </div>
      </div>
    </section>
  );
}
