"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useState } from "react";
import { toast } from "sonner";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { ClearHistoryDialog } from "@/components/settings/ClearHistoryDialog";
import { GeneralSection } from "@/components/settings/GeneralSection";
import { GlobalSection } from "@/components/settings/GlobalSection";
import { LanguageSection } from "@/components/settings/LanguageSection";
import { ProxySection } from "@/components/settings/ProxySection";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { ShortcutsSection } from "@/components/settings/ShortcutsSection";
import { useHydrateChainPreferences } from "@/hooks/useHydrateChainPreferences";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUIStore } from "@/stores/useUIStore";
import { SETTINGS_SECTIONS, type SettingsSection } from "./constants";

const DEFAULT_SECTION: SettingsSection = SETTINGS_SECTIONS[0][0];

export default function SettingsPageClient() {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>(DEFAULT_SECTION);
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
  const { chainConcurrency, setChainConcurrency } = useUIStore();
  useHydrateChainPreferences();

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
            chainConcurrency={chainConcurrency}
            onChainConcurrencyChange={setChainConcurrency}
          />
        )}
        {activeSection === "global" && <GlobalSection />}
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
