import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const root = read("src/routes/__root.tsx");
const theme = read("src/tansam-vyndi-theme.css");
const kpi = read("src/components/kpi.tsx");

test("TANSAM-derived theme is loaded after the base design system", () => {
  const base = root.indexOf('import "../styles.css"');
  const tansam = root.indexOf('import "../tansam-vyndi-theme.css"');
  assert.ok(base >= 0, "base styles import is required");
  assert.ok(tansam > base, "TANSAM theme must load after base styles");
  assert.match(root, /theme-color[^\n]+#060809/);
});

test("TANSAM visual language keeps its canonical palette and static engineering grid", () => {
  for (const token of ["#060809", "#0b0e10", "#ff7a1a", "#b9ff2c", "#69e7ff", "#d7a957"])
    assert.match(theme, new RegExp(token.replace("#", "#")));
  assert.match(theme, /72px 72px/);
  assert.match(theme, /Global Command search/);
  assert.match(theme, /vyndi-tansam-panel/);
  assert.match(theme, /vyndi-tansam-kpi/);
  assert.match(kpi, /vyndi-tansam-panel/);
  assert.match(kpi, /vyndi-tansam-kpi/);
  assert.match(kpi, /vyndi-tansam-kicker/);
});

test("TANSAM app theme remains static and avoids known runtime performance hazards", () => {
  for (const forbidden of [
    /MutationObserver/,
    /createTreeWalker/,
    /requestAnimationFrame/,
    /mousemove/,
    /pointermove/,
    /addEventListener\s*\(\s*["']scroll/,
    /@keyframes/,
    /animation\s*:/,
    /will-change\s*:/,
    /background-attachment\s*:\s*fixed/,
    /filter\s*:\s*blur/,
    /<canvas/i,
  ]) assert.doesNotMatch(theme, forbidden);

  assert.match(theme, /backdrop-filter:\s*none/);
});
