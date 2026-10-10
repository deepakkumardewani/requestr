import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { recordEntry, resolveTestId } from "./requestLog";

/** `?fail=1` on the connect URL forces a connect_error. */
const FORCE_FAIL_QUERY = "fail";
const FORCE_FAIL_MESSAGE = "forced connect failure";

/** Echoes any event back under the same name (matches the app's default `message` event). */
export function attachSocketIoServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
    transports: ["websocket", "polling"],
    // Other upgrade listeners (the /ws server) own their own paths.
    destroyUpgrade: false,
  });

  io.use((socket, next) => {
    const { query, headers } = socket.handshake;
    const testId = resolveTestId(
      headers,
      new URLSearchParams(query as Record<string, string>),
    );
    if (query[FORCE_FAIL_QUERY] === "1") {
      recordEntry({ kind: "socketio", event: "connect_error", testId });
      next(new Error(FORCE_FAIL_MESSAGE));
      return;
    }
    next();
  });

  io.on("connection", (socket) => {
    const { query, headers } = socket.handshake;
    const testId = resolveTestId(
      headers,
      new URLSearchParams(query as Record<string, string>),
    );
    recordEntry({
      kind: "socketio",
      event: "connect",
      testId,
      detail: socket.id,
    });
    socket.onAny((event, ...args) => socket.emit(event, ...args));
    socket.on("disconnect", (reason) => {
      recordEntry({
        kind: "socketio",
        event: "disconnect",
        testId,
        detail: reason,
      });
    });
  });

  return io;
}
