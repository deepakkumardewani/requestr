"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { DataSection } from "@/components/settings/DataSection";
import { GeneralSection } from "@/components/settings/GeneralSection";
import { GlobalSection } from "@/components/settings/GlobalSection";
import { ProxySection } from "@/components/settings/ProxySection";
import { RelaySection } from "@/components/settings/RelaySection";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { ShortcutsSection } from "@/components/settings/ShortcutsSection";
import { useFirstTimeUser } from "@/hooks/useFirstTimeUser";
import { useHydrateChainPreferences } from "@/hooks/useHydrateChainPreferences";
import { isRelayEnabled } from "@/lib/relay/flag";
import { useSettingsSectionStore } from "@/stores/useSettingsSectionStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useUIStore } from "@/stores/useUIStore";
import { type SettingsSection, sectionFromHash } from "./constants";

export default function SettingsPageClient() {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("appearance");
  // The URL hash picks the section (Relay's "Open Settings"); read after mount
  // so the server and first client render agree.
  useEffect(() => {
    const syncFromHash = () => {
      const section = sectionFromHash(window.location.hash);
      if (section) setActiveSection(section);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);
  // A request made while Settings is already open: no hashchange fires for it.
  const requestedSection = useSettingsSectionStore((s) => s.requested);
  const clearRequestedSection = useSettingsSectionStore((s) => s.clear);
  useEffect(() => {
    if (!requestedSection) return;
    setActiveSection(requestedSection);
    clearRequestedSection();
  }, [requestedSection, clearRequestedSection]);

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
  const { restartTour } = useFirstTimeUser();
  const { chainConcurrency, setChainConcurrency } = useUIStore();
  useHydrateChainPreferences();

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <SettingsNav
        activeSection={activeSection}
        onSectionChange={setActiveSection}
      />

      <main id="app-main" className="min-w-0 flex-1 overflow-auto p-4 md:p-8">
        {activeSection === "general" && (
          <GeneralSection
            showHealthMonitor={showHealthMonitor}
            showCodeGen={showCodeGen}
            setSetting={setSetting}
            onRestartTour={restartTour}
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
        {activeSection === "data" && <DataSection />}
        {activeSection === "relay" && isRelayEnabled() && <RelaySection />}
      </main>
    </div>
  );
}
