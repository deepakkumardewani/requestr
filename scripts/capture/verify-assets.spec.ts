import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SCRIPT_PATH = path.resolve(__dirname, "verify-assets.mjs");
const ORIGINAL_ARGV = process.argv;
const ORIGINAL_CWD = process.cwd();

class ExitSignal extends Error {
  constructor(readonly code: number | undefined) {
    super(`process.exit(${code})`);
  }
}

interface RunResult {
  code: number | undefined;
  lines: string[];
}

/**
 * The script runs on import and ends with process.exit, so each run re-imports
 * it with fresh module state and turns the exit into a catchable signal.
 */
async function runScript(args: string[]): Promise<RunResult> {
  vi.resetModules();
  process.argv = ["node", "verify-assets.mjs", ...args];
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((message: string) => {
    lines.push(String(message));
  });
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new ExitSignal(code as number | undefined);
  });
  try {
    await import(/* @vite-ignore */ SCRIPT_PATH);
  } catch (error) {
    if (error instanceof ExitSignal) return { code: error.code, lines };
    throw error;
  }
  throw new Error("script finished without calling process.exit");
}

afterEach(() => {
  process.argv = ORIGINAL_ARGV;
  process.chdir(ORIGINAL_CWD);
  vi.restoreAllMocks();
  vi.doUnmock("node:fs");
  vi.doUnmock("node:os");
  vi.doUnmock("node:child_process");
});

describe("--readme mode", () => {
  let root: string;

  const write = (relative: string, content = "x") => {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
    return target;
  };

  const check = (readme: string) => runScript(["--readme", readme]);

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "readme-spec-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("passes when relative images and links all resolve", async () => {
    write("docs/shot.png");
    write("CONTRIBUTING.md");
    const readme = write(
      "README.md",
      "![shot](docs/shot.png)\n\nSee [contributing](CONTRIBUTING.md).\n",
    );

    const { code, lines } = await check(readme);

    expect(code).toBe(0);
    expect(lines).toEqual([
      "pass  docs/shot.png resolves",
      "pass  CONTRIBUTING.md resolves",
      "pass  2 relative README paths checked",
    ]);
  });

  it("resolves targets against the README's own directory", async () => {
    write("nested/img/a.png");
    const readme = write("nested/README.md", "![a](img/a.png)");

    const { code } = await check(readme);

    expect(code).toBe(0);
  });

  it("fails and exits 1 on a seeded broken path", async () => {
    write("docs/real.png");
    const readme = write(
      "README.md",
      "![ok](docs/real.png)\n[gone](docs/missing.md)\n",
    );

    const { code, lines } = await check(readme);

    expect(code).toBe(1);
    expect(lines).toContain("FAIL  docs/missing.md resolves");
    expect(lines).toContain("pass  docs/real.png resolves");
  });

  it("ignores external URLs, protocol-relative URLs, mailto and anchors", async () => {
    const readme = write(
      "README.md",
      [
        "[site](https://example.com/nope)",
        "![badge](http://img.shields.io/x.svg)",
        "[cdn](//cdn.example.com/a.js)",
        "[mail](mailto:hi@example.com)",
        "[top](#top)",
      ].join("\n"),
    );

    const { code, lines } = await check(readme);

    expect(code).toBe(0);
    expect(lines).toEqual(["pass  0 relative README paths checked"]);
  });

  it("checks HTML img, a and source tags with either quote style", async () => {
    write("a.png");
    const readme = write(
      "README.md",
      [
        '<img src="a.png" alt="a">',
        "<a href='missing-a.md'>x</a>",
        '<picture><source srcset="x" src="missing-source.webp"></picture>',
        '<a href="https://example.com">ext</a>',
      ].join("\n"),
    );

    const { code, lines } = await check(readme);

    expect(code).toBe(1);
    expect(lines).toContain("pass  a.png resolves");
    expect(lines).toContain("FAIL  missing-a.md resolves");
    expect(lines).toContain("FAIL  missing-source.webp resolves");
    expect(lines).toContain("pass  3 relative README paths checked");
  });

  it("strips fragments and query strings before resolving", async () => {
    write("docs/guide.md");
    const readme = write(
      "README.md",
      "[a](docs/guide.md#install) [b](docs/guide.md?plain=1) [c](#only-anchor)",
    );

    const { code, lines } = await check(readme);

    expect(code).toBe(0);
    expect(lines).toEqual([
      "pass  docs/guide.md resolves",
      "pass  1 relative README paths checked",
    ]);
  });

  it("decodes percent-encoded paths", async () => {
    write("docs/my shot.png");
    const readme = write("README.md", "![s](docs/my%20shot.png)");

    const { code } = await check(readme);

    expect(code).toBe(0);
  });

  it("accepts angle-bracketed targets and link titles", async () => {
    write("docs/a.png");
    write("docs/b.png");
    const readme = write(
      "README.md",
      '![a](<docs/a.png>) ![b](docs/b.png "Title text")',
    );

    const { code, lines } = await check(readme);

    expect(code).toBe(0);
    expect(lines).toContain("pass  docs/a.png resolves");
    expect(lines).toContain("pass  docs/b.png resolves");
  });

  it("ignores links inside fenced code blocks", async () => {
    const readme = write(
      "README.md",
      "```md\n![example](does/not/exist.png)\n```\n\nNo real links.\n",
    );

    const { code, lines } = await check(readme);

    expect(code).toBe(0);
    expect(lines).toEqual(["pass  0 relative README paths checked"]);
  });

  it("reports a path referenced twice only once", async () => {
    write("a.png");
    const readme = write("README.md", "![1](a.png) and ![2](a.png)");

    const { lines } = await check(readme);

    expect(lines.filter((line) => line.includes("a.png"))).toHaveLength(1);
  });

  it("defaults to README.md in the working directory", async () => {
    write("logo.png");
    write("README.md", "![logo](logo.png)");
    process.chdir(root);

    const { code, lines } = await runScript(["--readme"]);

    expect(code).toBe(0);
    expect(lines).toContain("pass  logo.png resolves");
  });

  it("throws when the README file does not exist", async () => {
    await expect(check(path.join(root, "NOPE.md"))).rejects.toThrow(/ENOENT/);
  });
});

describe("asset mode", () => {
  const SCREEN_BASES = [
    "backup-export",
    "backup-restore",
    "chains",
    "collections-envs",
    "command-palette",
    "import",
    "import-dialog",
    "json-compare",
    "json-visualize",
    "relay-panel",
    "transform",
  ];
  const SCREEN_FILES = SCREEN_BASES.flatMap((base) => [
    `${base}-light.webp`,
    `${base}-dark.webp`,
  ]);
  const KB = 1000;
  const MB = 1000 * KB;
  const SCRATCH = "/scratch/verify-assets-x";

  interface World {
    screens: string[];
    sizes: Record<string, number>;
    durations: Record<string, number>;
    audioFiles: string[];
    ssimOutput: string;
  }

  let ffmpegCalls: string[][];
  let mkdirCalls: string[];
  let rmCalls: string[];

  const healthyWorld = (): World => ({
    screens: [...SCREEN_FILES],
    sizes: {
      "relay-loop.mp4": 1 * MB,
      "relay-loop.webm": 1 * MB,
      "relay-full.mp4": 5 * MB,
      "relay-full.webm": 5 * MB,
      "relay-poster.webp": 40 * KB,
      "relay-poster.avif": 40 * KB,
    },
    durations: {
      "relay-loop.mp4": 17,
      "relay-loop.webm": 17,
      "relay-full.mp4": 75,
      "relay-full.webm": 75,
    },
    audioFiles: [],
    ssimOutput: "[Parsed_ssim_0] SSIM Y:0.99 All:0.995 (23.0)",
  });

  const baseName = (file: string) => path.basename(file);

  function install(world: World) {
    ffmpegCalls = [];
    mkdirCalls = [];
    rmCalls = [];
    vi.doMock("node:os", () => ({ tmpdir: () => "/scratch" }));
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
      mkdtempSync: vi.fn(() => SCRATCH),
      mkdirSync: vi.fn((dir: string) => {
        mkdirCalls.push(dir);
      }),
      rmSync: vi.fn((dir: string) => {
        rmCalls.push(dir);
      }),
      readdirSync: vi.fn(() => world.screens),
      statSync: vi.fn((file: string) => ({
        size:
          world.sizes[baseName(file)] ??
          (baseName(file).endsWith(".webp") ? 100 * KB : 0),
      })),
    }));
    vi.doMock("node:child_process", () => ({
      execFileSync: vi.fn((command: string, args: string[]) => {
        if (command === "ffmpeg") {
          ffmpegCalls.push(args);
          return "";
        }
        const file = args[args.length - 1];
        if (args.includes("format=duration")) {
          return `${world.durations[baseName(file)]}\n`;
        }
        return world.audioFiles.includes(baseName(file)) ? "audio\n" : "\n";
      }),
      spawnSync: vi.fn(() => ({ stderr: world.ssimOutput })),
    }));
  }

  const failures = (lines: string[]) =>
    lines.filter((line) => line.startsWith("FAIL"));

  it("passes with exit 0 when every budget, duration, audio and SSIM check holds", async () => {
    install(healthyWorld());

    const { code, lines } = await runScript([]);

    expect(code).toBe(0);
    expect(failures(lines)).toEqual([]);
    // 22 screens x2 (size + manifest), 6 budgets, 4 durations, 2 audio, 2 ssim
    expect(lines).toHaveLength(22 * 2 + 6 + 4 + 2 + 2);
    expect(lines).toContain(
      "pass  relay-loop.mp4 first-vs-last SSIM 0.995 >= 0.98",
    );
    expect(lines).toContain("pass  relay-loop.webm has no audio track");
  });

  it("always removes the scratch directory", async () => {
    install(healthyWorld());

    await runScript([]);

    expect(rmCalls).toEqual([SCRATCH]);
  });

  it("extracts a frame every 2 s for both cuts when a frames dir is given", async () => {
    install(healthyWorld());

    const { code, lines } = await runScript(["/out/frames"]);

    expect(code).toBe(0);
    expect(mkdirCalls).toEqual(["/out/frames/loop", "/out/frames/full"]);
    const extractions = ffmpegCalls.filter((args) => args.includes("-vf"));
    expect(extractions.map((args) => args[args.indexOf("-vf") + 1])).toEqual([
      "fps=1/2",
      "fps=1/2",
    ]);
    expect(extractions.map((args) => args[args.indexOf("-i") + 1])).toEqual([
      "public/media/relay/relay-loop.mp4",
      "public/media/relay/relay-full.mp4",
    ]);
    expect(lines).toContain(
      "frames  /out/frames/loop (every 2 s, for manual review)",
    );
  });

  it("does not extract frames without a frames dir", async () => {
    install(healthyWorld());

    await runScript([]);

    expect(mkdirCalls).toEqual([]);
    expect(ffmpegCalls.some((args) => args.includes("-vf"))).toBe(false);
  });

  it("fails a screen that is missing from the directory", async () => {
    const world = healthyWorld();
    world.screens = world.screens.filter((f) => f !== "chains-dark.webp");
    install(world);

    const { code, lines } = await runScript([]);

    expect(code).toBe(1);
    expect(lines).toContain("FAIL  chains-dark.webp missing from public/screens");
  });

  it("fails a screen over the 250 KB budget", async () => {
    const world = healthyWorld();
    world.sizes["transform-light.webp"] = 250 * KB + 1;
    install(world);

    const { code, lines } = await runScript([]);

    expect(code).toBe(1);
    expect(failures(lines)).toEqual([
      "FAIL  transform-light.webp 250001 bytes <= 250000",
    ]);
  });

  it("accepts a screen exactly at the 250 KB budget", async () => {
    const world = healthyWorld();
    world.sizes["transform-light.webp"] = 250 * KB;
    install(world);

    const { code } = await runScript([]);

    expect(code).toBe(0);
  });

  it("fails an orphan screen that is not in the manifest", async () => {
    const world = healthyWorld();
    world.screens = [...world.screens, "stray-light.webp"];
    install(world);

    const { code, lines } = await runScript([]);

    expect(code).toBe(1);
    expect(lines).toContain(
      "FAIL  stray-light.webp is in the screen manifest (no orphan)",
    );
  });

  it("fails a relay file over its size budget", async () => {
    const world = healthyWorld();
    world.sizes["relay-poster.avif"] = 80 * KB + 1;
    install(world);

    const { code, lines } = await runScript([]);

    expect(code).toBe(1);
    expect(failures(lines)).toEqual([
      "FAIL  relay-poster.avif 80001 bytes <= 80000",
    ]);
  });

  it.each([
    ["too short", "relay-loop.mp4", 14.99],
    ["too long", "relay-loop.webm", 20.01],
    ["full cut too short", "relay-full.mp4", 59],
    ["full cut too long", "relay-full.webm", 91],
  ])("fails a duration that is %s", async (_label, file, seconds) => {
    const world = healthyWorld();
    world.durations[file] = seconds;
    install(world);

    const { code, lines } = await runScript([]);

    expect(code).toBe(1);
    expect(failures(lines)).toHaveLength(1);
    expect(failures(lines)[0]).toContain(`${file} duration ${seconds.toFixed(2)} s`);
  });

  it("accepts durations exactly on the range edges", async () => {
    const world = healthyWorld();
    world.durations["relay-loop.mp4"] = 15;
    world.durations["relay-loop.webm"] = 20;
    world.durations["relay-full.mp4"] = 60;
    world.durations["relay-full.webm"] = 90;
    install(world);

    const { code } = await runScript([]);

    expect(code).toBe(0);
  });

  it("fails a loop that carries an audio track", async () => {
    const world = healthyWorld();
    world.audioFiles = ["relay-loop.webm"];
    install(world);

    const { code, lines } = await runScript([]);

    expect(code).toBe(1);
    expect(failures(lines)).toEqual([
      "FAIL  relay-loop.webm has no audio track",
    ]);
  });

  it("fails when first-vs-last SSIM is below 0.98", async () => {
    const world = healthyWorld();
    world.ssimOutput = "SSIM Y:0.9 All:0.9712 (15.4)";
    install(world);

    const { code, lines } = await runScript([]);

    expect(code).toBe(1);
    expect(failures(lines)).toHaveLength(2);
    expect(failures(lines)[0]).toContain("SSIM 0.9712 >= 0.98");
  });

  it("throws and still cleans up when ffmpeg prints no SSIM summary", async () => {
    const world = healthyWorld();
    world.ssimOutput = "unexpected output";
    install(world);

    await expect(runScript([])).rejects.toThrow(
      "no SSIM in ffmpeg output for public/media/relay/relay-loop.mp4",
    );
    expect(rmCalls).toEqual([SCRATCH]);
  });
});
