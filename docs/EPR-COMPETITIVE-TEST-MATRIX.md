# EPR Competitive Benchmark & Production Test Matrix

**Date:** 2026-09-06  
**Repository:** `shyamsundhar1982/tiger-field-flora-finch`  
**Scope:** VINDY / Vāyú Shastr Phase 6A EPR execution layer  
**Purpose:** benchmark the current EPR execution design against mature manufacturing execution / electronic production-record patterns and use the comparison as a live test checklist.

## 1. Benchmark basis

This is not a claim that the project is a pharmaceutical or medical-device system. Mature MES/eDHR platforms were used as capability benchmarks because they expose the common controls expected in high-integrity manufacturing records.

Reference capability patterns reviewed:

- Siemens Opcenter: engineering-to-execution integration, device-level genealogy, nonconformance/quality controls, recipe/process control and production lifecycle traceability.
- Tulip: forward/backward genealogy, operator/equipment/material history, inspection records, electronic signatures, audit history, work instructions, attachments and reviewable electronic history records.
- MasterControl Manufacturing Excellence/eDHR: electronic production/device history records, time-stamped audit trails, electronic signatures, security, training controls, equipment/logbook context, quality events and review-by-exception.

## 2. Current EPR strengths already implemented

| Capability | Current assessment | Test required |
|---|---|---|
| Traveller / unit identity | Implemented | Create and retrieve a unique traveller/serial |
| Venture isolation | Implemented in server controls | Attempt Carbon ↔ Aluminium cross-access |
| Canonical model identity | Implemented with internal compatibility IDs | Verify Longitude/Latitude/Altitude end-to-end |
| BOM → SKU mapping | Implemented as controlled mapping table | Test unmapped SKU rejection |
| Material lot traceability | Implemented | Trace lot into traveller |
| Process records | Implemented | Verify operator/time/process record |
| Inspection records | Implemented | Pass/fail/conditional paths |
| NCR/CAPA | Implemented | Open, disposition and release blocking |
| Inventory ledger | Implemented | Opening balance, issue/consume/return |
| Weighted-average inventory cost | Implemented | Verify actual cost calculation |
| COGS linkage | Implemented | Traveller/serial → movement → COGS |
| Gate sequencing | Implemented | Attempt out-of-order gate transition |
| Evidence records | Implemented | Accepted/rejected evidence paths |
| Append-only audit events | Implemented in execution/final-control paths | Verify every mutation produces an audit record |
| Release readiness | Implemented | Attempt release with each blocker present |
| Admin-only mutation boundary | Implemented | Viewer mutation denial test |

## 3. Competitive-gap test matrix

The following are **not assumed absent**. They are controls that must be explicitly tested. If the test cannot demonstrate them, classify them as `GAP` rather than `PASS`.

| Benchmark control | Mature-system pattern | EPR test | Current expected status |
|---|---|---|---|
| Electronic signature | Named signer, time, action, record | Can a critical approval be cryptographically/uniquely attributed to a user? | **GAP TO VERIFY** |
| Segregation of duties | Maker/checker separation | Can the same actor create and approve a mapping/opening balance/release? | **GAP TO VERIFY** |
| Operator identity | Who performed each step | Is operator identity persisted on every production operation/inspection? | **GAP TO VERIFY** |
| Equipment identity | Machine/tool/fixture linked to operation | Can a process record identify the equipment/tool used? | **GAP TO VERIFY** |
| Calibration status | Equipment must be valid at execution time | Can the system prevent use of expired calibration? | **GAP** |
| Process parameters | Actual values retained, not just completion | Can torque, cure temperature/time, pressure, dimensions, etc. be recorded and bounded? | **GAP** |
| Automated limits | Hard/soft limits and alerts | Does an out-of-limit value automatically block or create deviation? | **GAP** |
| Work instructions | Controlled revision at station | Is the exact instruction revision used by the operator stored with the record? | **GAP TO VERIFY** |
| Revision/effective dating | Record must resolve to the correct effective master | Can a historical traveller be reconstructed against the BOM/ECR revision active at build time? | **PARTIAL / TEST** |
| As-built genealogy | Full parent/child/component genealogy | Can a serial be traced both component→bike and bike→component population? | **PARTIAL / TEST** |
| Rework genealogy | Rework must preserve history | Can rework add a new event without overwriting the original event? | **GAP TO VERIFY** |
| Quarantine | Material/status containment | Can suspect stock be quarantined and prevented from consumption? | **GAP** |
| Nonconforming material | NC material disposition | Can an affected lot/SKU be blocked across all future travellers? | **GAP TO VERIFY** |
| Recall/containment | Forward/backward impact analysis | Given a bad lot, can the system list every affected serial? | **GAP TO VERIFY** |
| Photos/attachments | Evidence attached at point of work | Can inspection/NDT/cosmetic records carry immutable photos/files? | **GAP TO VERIFY** |
| NDT evidence | Test method + result + operator + equipment | Can NDT record be tied to serial, method, equipment and result? | **GAP TO VERIFY** |
| Measurement device | Gauge/tool identification | Can dimensional measurement identify the instrument used? | **GAP** |
| Sampling plan | Defined sampling and rationale | Can inspection enforce a controlled sampling plan? | **GAP** |
| Training authorization | Operator qualification before work | Can unqualified users be prevented from executing controlled operations? | **GAP** |
| Electronic review | QA review/review-by-exception | Can QA approve a completed traveller based on exceptions only? | **GAP TO VERIFY** |
| Packaging/shipping record | Final disposition through shipment | Does release connect to packaging/dispatch/customer shipment? | **GAP TO VERIFY** |
| Supplier quality | Supplier lot/certificate context | Can supplier certificate/COC be linked to received lot and traveller? | **GAP TO VERIFY** |
| Equipment maintenance | Maintenance context | Can a failed/overdue machine be blocked from production? | **GAP** |
| Work-center routing | Required station/order enforcement | Can a traveller skip a required station? | **GAP TO VERIFY** |
| Cycle-time capture | Actual process duration | Are start/end times captured and analyzed? | **GAP TO VERIFY** |
| Yield / FPY | First-pass yield | Can FPY and rework rate be computed from execution records? | **GAP TO VERIFY** |
| OEE / downtime | Production performance | Is equipment availability/performance tracked? | **GAP** |
| Barcode/QR scanning | Point-of-use identity validation | Can SKU/lot/serial be scanned instead of manually entered? | **GAP** |
| Offline shop-floor operation | Edge/offline capture | Can production continue safely during network interruption and reconcile later? | **GAP** |
| Data retention | Controlled retention and retrieval | Is retention period defined and tested? | **GAP TO VERIFY** |
| Exportable history | Auditor/customer-ready record | Can a complete serial history be exported without manual reconstruction? | **GAP TO VERIFY** |
| Immutable audit history | Tamper-evident history | Can an administrator alter or delete a historical execution event? | **PASS CANDIDATE / TEST** |
| Clock integrity | Trusted timestamps | Are timestamps server-authoritative and consistent across records? | **GAP TO VERIFY** |
| Concurrency | Safe simultaneous operations | Can two users consume the same last unit without creating negative stock? | **PASS CANDIDATE / TEST** |
| Disaster recovery | Backup/restore and continuity | Can production records be recovered after DB loss? | **GAP TO VERIFY** |
| Integration | ERP/QMS/MES/device connectivity | Are finance, inventory, quality and shop-floor records synchronized without duplicate masters? | **PARTIAL / TEST** |

## 4. Mandatory adversarial tests

### A. Identity and authorization

1. Viewer attempts every mutation.
2. Admin from Carbon attempts Aluminium mutation.
3. Aluminium admin attempts Carbon mutation.
4. User changes model label from Longitude to an internal/legacy ID.
5. Duplicate serial creation.
6. Reuse of a released serial.

**Expected:** every invalid operation is rejected server-side and creates no partial state.

### B. Gate integrity

1. Attempt EPR-06 before EPR-05.
2. Attempt release with one gate not passed.
3. Attempt release with missing evidence.
4. Attempt release with failed inspection.
5. Attempt release with open NCR/CAPA.
6. Attempt to alter a passed gate history.

**Expected:** release remains blocked until every required condition is satisfied.

### C. Inventory/COGS integrity

1. Consume more than available quantity.
2. Two concurrent consumes against the final unit.
3. Issue an unmapped SKU.
4. Use wrong unit against an active mapping.
5. Return inventory.
6. Verify weighted-average cost after receipt/return/consume.
7. Verify COGS is created once per issue/consume movement.
8. Attempt duplicate posting of the same movement.

**Expected:** no negative authoritative balance, no duplicate COGS, no orphan movement.

### D. Genealogy

1. Create traveller.
2. Attach material lot.
3. Execute process operations.
4. Record dimensional/NDT/cosmetic inspections.
5. Open NCR/CAPA.
6. Consume mapped component.
7. Release only after accepted evidence and closure.
8. Query the serial and reconstruct the complete history.

**Expected:** one continuous chain from engineering/BOM identity through physical material, process, quality, inventory, cost and release.

### E. Change control

1. Supersede a BOM/SKU mapping.
2. Create a new effective mapping.
3. Verify historical travellers still resolve to their original revision.
4. Attempt use of a blocked/superseded mapping.
5. Verify no historical record is rewritten.

**Expected:** historical truth is preserved; new production uses only the currently approved effective configuration.

## 5. Release scoring

A control is `PASS` only when a real test demonstrates it. Documentation or UI presence alone is insufficient.

- **GREEN:** tested successfully with positive and negative cases.
- **AMBER:** implemented but production/runtime evidence incomplete.
- **RED:** missing, bypassable, or test failure.
- **N/A:** deliberately outside VINDY/Aluminium scope.

### P0 release blockers

Any of these keeps the EPR release state `BLOCKED`:

- unauthorized mutation succeeds;
- venture boundary can be bypassed;
- serial identity can be duplicated/reused incorrectly;
- gate sequencing can be bypassed;
- missing accepted evidence does not block release;
- failed inspection/open NCR does not block release;
- inventory can go negative;
- duplicate movement creates duplicate COGS;
- historical audit/execution records can be silently modified/deleted;
- BOM/SKU revision cannot be reconstructed for a historical traveller;
- Cloudflare runtime cannot execute the production database/migration path.

## 6. Highest-priority additions if the benchmark exposes them

1. **Electronic signatures + segregation of duties.**
2. **Equipment/tool/calibration genealogy.**
3. **Actual process parameters with controlled limits.**
4. **Controlled work instructions and revision-at-execution.**
5. **Complete forward/backward serial/component genealogy.**
6. **Quarantine/containment and recall impact analysis.**
7. **Immutable evidence attachments/photos and NDT records.**
8. **Operator training/qualification enforcement.**
9. **Review-by-exception / QA release workflow.**
10. **Shop-floor scanning and station routing.**
11. **Recovery/backup and retention controls.**
12. **Cloudflare production-runtime verification, including the PostgreSQL-specific migration/function layer.**

## 7. Important boundary

The benchmark does not convert software capability into proof of bicycle safety, structural validation, NDT acceptance, ISO 4210 compliance, supplier qualification, or pilot production approval. Those remain evidence-backed physical gates.

The objective of this matrix is stricter: **during testing, anything mature EPR/MES systems normally control but this system cannot demonstrate must become an explicit gap, not an assumption.**
