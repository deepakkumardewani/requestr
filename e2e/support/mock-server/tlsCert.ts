import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function generateSelfSignedCert(): { cert: string; key: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "requestly-mock-tls-"));
  const keyPath = path.join(dir, "key.pem");
  const certPath = path.join(dir, "cert.pem");

  try {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-keyout",
        keyPath,
        "-out",
        certPath,
        "-days",
        "1",
        "-nodes",
        "-subj",
        "/CN=127.0.0.1",
      ],
      { stdio: "pipe" },
    );
  } catch {
    throw new Error(
      "Mock server: openssl is required to generate the HTTPS self-signed certificate.",
    );
  }

  return {
    cert: fs.readFileSync(certPath, "utf8"),
    key: fs.readFileSync(keyPath, "utf8"),
  };
}
