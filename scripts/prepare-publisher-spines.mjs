// Optional: regenerate the verified, publisher-sourced box textures.
// Usage: node scripts/prepare-publisher-spines.mjs
// Coordinates are measured on a 600px-wide preview of each official 3D render.
// The four points follow the real side panel, clockwise from the top left.
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const store = "https://store.stonemaiergames.com";
const assets = [
  { key: "r0-19", handle: "stamp-swap", imageName: "3Dbox_b143dc5f-8b12-4cf6-b9c4-db630e895c1b.png", corners: [[28, 44], [98, 2], [98, 610], [28, 593]], width: 180, height: 720 },
  { key: "r0-20", handle: "rolling-realms", imageName: "3d-rollingrealms.png", corners: [[33, 7], [119, 142], [119, 573], [33, 575]], width: 180, height: 720 },
  { key: "r0-21", handle: "tapestry", imageName: "3d-tapestry2024.png", corners: [[23, 48], [98, 2], [98, 600], [23, 590]], width: 180, height: 720 },
  { key: "r1-19", handle: "wyrmspan", imageName: "3d-wyrmspan.png", corners: [[47, 37], [98, 3], [98, 603], [47, 615]], width: 180, height: 720 },
  { key: "r2-28", handle: "finspan", imageName: "3d-finspan.png", corners: [[46, 39], [100, 2], [100, 615], [46, 601]], width: 150, height: 720 },
  { key: "r2-29", handle: "wingspan-european-expansion", imageName: "WingspanEuropeanExpansionBoardGame.png", corners: [[6, 16], [84, 2], [84, 299], [6, 295]], width: 180, height: 720 },
  { key: "r3-0", handle: "expeditions", imageName: "Standard-with-Label.png", corners: [[23, 46], [98, 3], [98, 708], [23, 696]], width: 180, height: 720 },
  // The Nesting Box is a storage box for the base game, not its own game record.
  { key: "top-wingspan", handle: "wingspan-nesting-box", imageName: "StonemaierWingspanNesting3DBox_de0d9f5b-ae61-4e6f-a89b-5672538e325f.png", corners: [[4, 80], [99, 2], [99, 421], [4, 402]], width: 680, height: 520 },
  { key: "top-scythe", handle: "scythe", imageName: "3d-scythe.png", corners: [[101, 3], [577, 89], [577, 497], [101, 516]], width: 680, height: 520 },
  { key: "top-vantage", handle: "vantage", imageName: "3d-vantage.png", corners: [[149, 6], [578, 191], [578, 600], [149, 603]], width: 680, height: 520 },
];

function homography(corners, width, height) {
  const equations = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = [[0, 0], [1, 0], [1, 1], [0, 1]][i];
    const [x, y] = corners[i];
    equations.push([u, v, 1, 0, 0, 0, -x * u, -x * v, x]);
    equations.push([0, 0, 0, u, v, 1, -y * u, -y * v, y]);
  }
  for (let i = 0; i < 8; i++) {
    let pivot = i;
    for (let j = i + 1; j < 8; j++) if (Math.abs(equations[j][i]) > Math.abs(equations[pivot][i])) pivot = j;
    [equations[i], equations[pivot]] = [equations[pivot], equations[i]];
    const divisor = equations[i][i];
    for (let k = i; k < 9; k++) equations[i][k] /= divisor;
    for (let j = 0; j < 8; j++) {
      if (j === i) continue;
      const factor = equations[j][i];
      for (let k = i; k < 9; k++) equations[j][k] -= factor * equations[i][k];
    }
  }
  const h = equations.map((row) => row[8]);
  const pixels = Buffer.alloc(width * height * 4);
  return { h, pixels };
}

async function rectify(image, corners, width, height) {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const points = corners.map(([x, y]) => [x * info.width / 600, y * info.width / 600]);
  const { h, pixels } = homography(points, width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = (x + .5) / width, v = (y + .5) / height;
      const divisor = h[6] * u + h[7] * v + 1;
      const sx = (h[0] * u + h[1] * v + h[2]) / divisor;
      const sy = (h[3] * u + h[4] * v + h[5]) / divisor;
      const ix = Math.max(0, Math.min(info.width - 2, Math.floor(sx)));
      const iy = Math.max(0, Math.min(info.height - 2, Math.floor(sy)));
      const fx = Math.max(0, Math.min(1, sx - ix));
      const fy = Math.max(0, Math.min(1, sy - iy));
      for (let c = 0; c < 4; c++) {
        const sample = (dx, dy) => data[((iy + dy) * info.width + ix + dx) * 4 + c];
        pixels[(y * width + x) * 4 + c] = sample(0, 0) * (1 - fx) * (1 - fy) + sample(1, 0) * fx * (1 - fy) + sample(0, 1) * (1 - fx) * fy + sample(1, 1) * fx * fy;
      }
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 4 } }).flatten({ background: "#e5e5d9" }).webp({ quality: 91 }).toBuffer();
}

await mkdir("public/shelf/publisher", { recursive: true });
const provenance = [];
for (const asset of assets) {
  const page = `${store}/products/${asset.handle}`;
  const productResponse = await fetch(`${page}.js`);
  if (!productResponse.ok) throw new Error(`Could not find official render: ${page}`);
  const product = await productResponse.json();
  const sourceImage = product.images.find((image) => image.split("/").at(-1)?.split("?")[0] === asset.imageName);
  if (!sourceImage) throw new Error(`Verified image no longer listed for ${page}: ${asset.imageName}`);
  const imageUrl = `https:${sourceImage}`;
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error(`Could not download image: ${imageUrl}`);
  const output = `/shelf/publisher/${asset.key}.webp`;
  const texture = await rectify(Buffer.from(await imageResponse.arrayBuffer()), asset.corners, asset.width, asset.height);
  await writeFile(`public${output}`, texture);
  provenance.push({ key: asset.key, output, page, imageUrl });
  console.log(`${asset.key}: ${product.title} (${Math.round(texture.byteLength / 1024)} KiB)`);
}
await writeFile("src/app/shelf/data/publisher-spines.json", JSON.stringify(provenance, null, 2) + "\n");
