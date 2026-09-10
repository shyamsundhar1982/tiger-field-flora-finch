import assert from "node:assert/strict";
import test from "node:test";
import { isBearerTransportHost } from "./bearer-transport.ts";

test("bearer transport is limited to Grok sandbox preview hosts", () => {
  assert.equal(isBearerTransportHost("preview-123.grok-sandbox.com"), true);
  assert.equal(isBearerTransportHost("grok-sandbox.com"), false);
  assert.equal(isBearerTransportHost("tiger-field-flora-finch.vercel.app"), false);
  assert.equal(isBearerTransportHost("tiger-field-flora-finch.shyamsundhar1982.workers.dev"), false);
});
