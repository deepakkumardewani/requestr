import http from "node:http";
import https from "node:https";
import { handleHttp } from "./httpRoutes";
import { MOCK_HOST, MOCK_HTTP_PORT, MOCK_HTTPS_PORT } from "./mockBaseUrl";
import { attachSocketIoServer } from "./socketIoServer";
import { generateSelfSignedCert } from "./tlsCert";
import { attachWebSocketServer } from "./wsServer";

function startServer(
  server: http.Server | https.Server,
  scheme: "http" | "https",
  port: number,
): void {
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Mock server: ${scheme} port ${port} is already in use by another process. Free it or set MOCK_PORT / MOCK_HTTPS_PORT.`,
      );
    } else {
      console.error("Mock server: failed to start", err);
    }
    process.exit(1);
  });

  server.listen(port, MOCK_HOST, () => {
    console.log(`Mock server listening on ${scheme}://${MOCK_HOST}:${port}`);
  });
}

const httpServer = http.createServer(handleHttp);
attachWebSocketServer(httpServer);
attachSocketIoServer(httpServer);
startServer(httpServer, "http", MOCK_HTTP_PORT);

const tls = generateSelfSignedCert();
startServer(
  https.createServer({ cert: tls.cert, key: tls.key }, handleHttp),
  "https",
  MOCK_HTTPS_PORT,
);
