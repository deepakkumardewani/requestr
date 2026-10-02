/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import type { CollectionModel } from "@/types";
import en from "../../../../../messages/en/chain.json";
import { PickerProvider } from "./PickerContext";
import { NewRequestPanel } from "./NewRequestPanel";
import { resetRememberedTarget } from "./useCreateRequest";

vi.mock("next-intl", () => ({
  useTranslations:
    () => (key: string, values?: Record<string, string>) => {
      const template = (en as Record<string, string>)[key] ?? key;
      return template.replace(/\{(\w+)\}/g, (_, k) => values?.[k] ?? "");
    },
}));
vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

const CHAIN_ID = "chain-1";
const COL: CollectionModel = { id: "c1", name: "Main", createdAt: 1, updatedAt: 1 };

function seed(collections: CollectionModel[]) {
  useCollectionsStore.setState({ collections, folders: [], requests: [] });
  useChainStore.setState({
    chains: {
      [CHAIN_ID]: {
        id: CHAIN_ID,
        scope: "standalone",
        schemaVersion: 5,
        name: "c",
        blocks: [],
        nodeIds: [],
        edges: [],
        nodePositions: {},
      },
    } as never,
  });
}

function renderPanel(onClose = vi.fn(), onNodeAdded = vi.fn()) {
  const view = (
    <PickerProvider>
      <NewRequestPanel chainId={CHAIN_ID} onClose={onClose} onNodeAdded={onNodeAdded} />
    </PickerProvider>
  );
  return { onClose, onNodeAdded, ...render(view) };
}

const submit = () => screen.getByTestId("picker-new-request-submit") as HTMLButtonElement;
const toCurl = () => fireEvent.click(screen.getByTestId("picker-new-mode-curl"));
const MULTILINE_CURL = "curl -X POST https://api.test/orders \\\n  -H 'X-A: 1' \\\n  -d '{}'";

describe("NewRequestPanel", () => {
  beforeEach(() => {
    resetRememberedTarget();
    seed([COL]);
  });
  afterEach(cleanup);

  it("blank: disables the action until a URL is entered, then creates and closes", async () => {
    const user = userEvent.setup();
    const { onClose, onNodeAdded } = renderPanel();
    expect(submit().disabled).toBe(true);
    await user.type(screen.getByTestId("picker-new-url"), "https://api.test/users");
    expect(submit().disabled).toBe(false);
    await user.click(submit());
    expect(useCollectionsStore.getState().requests).toHaveLength(1);
    expect(useCollectionsStore.getState().requests[0].name).toBe("New request");
    expect(onNodeAdded).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("blank: shows the inline URL error after the field is left empty", () => {
    renderPanel();
    const url = screen.getByTestId("picker-new-url");
    fireEvent.blur(url);
    expect(screen.getByTestId("picker-new-url-error").textContent).toBe("URL is required");
  });

  it("curl: invalid text shows a translated alert and keeps the action disabled", () => {
    renderPanel();
    toCurl();
    fireEvent.change(screen.getByTestId("picker-new-curl"), { target: { value: "curl -X NOPE" } });
    const alert = screen.getByTestId("picker-curl-error");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alert.textContent).toContain("Couldn't parse cURL");
    expect(submit().disabled).toBe(true);
    expect(useCollectionsStore.getState().requests).toHaveLength(0);
  });

  it("curl: multi-line command is accepted and derives an editable name", () => {
    renderPanel();
    toCurl();
    fireEvent.change(screen.getByTestId("picker-new-curl"), { target: { value: MULTILINE_CURL } });
    expect(screen.queryByTestId("picker-curl-error")).toBeNull();
    expect((screen.getByTestId("picker-new-name") as HTMLInputElement).value).toBe("POST /orders");
    fireEvent.change(screen.getByTestId("picker-new-name"), { target: { value: "Mine" } });
    fireEvent.click(submit());
    expect(useCollectionsStore.getState().requests[0].name).toBe("Mine");
  });

  it("submits with Ctrl+Enter only when valid", () => {
    const { onClose } = renderPanel();
    toCurl();
    const field = screen.getByTestId("picker-new-curl");
    fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: "https://api.test/x" } });
    fireEvent.keyDown(field, { key: "Enter", metaKey: true });
    expect(useCollectionsStore.getState().requests).toHaveLength(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the draft when the panel unmounts and remounts (tab switch)", () => {
    function Switcher() {
      const [shown, setShown] = useState(true);
      return (
        <PickerProvider>
          <button type="button" data-testid="toggle" onClick={() => setShown((v) => !v)} />
          {shown && <NewRequestPanel chainId={CHAIN_ID} onClose={vi.fn()} />}
        </PickerProvider>
      );
    }
    render(<Switcher />);
    toCurl();
    fireEvent.change(screen.getByTestId("picker-new-curl"), { target: { value: "curl https://a.test" } });
    fireEvent.click(screen.getByTestId("toggle"));
    expect(screen.queryByTestId("picker-new-request")).toBeNull();
    fireEvent.click(screen.getByTestId("toggle"));
    expect((screen.getByTestId("picker-new-curl") as HTMLTextAreaElement).value).toBe("curl https://a.test");
  });

  it("with no collections the action reads 'Add without saving' and creates an ad hoc node", () => {
    seed([]);
    const { onClose } = renderPanel();
    expect(submit().textContent).toBe("Add without saving");
    expect(screen.getByTestId("picker-target-empty")).toBeTruthy();
    fireEvent.change(screen.getByTestId("picker-new-url"), { target: { value: "https://api.test/u" } });
    fireEvent.click(submit());
    expect(useCollectionsStore.getState().requests).toHaveLength(0);
    expect(useChainStore.getState().chains[CHAIN_ID].blocks).toHaveLength(1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("Cancel closes without creating anything", () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByTestId("picker-new-request-cancel"));
    expect(onClose).toHaveBeenCalledOnce();
    expect(useCollectionsStore.getState().requests).toHaveLength(0);
  });
});
