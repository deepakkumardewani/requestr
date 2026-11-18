#!/usr/bin/env bash
# Ephemeral Socket.IO echo server — does NOT add socket.io to the app.
# Usage:
#   ./scripts/run-socketio-echo.sh
#   PORT=4000 ./scripts/run-socketio-echo.sh
#
# In Requestly: New → Socket.IO → URL http://127.0.0.1:3333 (default port)
# Event name: message (default). Send text; server echoes the same event + payload.

set -euo pipefail

PORT="${PORT:-3333}"
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

cd "$TMP"
npm init -y >/dev/null 2>&1
npm install socket.io@4 >/dev/null 2>&1

node <<NODE
const http = require("http");
const { Server } = require("socket.io");

const port = Number(process.env.PORT || "${PORT}");
const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3001",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  console.log("[socket.io] client connected:", socket.id);

  socket.onAny((event, ...args) => {
    if (event === "disconnect" || event === "disconnecting") return;
    // Echo whatever the client emitted (matches default "message" in the app)
    socket.emit(event, ...args);
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket.io] disconnected:", socket.id, reason);
  });
});

httpServer.listen(port, () => {
  console.log("");
  console.log("Socket.IO echo server listening");
  console.log("  → http://127.0.0.1:" + port);
  console.log("Paste that URL into the Socket.IO tab and click Connect.");
  console.log("");
});
NODE
