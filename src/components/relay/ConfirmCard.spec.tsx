/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en/relay.json";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string | number>) => {
    const path = [...namespace.split(".").slice(1), ...key.split(".")];
    const template = path.reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      en,
    ) as string;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ""));
  },
}));

afterEach(cleanup);

import type { ConfirmPreview } from "@/lib/relay/tools/registry";
import { ConfirmCard, DeclinedNote } from "./ConfirmCard";

const deletePreview: ConfirmPreview = {
  action: "delete",
  severity: "danger",
  targets: ["Orders", "Billing"],
  count: 2,
  childCount: 7,
};

function renderCard(preview: ConfirmPreview) {
  const onApprove = vi.fn();
  const onDecline = vi.fn();
  render(<ConfirmCard preview={preview} onApprove={onApprove} onDecline={onDecline} />);
  return { onApprove, onDecline };
}

describe("ConfirmCard", () => {
  it("names every target and the child count for a delete", () => {
    renderCard(deletePreview);
    expect(screen.getByTestId("relay-confirm-card").dataset.severity).toBe("danger");
    expect(screen.getByRole("group", { name: /Delete 2 items/ })).toBeTruthy();
    expect(screen.getByTestId("relay-confirm-targets").textContent).toContain("Billing");
    expect(screen.getByTestId("relay-confirm-children").textContent).toContain("7");
  });

  it("puts a single target in the title and omits the list", () => {
    renderCard({ action: "delete", severity: "danger", targets: ["Orders"], count: 1 });
    expect(screen.getByText('Delete "Orders"?')).toBeTruthy();
    expect(screen.queryByTestId("relay-confirm-targets")).toBeNull();
    expect(screen.queryByTestId("relay-confirm-children")).toBeNull();
  });

  it("shows how many targets are hidden by the display cap", () => {
    renderCard({ ...deletePreview, targets: ["A", "B"], count: 9 });
    expect(screen.getByTestId("relay-confirm-targets").textContent).toContain("and 7 more");
  });

  it("shows the resolved host, environment and no body", () => {
    renderCard({
      action: "send",
      severity: "caution",
      targets: ["Orders"],
      count: 1,
      method: "POST",
      host: "api.test",
      environment: "Staging",
    });
    expect(screen.getByTestId("relay-confirm-host").textContent).toContain("api.test");
    expect(screen.getByTestId("relay-confirm-env").textContent).toContain("Staging");
    expect(screen.queryByTestId("relay-confirm-host-warning")).toBeNull();
    expect(screen.getByRole("group").dataset.severity).toBe("caution");
  });

  it("warns when the host differs from the last one used", () => {
    renderCard({
      action: "send",
      severity: "caution",
      targets: ["Orders"],
      count: 1,
      method: "GET",
      host: "evil.test",
      previousHost: "api.test",
      hostDiffers: true,
      environment: null,
    });
    const warning = screen.getByTestId("relay-confirm-host-warning");
    expect(warning.getAttribute("role")).toBe("alert");
    expect(warning.textContent).toContain("evil.test");
    expect(warning.textContent).toContain("api.test");
    expect(screen.getByTestId("relay-confirm-env").textContent).toBe("No environment selected");
  });

  it("says so when the address could not be resolved", () => {
    renderCard({ action: "send", severity: "caution", targets: ["Orders"], count: 1, method: "GET" });
    expect(screen.getByTestId("relay-confirm-host").textContent).toContain("could not be resolved");
  });

  it("shows the start node of a partial chain run", () => {
    renderCard({
      action: "run",
      severity: "caution",
      targets: ["Nightly"],
      count: 1,
      fromNode: "Login",
      environment: "Dev",
    });
    expect(screen.getByText('Run chain "Nightly"?')).toBeTruthy();
    expect(screen.getByTestId("relay-confirm-from").textContent).toContain("Login");
  });

  it("titles a bulk update with its count", () => {
    renderCard({ action: "bulkUpdate", severity: "caution", targets: ["A"], count: 11 });
    expect(screen.getByText("Change 11 requests?")).toBeTruthy();
  });

  it("lists the first names and the remainder for a bulk delete", () => {
    renderCard({
      action: "delete",
      severity: "danger",
      targets: ["R1", "R2", "R3", "R4", "R5"],
      count: 12,
    });
    expect(screen.getByText("Delete 12 items?")).toBeTruthy();
    const list = screen.getByTestId("relay-confirm-targets");
    expect(list.querySelectorAll("li")).toHaveLength(6);
    expect(list.textContent).toContain("R5");
    expect(list.textContent).toContain("and 7 more");
  });

  it("Approve fires once and locks both buttons", () => {
    const { onApprove, onDecline } = renderCard(deletePreview);
    fireEvent.click(screen.getByTestId("relay-confirm-approve"));
    fireEvent.click(screen.getByTestId("relay-confirm-approve"));
    fireEvent.click(screen.getByTestId("relay-confirm-decline"));
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onDecline).not.toHaveBeenCalled();
    expect((screen.getByTestId("relay-confirm-decline") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("relay-confirm-approve").textContent).toContain("Working");
  });

  it("Decline fires once and never approves", () => {
    const { onApprove, onDecline } = renderCard(deletePreview);
    fireEvent.click(screen.getByTestId("relay-confirm-decline"));
    fireEvent.click(screen.getByTestId("relay-confirm-approve"));
    expect(onDecline).toHaveBeenCalledTimes(1);
    expect(onApprove).not.toHaveBeenCalled();
  });
});

describe("DeclinedNote", () => {
  it("tells a user decline from an automatic one", () => {
    render(<DeclinedNote automatic={false} />);
    expect(screen.getByTestId("relay-confirm-declined").textContent).toBe("You declined this step.");
    cleanup();
    render(<DeclinedNote automatic />);
    expect(screen.getByTestId("relay-confirm-declined").dataset.automatic).toBe("true");
    expect(screen.getByTestId("relay-confirm-declined").textContent).toContain("Skipped");
  });
});

describe("ConfirmCard accessibility", () => {
  it("announces that a confirmation is needed, then goes quiet once answered", () => {
    renderCard(deletePreview);
    const live = screen.getByRole("status");
    expect(live.textContent).toBe("Confirmation needed");
    expect(live.className).toContain("sr-only");
    fireEvent.click(screen.getByTestId("relay-confirm-approve"));
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("keeps both actions at the coarse-pointer touch minimum", () => {
    renderCard(deletePreview);
    for (const id of ["relay-confirm-approve", "relay-confirm-decline"]) {
      expect(screen.getByTestId(id).className).toContain("pointer-coarse:min-h-11");
    }
  });
});
