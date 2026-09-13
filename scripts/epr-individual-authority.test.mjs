import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const businessActor = read("src/lib/business-actor.ts");
const execution = read("src/lib/epr/execution.ts");
const containment = read("src/lib/epr/containment.ts");
const genealogy = read("src/lib/epr/genealogy.ts");
const fiveM = read("src/lib/epr/five-m.ts");
const traceability = read("src/lib/epr/traceability.ts");
const finalControl = read("src/lib/epr/final-control.ts");

test("central business mutation authority enforces same-site requests", () => {
  assert.match(businessActor, /import \{ assertSameSiteRequest \} from "@\/lib\/auth\/isolation\.server"/);
  assert.match(businessActor, /assertSameSiteRequest\(\);\s*const \{ user, role \} = await getAssignedBusinessIdentity/s);
});

test("EPR execution and containment mutations require an individual admin actor", () => {
  for (const source of [execution, containment]) {
    assert.match(source, /if \(write\) \{\s*const actor = await requireBusinessActor\("admin"\);\s*return actor\.userId;/s);
    assert.match(source, /requireCommand\(true\)/);
  }
});

test("genealogy rebuild cannot use a shared Command admin session", () => {
  assert.match(genealogy, /const actor = await requireBusinessActor\("admin"\)/);
  assert.match(genealogy, /rebuild_epr_genealogy\(\$1,\$2\).*actor\.userId/s);
  assert.doesNotMatch(genealogy, /role !== "admin".*rebuild genealogy/s);
});

test("5M mutations require an individually authenticated admin", () => {
  assert.match(fiveM, /const actor = await requireBusinessActor\("admin"\)/);
  assert.doesNotMatch(fiveM, /getCommandRole/);
});

test("traceability and final-control split legacy read authority from individual mutation authority", () => {
  for (const source of [traceability, finalControl]) {
    assert.match(source, /async function admin\(write = false\)/);
    assert.match(source, /if \(write\) \{\s*const actor = await requireBusinessActor\("admin"\);\s*return actor\.userId;/s);
    assert.match(source, /admin\(true\)/);
  }
});
