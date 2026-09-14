import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("successful password login keeps the visual transition short", async () => {
  const route = await source("src/routes/login.tsx");
  assert.match(route, /const LOGIN_WARP_DURATION_MS = 950;/);
  assert.match(route, /void authClient\.getSession\(\)\.catch/);
  assert.doesNotMatch(route, /setTimeout\(resolve, 520\)/);
  assert.doesNotMatch(route, /setTimeout\(resolve, 120\)/);
});

test("successful password login crosses the auth boundary with a fresh document request", async () => {
  const route = await source("src/routes/login.tsx");
  assert.match(route, /window\.location\.assign\(destination\)/);
  assert.match(route, /await navigate\(\{ to: destination as never \}\)/);
});

test("warp strands accelerate and revolve during command entry", async () => {
  const route = await source("src/routes/login.tsx");
  assert.match(route, /const LOGIN_WARP_STRAND_BOOST = 34;/);
  assert.match(route, /strands\.rotation\.z \+= dt \* 3\.8/);
  assert.match(route, /strands\.rotation\.y \+= dt \* 1\.45/);
});