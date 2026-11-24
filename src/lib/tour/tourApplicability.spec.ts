// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ relayFlag: vi.fn(() => true) }));
vi.mock("@/lib/relay/flag", () => ({ isRelayEnabled: mocks.relayFlag }));

import { useHistoryStore } from "@/stores/useHistoryStore";
import { useRelayStore } from "@/stores/useRelayStore";
import { useTabsStore } from "@/stores/useTabsStore";
import {
  areSampleRequestsShown,
  hasActiveRequestTab,
  hasResponsePanel,
  isCollectionsSidebarShown,
  isRelayAvailable,
} from "./tourApplicability";

type SidebarTabOptions = { selected: boolean; panelMounted?: boolean };

function addSidebarTab(
  tab: string,
  { selected, panelMounted = selected }: SidebarTabOptions
) {
  const trigger = document.createElement("button");
  trigger.setAttribute("data-testid", `sidebar-tab-${tab}`);
  trigger.setAttribute("aria-selected", String(selected));
  if (panelMounted) {
    const panel = document.createElement("div");
    panel.id = `panel-${tab}`;
    trigger.setAttribute("aria-controls", panel.id);
    document.body.appendChild(panel);
  }
  document.body.appendChild(trigger);
}

function setActiveTab(type: string | null) {
  useTabsStore.setState({
    hydrated: true,
    activeTabId: type ? "t1" : null,
    tabs: type ? ([{ tabId: "t1", type }] as never) : [],
  });
}

describe("tourApplicability", () => {
  beforeEach(() => {
    mocks.relayFlag.mockReturnValue(true);
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("request editor steps", () => {
    it("apply while tabs are not hydrated yet", () => {
      useTabsStore.setState({ hydrated: false, activeTabId: null });
      expect(hasActiveRequestTab()).toBe(true);
    });

    it("do not apply to an empty workspace", () => {
      setActiveTab(null);
      expect(hasActiveRequestTab()).toBe(false);
      expect(hasResponsePanel()).toBe(false);
    });

    it("show the response panel for HTTP but not streaming tabs", () => {
      setActiveTab("http");
      expect(hasResponsePanel()).toBe(true);
      setActiveTab("websocket");
      expect(hasResponsePanel()).toBe(false);
      setActiveTab("socketio");
      expect(hasResponsePanel()).toBe(false);
    });
  });

  describe("sidebar steps", () => {
    it("apply while the sidebar has not rendered", () => {
      expect(isCollectionsSidebarShown()).toBe(true);
    });

    it("apply to collections only when its panel is mounted", () => {
      addSidebarTab("collections", { selected: true });
      expect(isCollectionsSidebarShown()).toBe(true);
    });

    it("do not apply while search results replace the panel", () => {
      addSidebarTab("collections", { selected: true, panelMounted: false });
      expect(isCollectionsSidebarShown()).toBe(false);
    });

    it("show samples only on an empty History tab", () => {
      addSidebarTab("history", { selected: true });
      useHistoryStore.setState({ entries: [] });
      expect(areSampleRequestsShown()).toBe(true);

      useHistoryStore.setState({ entries: [{}] as never });
      expect(areSampleRequestsShown()).toBe(false);
    });

    it("hide samples while another sidebar tab is active", () => {
      addSidebarTab("history", { selected: false });
      useHistoryStore.setState({ entries: [] });
      expect(areSampleRequestsShown()).toBe(false);
    });
  });

  describe("relay", () => {
    it("needs both the build flag and the user setting", () => {
      useRelayStore.setState({ enabled: true });
      expect(isRelayAvailable()).toBe(true);
      useRelayStore.setState({ enabled: false });
      expect(isRelayAvailable()).toBe(false);
      useRelayStore.setState({ enabled: true });
      mocks.relayFlag.mockReturnValue(false);
      expect(isRelayAvailable()).toBe(false);
    });
  });
});
