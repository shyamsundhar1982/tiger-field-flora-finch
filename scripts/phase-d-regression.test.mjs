import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("Phase D: brand hierarchy is explicit", () => {
  const s = read("src/lib/brand.ts");
  assert.match(s, /parent:\s*"Vayu Shastr Pvt\. Ltd\."/);
  assert.match(s, /consumer:\s*"Vyndi"/);
  assert.match(s, /product:\s*"VELOXIS"/);
  assert.match(s, /tagline:\s*"Wind, rendered in carbon\."/);
});

test("Phase D: legacy accented brand spelling is removed from visible engineering page", () => {
  assert.doesNotMatch(read("src/routes/command/design-philosophy.tsx"), /VéLOXIS/);
  assert.match(read("src/routes/command/design-philosophy.tsx"), /VELOXIS Design Philosophy/);
});

test("Phase D: glow/shadow effect is removed from global form focus", () => {
  assert.doesNotMatch(read("src/styles.css"), /\.control:focus[^}]*box-shadow/);
});

test("Phase D: release surface contains accessibility and regression gates", () => {
  const shell = read("src/components/site-header.tsx") + read("src/components/command-shell.tsx");
  assert.match(shell, /aria-label/);
  assert.match(shell, /focus-visible:ring/);
  assert.match(read("src/styles.css"), /prefers-reduced-motion/);
});
