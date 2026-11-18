import { relayToolRegistry } from "./registry";

/**
 * Every tool name the Relay registry exposes to the model. Shared by the tests
 * that assert tool names never leak into user-facing copy or prompts.
 */
export function getRegisteredToolNames(): string[] {
  return [...relayToolRegistry.keys()];
}
