import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const home = read("src/routes/index.tsx");
const range = read("src/routes/range/index.tsx");
const css = read("src/public-parallax.css");

test("public cinematic parallax is limited to Home and Range", () => {
  assert.match(home, /public-parallax\.css/);
  assert.match(range, /public-parallax\.css/);
  assert.match(home, /vyndi-cinematic-stage/);
  assert.match(range, /vyndi-cinematic-stage/);
});

test("public scene has real CSS 3D depth and scroll-linked camera motion", () => {
  assert.match(css, /perspective:\s*1450px/);
  assert.match(css, /transform-style:\s*preserve-3d/);
  assert.match(css, /translateZ\(/);
  assert.match(css, /animation-timeline:\s*view\(\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(home, /onPointerMove=\{handleScenePointerMove\}/);
  assert.match(range, /onPointerMove=\{handleScenePointerMove\}/);
});

test("cinematic motion avoids protected-app style runtime loops", () => {
  for (const source of [home, range, css]) {
    assert.doesNotMatch(source, /MutationObserver/);
    assert.doesNotMatch(source, /createTreeWalker/);
    assert.doesNotMatch(source, /requestAnimationFrame/);
    assert.doesNotMatch(source, /addEventListener\s*\(\s*["']scroll/);
    assert.doesNotMatch(source, /<canvas/i);
    assert.doesNotMatch(source, /from\s+["']three["']|import\s*\(\s*["']three["']|@react-three|webgl/i);
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
