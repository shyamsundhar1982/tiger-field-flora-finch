# VYNDI ISO Quality & Product Compliance — V1

## Purpose

This release adds a governed product-compliance layer to the existing VYNDI Engineering and Quality authorities. It is designed for Vāyú bicycle development and production evidence, with ISO 4210 frame/fork validation as the first product-standard workflow.

VYNDI is **not** a substitute for a licensed controlled copy of an ISO standard and does not reproduce proprietary ISO requirement text, test limits, cycle counts or acceptance tables. The system stores internal requirement IDs, controlled references, evidence, results, approvals and audit history.

## Controlled standards register

V1 registers:

- ISO 4210-2:2023 — bicycle safety/performance requirement authority.
- ISO 4210-3:2023 — common bicycle test-method authority.
- ISO 4210-6:2023 — frame and fork test-method authority.
- ISO 9001:2015 — current adopted QMS baseline in the V1 seed, with the 2026 edition held as a controlled transition-watch record until publication/adoption review.
- ISO 10012:2026 — measurement-management authority.
- ISO/IEC 17025:2017 — laboratory competence/accreditation evidence authority.

The standards register supports edition, lifecycle state, official source, controlled-copy reference, amendment watch and review metadata.

## Product-validation digital thread

The intended governed chain is:

`Engineering baseline → ISO requirement matrix → approved ITP → test execution → raw evidence / analysis → NCR/CAPA when required → retest → release readiness → Engineering approval + Quality approval → product release decision`

The existing canonical `vyndi_quality_inspections`, `vyndi_quality_ncrs`, `vyndi_quality_capas` and `vyndi_quality_releases` remain the Quality authority. ISO validation extends them rather than creating a competing NCR/CAPA system.

## ISO 4210 frame/fork verification catalogue

Internal method IDs are provided for the frame/fork validation families:

- `FR-IMP-01` — frame impact verification A.
- `FR-IMP-02` — frame/fork assembly impact verification.
- `FR-FAT-01` — pedalling-load frame fatigue verification.
- `FR-FAT-02` — horizontal-load frame fatigue verification.
- `FR-FAT-03` — vertical-load frame fatigue verification.
- `FR-BRK-01` — frame brake-mount verification.
- `FK-STR-01` — fork tensile/retention strength verification.
- `FK-STR-02` — fork static-bending verification.
- `FK-IMP-01` — fork impact verification.
- `FK-FAT-01` — fork fatigue verification.
- `FK-BRK-01` — fork disc-brake structural verification.
- `FK-STM-01` — fork steerer/interface fatigue verification.

Each method points to a controlled internal method reference. The licensed ISO copy remains the source for exact apparatus, loads, cycles, tolerances and acceptance criteria.

## Measurement and calibration control

`vyndi_iso_measurement_equipment` records the equipment identity, calibration requirement, calibration date, due date and certificate reference.

For a physical ISO test, the server checks every linked equipment item before recording the result. If required calibration is missing, expired or the equipment is not active, execution is blocked.

The test-to-equipment link stores a calibration snapshot so the evidence answers the historical question: **was the instrument valid when this test was performed?**

## Laboratory evidence

Each ISO test run records one of:

- `confirmed` — ISO/IEC 17025 status is being claimed and supporting evidence should be linked/controlled;
- `not_claimed` — no accreditation claim is made;
- `not_applicable` — the test context does not require that claim.

VYNDI records the claim/evidence status; it does not certify or accredit a laboratory.

## NCR / CAPA / retest linkage

A test result recorded as `fail` must reference a canonical Quality NCR. CAPA continues through the existing Quality authority. A retest can reference the prior test run through `retest_of`, preserving the validation history instead of replacing failed evidence.

## Product release gate

The live release-readiness calculation blocks approval when any of the following applies:

- the Engineering baseline is not released;
- no approved ITP exists for the product/revision;
- the approved ITP has no mandatory verification items;
- one or more mandatory verification items lacks passing evidence;
- an ISO-linked NCR remains open;
- an ISO-linked CAPA remains open;
- invalid calibration evidence exists.

A release recorded as `approved` additionally requires both:

- Engineering approval reference; and
- Quality approval reference.

This is intentionally a human approval gate. VIBPE may report the governed status and blockers but may not auto-authorize product release.

## VIBPE integration contract

`vyndi_vibpe_iso_release_status` is the governed read-only projection for Co-Pilot/assurance consumption. It exposes by family, variant and Engineering revision:

- released Engineering baseline;
- approved ITP;
- mandatory verification count;
- passing verification count;
- evidence completeness percentage;
- open ISO-linked NCR count;
- open ISO-linked CAPA count;
- invalid calibration count;
- current dual-approval references;
- release state (`approved`, `ready_for_dual_approval`, or a specific blocked state).

Direct conversational intent wiring should consume this view rather than re-deriving release status from UI state or static data.

## Performance design

The ISO module is route-scoped to Quality. It does not add global DOM observers, root-shell imports or background polling. Quality loads its existing canonical authority and the ISO authority in parallel. The UI uses responsive cards instead of another wide nested table.

## V1 implementation files

- `migrations/0075_iso_quality_compliance.sql`
- `src/lib/iso-quality-compliance.ts`
- `src/routes/command/quality.tsx`
- `scripts/iso-quality-compliance.test.mjs`

## Next controlled data-entry steps

Before production certification evidence is claimed:

1. Quality obtains/identifies licensed controlled copies of the applicable standards.
2. Engineering and Quality populate the exact clause mapping in `clause_ref` and internal controlled acceptance references.
3. Create an ITP for each controlled product family/revision being validated.
4. Register test rigs, load cells, gauges, torque devices and other measurement equipment with current calibration certificates.
5. Record each physical verification run against the approved ITP, attaching raw evidence and analysis references.
6. Link failures to NCR/CAPA and use explicit retest records.
7. Allow the release gate to reach `ready_for_dual_approval`, then record Engineering and Quality approval references.
