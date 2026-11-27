import fs from "node:fs";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const [referencePath, candidatePath, differencePath] = process.argv.slice(2);
if (!differencePath) throw new Error("Usage: node compare.mjs reference.png candidate.png differences.png");
const paths = [referencePath, candidatePath, differencePath].map(p => path.resolve(p));
if (new Set(paths).size !== 3) throw new Error("Use a separate output path");
const [reference, candidate] = paths.slice(0, 2).map(p => PNG.sync.read(fs.readFileSync(p)));
if (reference.width !== candidate.width || reference.height !== candidate.height) throw new Error("Viewport sizes differ");
const { width, height } = reference;
const diff = new PNG({ width, height });
const pixels = pixelmatch(reference.data, candidate.data, diff.data, width, height, { threshold: .1 });
fs.writeFileSync(paths[2], PNG.sync.write(diff));
console.log(JSON.stringify({ width, height, pixels, percent: 100 * pixels / (width * height) }));
