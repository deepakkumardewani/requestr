// Composes the site-wide Open Graph image (1200x630) from a real product
// screenshot plus the wordmark. Re-runnable, offline, reads no env or secrets.
// Usage: bun scripts/capture/og-image.mjs [source-image]
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const DEFAULT_SOURCE = "agent_docs/polish-and-landing/hero/a/1440-dark.png";
const OUTPUT = path.join(ROOT, "public/og-image.png");

const WIDTH = 1200;
const HEIGHT = 630;
const BACKGROUND = "#09090b";
const ACCENT = "#10b981";
// Crop keeps the hero card and drops the dev-overlay badge in the corner.
const CROP = { left: 90, top: 180, width: 690, height: 360 };
const SHOT_LEFT = 460;
const SHOT_RADIUS = 16;
const PNG_PALETTE_COLORS = 128;

const wordmark = `
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect x="64" y="${HEIGHT / 2 - 150}" width="8" height="64" rx="4" fill="${ACCENT}"/>
  <text x="92" y="${HEIGHT / 2 - 98}" font-family="Helvetica, Arial, sans-serif" font-size="52" font-weight="700" fill="#ffffff">Requestr</text>
  <text font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#a1a1aa">
    <tspan x="64" y="${HEIGHT / 2 - 20}">An API client</tspan>
    <tspan x="64" y="${HEIGHT / 2 + 20}">with an AI</tspan>
    <tspan x="64" y="${HEIGHT / 2 + 60}">built in.</tspan>
  </text>
</svg>`;

const roundedMask = Buffer.from(
  `<svg width="${CROP.width}" height="${CROP.height}"><rect width="${CROP.width}" height="${CROP.height}" rx="${SHOT_RADIUS}"/></svg>`,
);

async function main() {
  const source = path.resolve(ROOT, process.argv[2] ?? DEFAULT_SOURCE);
  const shot = await sharp(source)
    .extract(CROP)
    .composite([{ input: roundedMask, blend: "dest-in" }])
    .png()
    .toBuffer();

  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: BACKGROUND,
    },
  })
    .composite([
      {
        input: shot,
        left: SHOT_LEFT,
        top: Math.round((HEIGHT - CROP.height) / 2),
      },
      { input: Buffer.from(wordmark), left: 0, top: 0 },
    ])
    .png({ palette: true, colors: PNG_PALETTE_COLORS })
    .toFile(OUTPUT);
  console.log(`wrote ${path.relative(ROOT, OUTPUT)}`);
}

main().catch((error) => {
  console.error("og-image generation failed:", error);
  process.exit(1);
});
