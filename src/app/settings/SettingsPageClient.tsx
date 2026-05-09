"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { ClearHistoryDialog } from "@/components/settings/ClearHistoryDialog";
import { GeneralSection } from "@/components/settings/GeneralSection";
import { LanguageSection } from "@/components/settings/LanguageSection";
import { ProxySection } from "@/components/settings/ProxySection";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { ShortcutsSection } from "@/components/settings/ShortcutsSection";
import { useFirstTimeUser } from "@/hooks/useFirstTimeUser";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import type { SettingsSection } from "./constants";

export default function SettingsPageClient() {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("appearance");
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);

  const et = useTranslations("errors");
  const { theme, setTheme } = useTheme();
  const {
    sslVerify,
    followRedirects,
    proxyUrl,
    showHealthMonitor,
    showCodeGen,
    accentColor,
    setSetting,
  } = useSettingsStore();
  const { clearHistory } = useHistoryStore();
  const { restartTour } = useFirstTimeUser();

  function handleClearHistory() {
    clearHistory();
    setClearHistoryOpen(false);
    toast.success(et("historyCleared"));
  }

  return (
    <div className="flex min-h-screen bg-background">
      <SettingsNav
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <main id="app-main" className="flex-1 overflow-auto p-8">
        {activeSection === "general" && (
          <GeneralSection
            showHealthMonitor={showHealthMonitor}
            showCodeGen={showCodeGen}
            setSetting={setSetting}
            onClearHistoryClick={() => setClearHistoryOpen(true)}
            onRestartTour={restartTour}
          />
        )}
        {activeSection === "appearance" && (
          <AppearanceSection
            theme={theme}
            onThemeChange={setTheme}
            accentColor={accentColor}
            onAccentColorChange={(color) => setSetting("accentColor", color)}
          />
        )}
        {activeSection === "proxy" && (
          <ProxySection
            sslVerify={sslVerify}
            followRedirects={followRedirects}
            proxyUrl={proxyUrl}
            setSetting={setSetting}
          />
        )}
        {activeSection === "shortcuts" && <ShortcutsSection />}
        {activeSection === "language" && <LanguageSection />}
      </main>

      <ClearHistoryDialog
        open={clearHistoryOpen}
        onOpenChange={setClearHistoryOpen}
        onConfirm={handleClearHistory}
      />
    </div>
  );
}
