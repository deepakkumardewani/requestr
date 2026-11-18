const CHANNEL_NAME = "requestr-backup-restore";

type RestoreMessage = { type: "restored"; senderId: string };

/** Distinguishes this tab's own message from another tab's. */
const TAB_ID = crypto.randomUUID();

let listening = false;

/** Tells every other open Requestr tab that the workspace was restored. */
export function broadcastRestore(): void {
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const message: RestoreMessage = { type: "restored", senderId: TAB_ID };
  channel.postMessage(message);
  channel.close();
}

/** The restoring tab reloads itself so every store rehydrates from the restored data. */
export function reloadWorkspace(): void {
  window.location.reload();
}

/**
 * Reloads this tab when another tab restores a backup, so it cannot write
 * stale state back over the restored data. Safe to call more than once.
 */
export function listenForRestore(): void {
  if (listening || typeof BroadcastChannel === "undefined") return;
  listening = true;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<RestoreMessage>) => {
    if (event.data?.type === "restored" && event.data.senderId !== TAB_ID) {
      reloadWorkspace();
    }
  };
}
