import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";
import { queryToObject, recordEntry, resolveTestId } from "./requestLog";

export const WS_PATH = "/ws";

function parseRequest(req: IncomingMessage) {
  const url = new URL(req.url ?? "/", "http://mock.local");
  return { url, testId: resolveTestId(req.headers, url.searchParams) };
}

/** Echoes every frame; connect/message/close are recorded in the request log. */
export function attachWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (socket, req) => {
    const { url, testId } = parseRequest(req);
    recordEntry({
      kind: "ws",
      event: "connect",
      testId,
      path: url.pathname,
      query: queryToObject(url.searchParams),
      headers: req.headers,
    });
    socket.on("message", (data, isBinary) => {
      recordEntry({
        kind: "ws",
        event: "message",
        testId,
        detail: data.toString(),
      });
      socket.send(data, { binary: isBinary });
    });
    socket.on("close", (code, reason) => {
      recordEntry({
        kind: "ws",
        event: "close",
        testId,
        detail: { code, reason: reason.toString() },
      });
    });
  });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (parseRequest(req).url.pathname !== WS_PATH) return;
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  });
}
