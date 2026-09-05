# EPR Containment & Recall Attack Test

## Objective

Prove that a defective material lot, process condition, equipment/operator issue, or serialised unit can be traced forward to affected travellers and blocked from release without containing unrelated units.

## Attack cases

1. Defective material lot → identify every affected serial/traveller.
2. Process/equipment source → identify all units processed through the affected source.
3. Critical NCR/CAPA → create an active release block.
4. Quarantine/hold/rework/recall → prevent release while active.
5. Clear containment → remove only the intended release block after authorised action.
6. Venture isolation → carbon containment must not affect aluminium.
7. Duplicate targeting → active duplicate containment must be rejected.
8. Audit → opening, targeting and clearing must be append-only audited.
9. Serial genealogy → affected units remain discoverable through forward and backward genealogy.
10. Release gate → a contained traveller cannot be released by the normal EPR release function.

## Benchmark

Mature lot-traceability systems support forward/where-used analysis to isolate affected products for containment, rework or recall, and backward correlation for root-cause analysis. They also correlate materials, equipment, processes, operators and quality results. citeturn0search0turn0search12

## Current status

The database control layer and server functions are implemented. Cloudflare production database execution remains a required runtime verification. This software control does not itself constitute physical product recall, regulatory approval, or manufacturing validation.
