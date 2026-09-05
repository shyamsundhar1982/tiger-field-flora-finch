# EPR Containment → Release Block Test

## Objective

Prove that an active containment, quarantine, rework or recall condition cannot be bypassed by the EPR software release action.

## Required control

`Suspect lot/process/equipment → affected serials → active containment → release blocked → disposition/clearance → release eligible`

## Test cases

1. Create an active containment case for a traveller/serial.
2. Confirm release readiness reports the containment blocker.
3. Attempt `releaseEprTraveller`; it must fail.
4. Confirm the traveller remains unreleased.
5. Confirm the blocker identifies the containment case and disposition.
6. Clear/cancel the containment through an authorised workflow.
7. Re-run readiness; the containment blocker must disappear.
8. Re-run release only after all other EPR gates/evidence/NCR/inspection controls pass.
9. Verify venture isolation: a Carbon containment cannot block an unrelated Aluminium traveller.
10. Verify audit events exist for containment and clearance.

## Design boundary

Containment is an operational software control. It does not by itself prove a physical recall, field action, regulatory notification, or physical quarantine. Those require objective evidence and responsible human disposition.

## Benchmark basis

Mature traceability systems use forward/where-used genealogy to isolate affected products and support containment, rework and investigation. Siemens describes this as a core lot-traceability capability. citeturn0search0turn0search13

## Runtime status

Implemented in `main`; actual Cloudflare database execution remains a runtime verification requirement.
