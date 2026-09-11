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


## Vāyu Shastr Drive corpus

The broader private Vāyu Shastr Drive tree is a governed VIBPE reference source. It is recursively indexed with these rules:

- the folder named `google client secret for shyamsundhar1982` is explicitly excluded by folder ID;
- files/folders with credential-, password-, private-key-, API-key-, OAuth-token-, access-token-, or refresh-token-like names are excluded before content access;
- `FINAL DOSSIER` and `VAYU_MASTER_ENGINEERING_PACKAGE_REV1` paths are ranked as **controlled-reference** evidence;
- `VELOXIS ARCHITECTURE ITERATIONS`, draft, rough, sample, copy, old, preliminary, and Rev 0 paths are ranked **legacy-working** and down-ranked in retrieval;
- all other material is normal **reference** evidence;
- controlled-reference ranking improves retrieval priority but does **not** grant automatic master authority;
- unresolved/assumption content remains unresolved;
- canonical VIBPE master data and deterministic IBPE transaction truth always take precedence.

Text-like files and native Google Docs/Sheets are content-indexed where supported. Unsupported binary files are retained as metadata-only references with their Drive path/provenance so VIBPE can identify their existence without pretending their content has been parsed.
