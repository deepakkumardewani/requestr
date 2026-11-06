import { beforeEach, describe, expect, it } from "vitest";
import { useSettingsSectionStore } from "./useSettingsSectionStore";

describe("useSettingsSectionStore", () => {
  beforeEach(() => useSettingsSectionStore.setState({ requested: null }));

  it("holds a requested section until the page clears it", () => {
    useSettingsSectionStore.getState().request("proxy");
    expect(useSettingsSectionStore.getState().requested).toBe("proxy");
    useSettingsSectionStore.getState().clear();
    expect(useSettingsSectionStore.getState().requested).toBeNull();
  });

  it("sends a request for the merged language section to General", () => {
    useSettingsSectionStore.getState().request("language");
    expect(useSettingsSectionStore.getState().requested).toBe("general");
  });

  it("ignores an unknown section", () => {
    useSettingsSectionStore.getState().request("nope");
    expect(useSettingsSectionStore.getState().requested).toBeNull();
  });
});
