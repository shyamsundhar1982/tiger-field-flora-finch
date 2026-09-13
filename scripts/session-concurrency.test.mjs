import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_ACTIVE_SESSIONS_PER_USER,
  excessActiveSessionTokens,
} from "../src/lib/auth/session-concurrency.ts";

const at = (hour) => new Date(`2026-09-14T${String(hour).padStart(2, "0")}:00:00Z`);

test("session policy caps a user at five active sessions", () => {
  assert.equal(MAX_ACTIVE_SESSIONS_PER_USER, 5);
  const sessions = Array.from({ length: 8 }, (_, index) => ({
    token: `token-${index + 1}`,
    createdAt: at(index + 1),
    expiresAt: at(23),
  }));
  assert.deepEqual(
    excessActiveSessionTokens(sessions, "token-8", at(10)),
    ["token-3", "token-2", "token-1"],
  );
});

test("the newly created session is retained when timestamps tie", () => {
  const createdAt = at(8);
  const sessions = Array.from({ length: 6 }, (_, index) => ({
    token: `token-${index + 1}`,
    createdAt,
    expiresAt: at(23),
  }));
  const revoked = excessActiveSessionTokens(sessions, "token-6", at(10));
  assert.equal(revoked.length, 1);
  assert.ok(!revoked.includes("token-6"));
});

test("expired sessions do not consume the active-session allowance", () => {
  const sessions = [
    { token: "expired-1", createdAt: at(1), expiresAt: at(2) },
    { token: "expired-2", createdAt: at(2), expiresAt: at(3) },
    ...Array.from({ length: 5 }, (_, index) => ({
      token: `active-${index + 1}`,
      createdAt: at(index + 4),
      expiresAt: at(23),
    })),
  ];
  assert.deepEqual(excessActiveSessionTokens(sessions, "active-5", at(10)), []);
});
