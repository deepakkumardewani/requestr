import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { describeError, toastStoreError } from "./storeToast";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

afterEach(() => {
  useSettingsStore.setState({ locale: "en" });
  vi.clearAllMocks();
});

describe("toastStoreError", () => {
  it("raises the English message by key with the cause as description", () => {
    toastStoreError("saveChainFailed", { cause: new Error("disk full") });
    expect(toast.error).toHaveBeenCalledWith("Failed to save chain", {
      description: "disk full",
    });
  });

  it("follows the active locale", () => {
    useSettingsStore.setState({ locale: "ja" });
    toastStoreError("startBlockLimit");
    expect(toast.error).toHaveBeenCalledWith(
      "1 つのチェーンに Start ブロックは 1 つだけです",
    );
  });

  it("reports a non-Error cause as unknown", () => {
    expect(describeError("nope")).toBe("Unknown error");
  });
});
