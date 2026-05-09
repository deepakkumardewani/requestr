"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SaveRequestModal } from "@/components/collections/SaveRequestModal";
import { CommandPalette } from "@/components/common/CommandPalette";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useCloseTabGuard } from "@/hooks/useCloseTabGuard";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useMethodTheme } from "@/hooks/useMethodTheme";
import { useSaveRequest } from "@/hooks/useSaveRequest";
import { useThemeAccent } from "@/hooks/useThemeAccent";
import { fetchSharePayload } from "@/lib/shareLink";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";
import { LeftPanel } from "./LeftPanel";
import { MobileDesktopNotice } from "./MobileDesktopNotice";
import { RightPanel } from "./RightPanel";

export function MainLayout() {
  const tCommon = useTranslations("common");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { openTab, tabs } = useTabsStore();

  const {
    saveModalOpen,
    setSaveModalOpen,
    setIsCreatingCollection,
    setPendingBulkClose,
    keyboardShortcutsOpen,
    setKeyboardShortcutsOpen,
  } = useUIStore();
  const { save, activeTab } = useSaveRequest();
  const { handleCloseTab } = useCloseTabGuard();
  const { closeAllTabs } = useTabsStore();
  function handleCloseActiveTab() {
    if (activeTab) handleCloseTab(activeTab);
  }

  function handleCloseAllTabs() {
    const hasDirty = tabs.some((t) => t.isDirty);
    if (hasDirty) {
      setPendingBulkClose({ kind: "all" });
    } else {
      closeAllTabs();
    }
  }

  const activeMethod = activeTab?.type === "http" ? activeTab.method : "GET";

  // Prevent closing the browser tab when there are unsaved changes
  useEffect(() => {
    const hasDirty = tabs.some((t) => t.isDirty);
    if (!hasDirty) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [tabs]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hydrate a tab from `?s=` + `#key` share links, or drop legacy `?r=` from the URL
  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const shareId = search.get("s");
    if (shareId) {
      const id = shareId;
      async function importFromShareQuery() {
        const payload = await fetchSharePayload(id);
        if (payload) {
          openTab({
            type: "http",
            name: `${payload.method} ${payload.url || "Shared Request"}`,
            method: payload.method,
            url: payload.url,
            headers: payload.headers,
            params: payload.params,
            body: payload.body,
            auth: payload.auth,
          });
          toast.success("Request loaded from shared link");
        } else {
          toast.error("Could not open shared request");
        }
        const u = new URL(window.location.href);
        u.searchParams.delete("s");
        u.hash = "";
        const qs = u.search;
        const next = qs.length > 0 ? `${u.pathname}${qs}` : u.pathname;
        history.replaceState({}, "", next);
      }
      void importFromShareQuery();
      return;
    }

    if (search.get("r")) {
      const u = new URL(window.location.href);
      u.searchParams.delete("r");
      const qs = u.search;
      const next = qs.length > 0 ? `${u.pathname}${qs}` : u.pathname;
      history.replaceState({}, "", next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drive the whole UI's accent color from the active method
  useMethodTheme(activeMethod);
  // Drive the user-selected theme accent color
  useThemeAccent();
  // Global keyboard shortcuts
  useKeyboardShortcuts({
    onSave: save,
    onCloseTab: handleCloseActiveTab,
    onCloseAllTabs: handleCloseAllTabs,
    onNewRequest: openTab,
    onNewCollection: () => setIsCreatingCollection(true),
    onManageEnvironments: () => router.push("/environments"),
    onOpenSettings: () => router.push("/settings"),
    onImportCollection: () => router.push("/import"),
    onTransformPlayground: () => router.push("/transform"),
    onCompareJson: () => router.push("/json-compare"),
  });

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop: resizable two-column layout */}
      <div
        className="hidden h-full w-full md:flex"
        data-testid="desktop-layout"
      >
        {mounted ? (
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel
              defaultSize="20%"
              minSize="10%"
              maxSize="90%"
              className="border-r border-border"
            >
              <nav
                aria-label={tCommon("collectionsHistoryWorkspace")}
                className="h-full"
              >
                <LeftPanel />
              </nav>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="80%" minSize="80%">
              <main id="app-main" className="h-full min-h-0">
                <ErrorBoundary fallbackTitle="Request panel crashed">
                  <RightPanel />
                </ErrorBoundary>
              </main>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="flex h-full w-full">
            <div className="w-[20%] border-r border-border" />
            <main id="app-main" className="min-h-0 flex-1" />
          </div>
        )}
      </div>

      <MobileDesktopNotice />

      {/* Command Palette — always mounted, visibility controlled by store */}
      <CommandPalette />

      {/* Keyboard Shortcuts Modal — always mounted, visibility controlled by store */}
      <KeyboardShortcutsModal
        open={keyboardShortcutsOpen}
        onOpenChange={setKeyboardShortcutsOpen}
      />

      {/* Save Request Modal — opened by Cmd+S or Save button when tab has no collection */}
      {saveModalOpen && activeTab && activeTab.type === "http" && (
        <SaveRequestModal
          open={saveModalOpen}
          onOpenChange={setSaveModalOpen}
          tab={activeTab}
        />
      )}

      {/* Onboarding tour — disabled for now */}
      {/* {mounted && isFirstTime && <OnboardingTour onComplete={markComplete} />} */}
    </div>
  );
}
