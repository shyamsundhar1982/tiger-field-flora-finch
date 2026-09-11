import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("shared governed lifecycle component is present", () => {
  const source = read("src/components/governed-lifecycle.tsx");
  assert.match(source, /export function GovernedLifecycle/);
  assert.match(source, /actions\.map/);
});

test("Action Inbox uses governed lifecycle controls", () => {
  const source = read("src/routes/command/decision-inbox.tsx");
  assert.match(source, /GovernedLifecycle/);
  assert.match(source, /Start action/);
  assert.match(source, /Complete action/);
});

test("Master Plan exposes governed submit and approval lifecycle", () => {
  const source = read("src/routes/command/planning.tsx");
  assert.match(source, /GovernedLifecycle/);
  assert.match(source, /Submit for approval/);
  assert.match(source, /Approve revision/);
});

test("Receiving exposes quarantine disposition through governed lifecycle", () => {
  const source = read("src/routes/command/receiving.tsx");
  assert.match(source, /GovernedLifecycle/);
  assert.match(source, /Disposition evidence is mandatory/);
  assert.match(source, /Accept to stock/);
  assert.match(source, /Reject material/);
});
