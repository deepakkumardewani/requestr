const DISABLED_VALUE = "false";

/**
 * Single reader of the Relay feature flag (FR-80). `NEXT_PUBLIC_*` values are
 * inlined at build time, so the property access must stay literal. Relay is on
 * unless the flag is explicitly "false".
 */
export function isRelayEnabled(): boolean {
  return process.env.NEXT_PUBLIC_RELAY_ENABLED !== DISABLED_VALUE;
}
