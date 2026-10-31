/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_REDACT_CONTEXT } from "../redact";
import { createFakeStoreAccess } from "../storeAccess";
import { navigationTools } from "./navigationTools";
import { createRegistry, executeTool } from "./registry";
import { NAVIGATION_TOOLS, OPEN_PAGES, SIDEBAR_TABS } from "./schemas";

const registry = createRegistry(navigationTools);

function run(name: string, input: unknown, navigate?: (href: string) => void) {
  return executeTool(registry, name, input, {
    store: createFakeStoreAccess().access,
    redact: DEFAULT_REDACT_CONTEXT,
    navigate,
  });
}

describe("open_page", () => {
  const ROUTES: Record<string, string> = {
    app: "/app",
    import: "/import",
    environments: "/environments",
    "json-compare": "/json-compare",
    "json-visualize": "/json-visualize",
    transform: "/transform",
  };

  it.each(Object.entries(ROUTES))("[success] %s navigates to %s", async (page, href) => {
    const navigate = vi.fn();
    const out = await run("open_page", { page, section: null }, navigate);
    expect(out).toEqual({ ok: true, data: { href, summary: `Opened ${page}` } });
    expect(navigate).toHaveBeenCalledExactlyOnceWith(href);
  });

  it("[success] covers every page the schema offers", () => {
    expect([...Object.keys(ROUTES), "settings"].sort()).toEqual([...OPEN_PAGES].sort());
  });

  it("[success] settings without a section opens the bare page", async () => {
    const navigate = vi.fn();
    const out = await run("open_page", { page: "settings", section: null }, navigate);
    expect(out).toEqual({ ok: true, data: { href: "/settings", summary: "Opened settings" } });
    expect(navigate).toHaveBeenCalledWith("/settings");
  });

  it("[success] settings with a section carries it as the hash", async () => {
    const navigate = vi.fn();
    const out = await run("open_page", { page: "settings", section: "appearance" }, navigate);
    expect(out).toMatchObject({ ok: true, data: { href: "/settings#appearance" } });
    expect(navigate).toHaveBeenCalledWith("/settings#appearance");
  });

  it("[success] still answers when no navigate callback is wired", async () => {
    expect(await run("open_page", { page: "import", section: null })).toMatchObject({
      ok: true,
      data: { href: "/import" },
    });
  });

  it("[invalid] rejects a section on a page that is not settings", async () => {
    const navigate = vi.fn();
    const out = await run("open_page", { page: "import", section: "proxy" }, navigate);
    expect(out).toEqual({ ok: false, error: expect.stringContaining("settings") });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("[invalid] rejects an unknown page, unknown section and extra keys", async () => {
    const navigate = vi.fn();
    expect((await run("open_page", { page: "billing", section: null }, navigate)).ok).toBe(false);
    expect((await run("open_page", { page: "settings", section: "nope" }, navigate)).ok).toBe(false);
    expect((await run("open_page", { page: "app", section: null, extra: 1 }, navigate)).ok).toBe(false);
    expect((await run("open_page", { page: "app" }, navigate)).ok).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("show_sidebar_tab", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  function mountSidebar() {
    document.body.innerHTML = `
      <div role="tablist">
        <button role="tab" data-testid="sidebar-tab-collections"></button>
        <button role="tab" data-testid="sidebar-tab-history"></button>
        <button role="tab" data-testid="sidebar-tab-hub"></button>
      </div>`;
    const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')];
    const clicks = tabs.map(() => vi.fn());
    tabs.forEach((tab, index) => tab.addEventListener("click", clicks[index]));
    return clicks;
  }

  it.each(SIDEBAR_TABS.map((tab, index) => [tab, index] as const))(
    "[success] %s presses only its own tab",
    async (tab, index) => {
      const clicks = mountSidebar();
      const out = await run("show_sidebar_tab", { tab });
      expect(out).toEqual({ ok: true, data: { tab, summary: `Showed the ${tab} tab` } });
      clicks.forEach((click, i) => expect(click).toHaveBeenCalledTimes(i === index ? 1 : 0));
    },
  );

  it("[invalid] fails when the left panel is not on screen", async () => {
    const out = await run("show_sidebar_tab", { tab: "history" });
    expect(out).toEqual({ ok: false, error: expect.stringContaining("not on screen") });
  });

  it("[invalid] fails when the anchor is outside a tab list", async () => {
    document.body.innerHTML = '<button data-testid="sidebar-tab-collections"></button>';
    expect((await run("show_sidebar_tab", { tab: "hub" })).ok).toBe(false);
  });

  it("[invalid] rejects an unknown tab", async () => {
    mountSidebar();
    expect((await run("show_sidebar_tab", { tab: "settings" })).ok).toBe(false);
    expect((await run("show_sidebar_tab", {})).ok).toBe(false);
  });
});

describe("registration", () => {
  it("registers both new tools and lists them as navigation tools", () => {
    expect(navigationTools.map((tool) => tool.name)).toEqual(["open_page", "show_sidebar_tab"]);
    for (const tool of navigationTools) {
      expect(NAVIGATION_TOOLS).toContain(tool.name);
    }
  });
});
