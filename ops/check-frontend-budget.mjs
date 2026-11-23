import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const buildDir = resolve(process.argv[2] || "frontend/build/assets");
const maxInitialChunkBytes = 250_000;
const files = await readdir(buildDir);
const initialChunks = files.filter((name) => /^index-[^/]+\.js$/.test(name));
if (initialChunks.length === 0) throw new Error(`Nenhum chunk inicial encontrado em ${buildDir}`);

const sizes = await Promise.all(initialChunks.map(async (name) => ({ name, bytes: (await stat(join(buildDir, name))).size })));
const oversized = sizes.filter(({ bytes }) => bytes > maxInitialChunkBytes);
if (oversized.length) {
  throw new Error(`Chunk inicial acima do orçamento de ${maxInitialChunkBytes} bytes: ${oversized.map(({ name, bytes }) => `${name} (${bytes})`).join(", ")}`);
}
for (const { name, bytes } of sizes) console.log(`Bundle budget OK: ${name} (${bytes} bytes)`);
