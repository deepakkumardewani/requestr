"use client";

import { create } from "zustand";
import { createChainConfigSlice } from "./chainConfigSlice";
import { createChainGraphSlice } from "./chainGraphSlice";
import type { ChainStore } from "./chainStoreUtils";

export const useChainStore = create<ChainStore>()((...a) => ({
  ...createChainGraphSlice(...a),
  ...createChainConfigSlice(...a),
}));
