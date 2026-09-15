import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const home = read("src/routes/index.tsx");
const range = read("src/routes/range/index.tsx");
const css = read("src/public-parallax.css");

test("public parallax is limited to Home and Range", () => {
  assert.match(home, /public-parallax\.css/);
  assert.match(range, /public-parallax\.css/);
  assert.match(home, /vyndi-public-hero/);
  assert.match(range, /vyndi-range-hero/);
});

test("public parallax uses CSS scroll-driven transforms without JS scroll work", () => {
  assert.match(css, /animation-timeline:\s*view\(\)/);
  assert.match(css, /translate3d/);
  assert.match(css, /prefers-reduced-motion/);
  for (const source of [home, range, css]) {
    assert.doesNotMatch(source, /MutationObserver/);
    assert.doesNotMatch(source, /createTreeWalker/);
    assert.doesNotMatch(source, /requestAnimationFrame/);
    assert.doesNotMatch(source, /addEventListener\s*\(\s*["']scroll/);
    assert.doesNotMatch(source, /<canvas/i);
  }
});

test("public color cues retain TANSAM lime and cyan accents", () => {
  assert.match(css, /#b9ff2c/i);
  assert.match(css, /#69e7ff/i);
  assert.match(home, /vyndi-public-lime/);
  assert.match(home, /vyndi-public-cyan/);
  assert.match(range, /vyndi-public-lime/);
  assert.match(range, /vyndi-public-cyan/);
});
