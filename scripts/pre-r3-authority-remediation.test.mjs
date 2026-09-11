import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const productMigration = readFileSync(new URL("../migrations/0049_canonical_product_authority.sql", import.meta.url), "utf8");
const productAuthority = readFileSync(new URL("../src/lib/product-authority.ts", import.meta.url), "utf8");
const models = readFileSync(new URL("../src/lib/data/models.ts", import.meta.url), "utf8");

const currentVariantIds = [...models.matchAll(/\{id:"([^"]+)"/g)].map((match) => match[1]);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// G1 — Product master authority.
test("G1 persists only the three canonical VYNDI product family identities", () => {
  for (const [family, alias] of [["longitude", "core"], ["latitude", "pro"], ["altitude", "apex"]]) {
    assert.match(productMigration, new RegExp(`'${family}'[^\\n]+ '${alias}'`));
  }
  assert.match(productMigration, /VINDY Longitude/);
  assert.match(productMigration, /VINDY Latitude/);
  assert.match(productMigration, /VINDY Altitude/);
  assert.match(productMigration, /compatibility alias for legacy code only/i);
});

test("G1 preserves every current order-facing variant identifier in canonical persistence", () => {
  assert.equal(currentVariantIds.length, 10, "Unexpected model catalogue size; update the canonical cutover intentionally.");
  for (const id of currentVariantIds) {
    assert.match(productMigration, new RegExp(`'${escapeRegExp(id)}'`), `Missing canonical variant ${id}`);
  }
  assert.match(productMigration, /compatibility_variant_id text not null unique/);
  assert.match(productAuthority, /resolveCanonicalProductVariant/);
  assert.match(productAuthority, /v\.variant_id=.*or v\.compatibility_variant_id=/s);
});

test("G1 exposes canonical business identity while legacy tier lookup stays server-side", () => {
  assert.match(productAuthority, /listCanonicalProductCatalog/);
  assert.match(productAuthority, /resolveCanonicalFamilyByCompatibilityTier/);
  assert.match(productAuthority, /implementation alias rather than the\s+\* user-facing business identity/s);
  assert.doesNotMatch(productAuthority, /familyName:\s*"core"|familyName:\s*"pro"|familyName:\s*"apex"/);
});
