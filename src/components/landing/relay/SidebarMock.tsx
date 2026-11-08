import { DEMO_SIDEBAR, type RequestMethod } from "./scenarios";

const METHOD_COLORS: Record<RequestMethod, string> = {
  GET: "var(--method-get)",
  POST: "var(--method-post)",
  PUT: "var(--method-put)",
  DELETE: "var(--method-delete)",
};

interface SidebarMockProps {
  /** Badge label per request id; absent ids show no badge. */
  badges: ReadonlyMap<string, string>;
}

export function SidebarMock({ badges }: SidebarMockProps) {
  return (
    <div
      role="group"
      aria-label="Collections sidebar preview"
      className="rounded-lg border border-border/70 bg-background/40 p-3"
    >
      {DEMO_SIDEBAR.map((collection) => (
        <div key={collection.name} className="mb-3 last:mb-0">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            {collection.name}
          </p>
          <ul className="space-y-1">
            {collection.requests.map((request) => {
              const badge = badges.get(request.id);
              return (
                <li
                  key={request.id}
                  className="flex items-center gap-2 text-sm text-foreground/90"
                >
                  <span
                    className="w-12 shrink-0 font-mono text-[10px] font-semibold"
                    style={{ color: METHOD_COLORS[request.method] }}
                  >
                    {request.method}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {request.name}
                  </span>
                  {badge ? (
                    <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
                      {badge}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
