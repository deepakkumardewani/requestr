/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useUIStore } from "@/stores/useUIStore";
import type { CollectionModel, RequestModel } from "@/types";
import en from "../../../../../messages/en/chain.json";
import fr from "../../../../../messages/fr/chain.json";
import ja from "../../../../../messages/ja/chain.json";
import { ApiPickerDialog } from "../ApiPickerDialog";
import { NewRequestPanel } from "./NewRequestPanel";
import { PickerProvider } from "./PickerContext";

// The global setup mocks next-intl with English-only messages; this spec needs the real one.
vi.unmock("next-intl");
vi.mock("@/lib/idb", () => ({ getDB: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), info: vi.fn() } }));

const CHAIN_ID = "chain-1";
const VIEWPORT_HEIGHT = 400;
const PICKER_KEY_PREFIX = "apiPicker";

type Locale = "fr" | "ja";
type Messages = Record<string, string>;
const LOCALES: Record<Locale, Messages> = { fr, ja };

/** Expected copy per locale; plural categories differ (fr has `one`, ja only `other`). */
const COPY = {
  fr: {
    title: "Ajouter une requête API",
    selectedOne: "1 sélectionnée",
    selectedTwo: "2 sélectionnées",
    addOne: "Ajouter 1 requête",
    addTwo: "Ajouter 2 requêtes",
    resultOne: "1 résultat",
    resultTwo: "2 résultats",
    curlError: "Impossible d'analyser le cURL : Cela ne ressemble pas à une commande cURL",
    unsaved: "Ajouter sans enregistrer",
  },
  ja: {
    title: "API リクエストを追加",
    selectedOne: "1件選択中",
    selectedTwo: "2件選択中",
    addOne: "1件のリクエストを追加",
    addTwo: "2件のリクエストを追加",
    resultOne: "1件の結果",
    resultTwo: "2件の結果",
    curlError: "cURLを解析できませんでした: cURLコマンドではないようです",
    unsaved: "保存せずに追加",
  },
} as const;

const COL: CollectionModel = { id: "col-1", name: "Main", createdAt: 1, updatedAt: 1 };
const makeRequest = (id: string): RequestModel => ({
  id,
  collectionId: COL.id,
  name: `Alpha ${id}`,
  method: "GET",
  url: `https://api.test/${id}`,
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { type: "none", content: "" },
  preScript: "",
  postScript: "",
  createdAt: 1,
  updatedAt: 1,
});

function renderLocalized(locale: Locale, ui: ReactElement) {
  // A missing key must fail the test instead of silently rendering the key name.
  const onError = (error: { code: string; message: string }) => {
    throw new Error(`[${locale}] ${error.code}: ${error.message}`);
  };
  return render(
    <NextIntlClientProvider locale={locale} messages={{ chain: LOCALES[locale] }} onError={onError}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function seedStores(collections: CollectionModel[], requests: RequestModel[]) {
  useCollectionsStore.setState({ collections, folders: [], requests, hydrated: true });
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
    hydrated: true,
    history: {},
  });
  useUIStore.setState({ pickerTab: "collections" });
  useHistoryStore.setState({ entries: [] });
  localStorage.clear();
}

describe("picker key parity", () => {
  it.each(["fr", "ja"] as const)("%s defines every apiPicker key that en does", (locale) => {
    const enKeys = Object.keys(en).filter((key) => key.startsWith(PICKER_KEY_PREFIX));
    expect(enKeys.length).toBeGreaterThan(0);
    const missing = enKeys.filter((key) => !(key in LOCALES[locale]));
    expect(missing).toEqual([]);
  });
});

describe.each(["fr", "ja"] as const)("picker in %s", (locale) => {
  const copy = COPY[locale];

  beforeEach(() => {
    seedStores([COL], [makeRequest("req-1"), makeRequest("req-2")]);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(VIEWPORT_HEIGHT);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(600);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders shell, filters and footer with plural-aware counts and no English leftovers", async () => {
    renderLocalized(
      locale,
      <ApiPickerDialog open onClose={vi.fn()} chainId={CHAIN_ID} alreadyAddedIds={new Set()} />,
    );
    expect(await screen.findByText(copy.title)).toBeTruthy();
    expect(screen.queryByText(en.apiPickerTitle)).toBeNull();
    expect(screen.getByTestId("picker-footer")).toBeTruthy();
    expect(screen.getByTestId("picker-selected-count").textContent).toBe(
      locale === "fr" ? "0 sélectionnée" : "0件選択中",
    );

    fireEvent.click(await screen.findByTestId("picker-header-collection:col-1"));
    fireEvent.click(await screen.findByTestId("picker-row-req-1"));
    expect(screen.getByTestId("picker-selected-count").textContent).toBe(copy.selectedOne);
    expect(screen.getByTestId("picker-add-selected").textContent).toBe(copy.addOne);

    fireEvent.click(screen.getByTestId("picker-row-req-2"));
    expect(screen.getByTestId("picker-selected-count").textContent).toBe(copy.selectedTwo);
    expect(screen.getByTestId("picker-add-selected").textContent).toBe(copy.addTwo);
  });

  it("announces result counts with the locale's plural forms", async () => {
    renderLocalized(
      locale,
      <ApiPickerDialog open onClose={vi.fn()} chainId={CHAIN_ID} alreadyAddedIds={new Set()} />,
    );
    const search = await screen.findByTestId("picker-search");
    fireEvent.change(search, { target: { value: "Alpha req-1" } });
    expect((await screen.findByTestId("picker-result-announcement")).textContent).toBe(copy.resultOne);
    fireEvent.change(search, { target: { value: "Alpha" } });
    expect(screen.getByTestId("picker-result-announcement").textContent).toBe(copy.resultTwo);
  });

  it("renders the New request panel, including the translated cURL error", () => {
    renderLocalized(
      locale,
      <PickerProvider>
        <NewRequestPanel chainId={CHAIN_ID} onClose={vi.fn()} />
      </PickerProvider>,
    );
    fireEvent.click(screen.getByTestId("picker-new-mode-curl"));
    fireEvent.change(screen.getByTestId("picker-new-curl"), { target: { value: "wget http://x" } });
    expect(screen.getByTestId("picker-curl-error").textContent).toBe(copy.curlError);
  });

  it("renders the translated New request tab inside the real dialog", async () => {
    renderLocalized(
      locale,
      <ApiPickerDialog open onClose={vi.fn()} chainId={CHAIN_ID} alreadyAddedIds={new Set()} />,
    );
    fireEvent.click(await screen.findByTestId("picker-tab-new"));
    fireEvent.click(await screen.findByTestId("picker-new-mode-curl"));
    fireEvent.change(screen.getByTestId("picker-new-curl"), { target: { value: "wget http://x" } });
    expect(screen.getByTestId("picker-curl-error").textContent).toBe(copy.curlError);
  });

  it("uses the localized unsaved action when there are no collections", () => {
    seedStores([], []);
    renderLocalized(
      locale,
      <PickerProvider>
        <NewRequestPanel chainId={CHAIN_ID} onClose={vi.fn()} />
      </PickerProvider>,
    );
    expect(screen.getByTestId("picker-new-request-submit").textContent).toBe(copy.unsaved);
  });

  it("fails loudly when a key is missing", () => {
    const { apiPickerCancel: _removed, ...rest } = LOCALES[locale];
    const onError = (error: { message: string }) => {
      throw new Error(error.message);
    };
    expect(() =>
      render(
        <NextIntlClientProvider locale={locale} messages={{ chain: rest }} onError={onError}>
          <PickerProvider>
            <NewRequestPanel chainId={CHAIN_ID} onClose={vi.fn()} />
          </PickerProvider>
        </NextIntlClientProvider>,
      ),
    ).toThrow(/apiPickerCancel/);
  });
});
