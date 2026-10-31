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
});
