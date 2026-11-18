/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { BackupEnvelope } from "@/lib/backup/schema";
import { BackupPreview } from "./BackupPreview";

function envelope(overrides: Record<string, unknown> = {}): BackupEnvelope {
  return {
    app: "requestr-backup",
    schemaVersion: 1,
    idbVersion: 1,
    exportedAt: "2026-03-04T10:00:00.000Z",
    appVersion: "1.0.0",
    includesSecrets: false,
    sections: ["collections", "environments"],
    data: {
      collections: [{ id: "c1" }, { id: "c2" }],
      environments: [{ id: "e1" }],
    },
    ...overrides,
  } as unknown as BackupEnvelope;
}

afterEach(cleanup);

describe("BackupPreview", () => {
  it("titles the preview and lists a count for each included section", () => {
    render(<BackupPreview envelope={envelope()} />);

    expect(
      screen.getByRole("region", { name: "What is in this backup" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("backup-preview-collections")).toHaveTextContent(
      "Collections2 items",
    );
    expect(screen.getByTestId("backup-preview-environments")).toHaveTextContent(
      "Environments1 item",
    );
  });

  it("omits sections the backup does not list", () => {
    render(<BackupPreview envelope={envelope()} />);
    expect(screen.queryByTestId("backup-preview-chains")).toBeNull();
  });

  it("shows zero for a listed section whose data is absent", () => {
    render(
      <BackupPreview envelope={envelope({ sections: ["history"], data: {} })} />,
    );
    expect(screen.getByTestId("backup-preview-history")).toHaveTextContent(
      "History0 items",
    );
  });

  it("shows the export date and that secret values were left out", () => {
    render(<BackupPreview envelope={envelope()} />);

    expect(screen.getByText(/Exported .*2026/)).toBeInTheDocument();
    expect(screen.getByTestId("backup-preview-secrets")).toHaveTextContent(
      "Secret values were left out",
    );
  });

  it("says when secret values are included", () => {
    render(<BackupPreview envelope={envelope({ includesSecrets: true })} />);
    expect(screen.getByTestId("backup-preview-secrets")).toHaveTextContent(
      "Includes secret values",
    );
  });
});
