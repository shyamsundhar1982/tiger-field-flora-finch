# VIBPE External Knowledge Policy

External connectivity exists to improve explanation, benchmarking and scenario assumptions. It is not a substitute for governed VYNDI business data.

## Permitted external intelligence

- market and competitor references
- commodity and component price references
- foreign-exchange and freight references
- supply-chain and manufacturing practices
- ERP / S&OP / IBP practices
- regulatory and accounting references

## Required metadata

Any external datum used in analysis should retain source, observation time and evidence/citation when available.

## Promotion rule

External evidence may become a governed VYNDI assumption only through the owning approval process. Until then it remains `external-reference` and advisory-only.

## Prohibited authority substitution

External information must not silently overwrite controlled BOM, inventory, supplier master, controlled unit cost, demand authority, approved plan, production status, accounting actual or transaction state.

## Governed weekly VYNDI reviews

The Google Drive folder **VYNDI Weekly Status Reviews — VIBPE Knowledge** is a registered first-party evidence source. Weekly reviews are intentionally advisory evidence, not master data. Claims are classified as `verified_fact`, `unresolved_item`, `assumption`, `decision`, `blocker`, `priority`, or `material_change`.

Even a `verified_fact` extracted from a weekly review remains advisory until it is promoted through the owning governed master process. `unresolved_item`, `assumption`, and `blocker` claims remain unresolved context and must never satisfy a master-data or engineering release gate.

When a weekly review conflicts with governed internal knowledge, the governed master record wins. The review is retained with provenance as conflict evidence; it is not silently discarded or promoted.
