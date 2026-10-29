import { createTriggerExtension } from "@/lib/relay/mentionSuggestion";

type SlashSessionHandler = Parameters<
  typeof createTriggerExtension
>[0]["onSession"];

/** `/` opens the command menu at the start of the text or after a space, so it can sit mid-sentence. */
export const createSlashExtension = (onSession: SlashSessionHandler) =>
  createTriggerExtension({ name: "relaySlash", char: "/", onSession });
