/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import enChain from "../../../../messages/en/chain.json";
import type { ChainBlock } from "@/types/chain";
import { ChainValidationBanners } from "./ChainValidationBanners";
import type { ChainStructureValidation } from "./useChainStructureValidation";

const EMPTY_VALIDATION: ChainStructureValidation = {
  unpairedLoopIds: [],
  unresolvedCollectIds: [],
  hasLoopNesting: false,
  loopsWithUnconnectedBodyIds: [],
  loopsWhoseBodyMissesCollectIds: [],
  invalidSubChainIds: [],
  multiInboundDisplayIds: [],
};

const BLOCKS: ChainBlock[] = [
  {
    id: "l1",
    type: "loop",
    sourceJsonPath: "$.items",
    itemAlias: "item",
    maxIterations: 10,
  },
];

const DISPLAY_BLOCKS: ChainBlock[] = [
  {
    id: "d1",
    type: "display",
    sourceJsonPath: "$",
    targetField: "header",
    targetKey: "k",
  },
];

afterEach(cleanup);

describe("ChainValidationBanners display banner", () => {
  it("renders the multiple-inputs message with the display name", () => {
    render(
      <ChainValidationBanners
        validation={{ ...EMPTY_VALIDATION, multiInboundDisplayIds: ["d1"] }}
        blocks={DISPLAY_BLOCKS}
      />,
    );
    expect(
      screen.getByText(enChain.displayMultipleInputsBannerMessage, {
        exact: false,
      }),
    ).toBeTruthy();
    expect(screen.getByText(`${enChain.blockMenuDisplayName} 1`)).toBeTruthy();
  });
});

describe("ChainValidationBanners loop body banners", () => {
  it("renders the unconnected-body message with the loop name", () => {
    render(
      <ChainValidationBanners
        validation={{ ...EMPTY_VALIDATION, loopsWithUnconnectedBodyIds: ["l1"] }}
        blocks={BLOCKS}
      />,
    );
    expect(
      screen.getByText(enChain.loopBodyUnconnectedBannerMessage, {
        exact: false,
      }),
    ).toBeTruthy();
    expect(screen.getByText(`${enChain.blockMenuLoopName} 1`)).toBeTruthy();
  });

  it("renders the body-misses-collect message", () => {
    render(
      <ChainValidationBanners
        validation={{
          ...EMPTY_VALIDATION,
          loopsWhoseBodyMissesCollectIds: ["l1"],
        }}
        blocks={BLOCKS}
      />,
    );
    expect(
      screen.getByText(enChain.loopBodyMissesCollectBannerMessage, {
        exact: false,
      }),
    ).toBeTruthy();
  });

  it("renders no banner for a clean validation", () => {
    const { container } = render(
      <ChainValidationBanners validation={EMPTY_VALIDATION} blocks={BLOCKS} />,
    );
    expect(container.textContent).toBe("");
  });
});
