import assert from "node:assert/strict";
import test from "node:test";
import {
  isRetryableOptimizerTransportError,
  runWithSingleOptimizerTransportRetry,
} from "./optimizer-transport-retry.ts";

test("optimizer transport retry recognizes fetch/network failures only", () => {
  assert.equal(isRetryableOptimizerTransportError(new TypeError("Failed to fetch")), true);
  assert.equal(isRetryableOptimizerTransportError(new Error("NetworkError when attempting to fetch resource")), true);
  assert.equal(isRetryableOptimizerTransportError(new Error("Governed optimization blocked by preparation gate")), false);
});

test("optimizer transport retry retries exactly once", async () => {
  let attempts = 0;
  let retries = 0;
  const result = await runWithSingleOptimizerTransportRetry(
    async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError("Failed to fetch");
      return "persisted";
    },
    { delayMs: 0, onRetry: () => { retries += 1; } },
  );
  assert.equal(result, "persisted");
  assert.equal(attempts, 2);
  assert.equal(retries, 1);
});

test("optimizer transport retry does not retry governed application errors", async () => {
  let attempts = 0;
  await assert.rejects(
    () => runWithSingleOptimizerTransportRetry(
      async () => {
        attempts += 1;
        throw new Error("Governed optimization blocked by preparation gate");
      },
      { delayMs: 0 },
    ),
    /preparation gate/,
  );
  assert.equal(attempts, 1);
});
