// Export the user-supplied Flow S master without changing its artwork.
// Run with a Sharp installation available through NODE_PATH.
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
const sharp = createRequire(import.meta.url)("sharp");
const svg = await readFile(new URL("../../public/icons/stride-v3.svg", import.meta.url));
await writeFile("public/icons/stride.svg", svg);
for (const size of [192, 512, 180]) {
  const png = await sharp(svg).resize(size, size).png().toBuffer();
  await writeFile(`public/icons/stride-v3-${size}.png`, png);
  await writeFile(`public/icons/stride-${size}.png`, png);
}
