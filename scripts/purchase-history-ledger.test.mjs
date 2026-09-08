import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const authority = await readFile(new URL("../src/lib/purchase-history-ledger.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../src/routes/command/purchase-execution.tsx", import.meta.url), "utf8");
const component = await readFile(new URL("../src/components/purchase-history-ledger.tsx", import.meta.url), "utf8");

test("purchase history remains a derived read model over governed transaction truth", () => {
  for (const source of [
    "vyndi_purchase_orders",
    "vyndi_suppliers",
    "vyndi_goods_receipts",
    "vyndi_supplier_invoices",
    "vyndi_supplier_payments",
  ]) {
    assert.match(authority, new RegExp(source));
  }
  assert.match(authority, /createServerFn\(\{ method: "GET" \}\)/);
  assert.doesNotMatch(authority, /createServerFn\(\{ method: "POST" \}\)/);
  assert.doesNotMatch(authority, /\binsert\s+into\b/i);
  assert.doesNotMatch(authority, /\bupdate\s+vyndi_/i);
  assert.doesNotMatch(authority, /\bdelete\s+from\b/i);
});

test("purchase execution is the single entry point and exposes the derived audit ledger", () => {
  assert.match(page, /getPurchaseExecutionData\(\)/);
  assert.match(page, /getPurchaseHistoryData\(\)/);
  assert.match(page, /<PurchaseHistoryLedger\s+rows=\{data\.purchaseHistory\}\s*\/>/);
  assert.match(component, /Purchase History Ledger/);
  assert.match(component, /PO → GRN → Inventory → Invoice \/ GST → Payment/);
  assert.match(component, /Export CSV/);
  assert.match(component, /Editing remains in the owning transaction screens/);
});
