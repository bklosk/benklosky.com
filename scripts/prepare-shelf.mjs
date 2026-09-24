// Usage: node scripts/prepare-shelf.mjs /path/to/bgg-export
// Only game metadata and aggregate play counts are published; never player records.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = process.argv[2];
if (!source) throw new Error("Pass the directory containing games.json and collection.json.");
const output = "src/app/shelf/data";
await mkdir(output, { recursive: true });
await mkdir("public/shelf", { recursive: true });
const games = JSON.parse(await readFile(path.join(source, "games.json"), "utf8"));
const collection = JSON.parse(await readFile(path.join(source, "collection.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(source, "manifest.json"), "utf8"));
const owned = new Map(collection.filter((entry) => entry.owned).map((entry) => [entry.object_id, entry]));
const records = games.map((game) => ({
  id: game.object_id,
  owned: owned.has(game.object_id),
  name: game.name,
  year: game.year_published,
  expansion: game.subtype === "boardgameexpansion",
  url: game.bgg_url,
  image: game.image_url,
  description: game.description,
  summary: game.short_description,
  minPlayers: game.min_players,
  maxPlayers: game.max_players,
  minMinutes: game.min_playtime_minutes,
  maxMinutes: game.max_playtime_minutes,
  age: game.min_age,
  designers: game.designers.map((person) => person.name),
  categories: game.categories.map((category) => category.name),
  mechanics: game.mechanics.map((mechanic) => mechanic.name),
  rating: game.bgg_stats?.average ?? null,
  weight: game.bgg_stats?.weight ?? null,
  rank: game.overall_rank,
  plays: collection.find((entry) => entry.object_id === game.object_id)?.num_plays ?? 0,
}));
await writeFile(path.join(output, "games.json"), JSON.stringify(records, null, 2) + "\n");
await writeFile(path.join(output, "source.json"), JSON.stringify({
  retrieved: manifest.retrieved,
  url: manifest.source,
  username: manifest.username,
}, null, 2) + "\n");

// Rectify the photographed shelf face into a square texture atlas. Coordinates
// are measured on the 2000 x 1500 reference; a homography removes perspective.
const photo = "src/app/board_game_shelf.jpeg";
const { data, info } = await sharp(photo).resize(4000, 3000).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const corners = [[246, 383], [1453, 336], [1370, 1457], [379, 1388]].map(([x, y]) => [x * 2, y * 2]);
const square = [[0, 0], [1, 0], [1, 1], [0, 1]];
const equations = [];
for (let i = 0; i < 4; i++) {
  const [u, v] = square[i];
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
// Retain twice the pixels of the layout coordinates for sharp browser zoom.
const size = 2400;
const pixels = Buffer.alloc(size * size * 3);
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const u = x / (size - 1), v = y / (size - 1);
    const divisor = h[6] * u + h[7] * v + 1;
    const sx = (h[0] * u + h[1] * v + h[2]) / divisor;
    const sy = (h[3] * u + h[4] * v + h[5]) / divisor;
    const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
    for (let c = 0; c < 3; c++) {
      const sample = (dx, dy) => data[((iy + dy) * info.width + ix + dx) * 3 + c];
      pixels[(y * size + x) * 3 + c] = sample(0, 0) * (1-fx) * (1-fy) + sample(1, 0) * fx * (1-fy) + sample(0, 1) * (1-fx) * fy + sample(1, 1) * fx * fy;
    }
  }
}
await sharp(pixels, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: 90 }).toFile("public/shelf/spines.webp");
await sharp(photo).resize(1600).webp({ quality: 85 }).toFile("public/shelf/reference.webp");
await sharp(photo).resize(3200).webp({ quality: 90 }).toFile("public/shelf/top.webp");
console.log(`Prepared ${records.length} game records and shelf textures. No personal play records copied.`);
