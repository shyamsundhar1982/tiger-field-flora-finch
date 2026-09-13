import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { injectWorkersSourceSha, workersCiCommitSha } from "./with-app-env.mjs";

test("Workers Builds commit SHA validation", () => {
  const sha = "66be4589773909d91ddb770da2e39574cb6740a9";
  assert.equal(workersCiCommitSha({ WORKERS_CI_COMMIT_SHA: sha }), sha);
  assert.equal(workersCiCommitSha({ WORKERS_CI_COMMIT_SHA: "abc123" }), undefined);
  assert.equal(workersCiCommitSha({ WORKERS_CI_COMMIT_SHA: "not-a-sha" }), undefined);
});

test("Workers Builds commit SHA becomes a Wrangler runtime variable", () => {
  const root = mkdtempSync(join(tmpdir(), "workers-sha-"));
  const configPath = join(root, "wrangler.jsonc");
  writeFileSync(configPath, JSON.stringify({
    name: "test-worker",
    keep_vars: true,
    vars: { EXISTING: "preserve-me" },
    hyperdrive: [{ binding: "HYPERDRIVE", id: "test" }],
  }));

  const sha = "66be4589773909d91ddb770da2e39574cb6740a9";
  assert.equal(injectWorkersSourceSha(root, { WORKERS_CI_COMMIT_SHA: sha }), true);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  assert.equal(config.vars.EXISTING, "preserve-me");
  assert.equal(config.vars.VYNDI_SOURCE_SHA, sha);
  assert.deepEqual(config.hyperdrive, [{ binding: "HYPERDRIVE", id: "test" }]);
});

test("Wrangler config stays untouched outside Workers Builds", () => {
  const root = mkdtempSync(join(tmpdir(), "workers-sha-"));
  const configPath = join(root, "wrangler.jsonc");
  const original = '{"name":"test-worker"}\n';
  writeFileSync(configPath, original);
  assert.equal(injectWorkersSourceSha(root, {}), false);
  assert.equal(readFileSync(configPath, "utf8"), original);
});
