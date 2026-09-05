# EPR Serial Genealogy Verification

## Objective

Prove that a serialized bicycle can be reconstructed both backward and forward from one authoritative serial number.

The target chain is:

`serial → traveller → BOM revision → SKU → material lot → supplier → process → operator → equipment → measurement → inspection → NCR/CAPA → inventory consumption → actual COGS → evidence → release`

## Implemented control

The genealogy layer adds:

- `epr_genealogy_links` as a derived traceability index.
- Backward links from a serial/traveller to material, process, inspection, NCR/CAPA, inventory and evidence records.
- Forward/where-used links from those source records back to the affected serial.
- Live database triggers so newly inserted execution records are linked automatically.
- Rebuild support for historical records.
- Server queries by traveller, serial and source record.
- Admin-only genealogy rebuild.

## Verification procedure

1. Create a test traveller with a unique serial.
2. Record one material lot.
3. Record one process operation.
4. Record one inspection.
5. Record one NCR/CAPA record.
6. Record one inventory movement.
7. Record one evidence record.
8. Query backward genealogy by serial.
9. Query forward/where-used genealogy by each source record.
10. Rebuild genealogy and confirm the record count is stable.
11. Confirm Carbon records cannot appear under an Aluminium traveller and vice versa.
12. Confirm every source record has both directions.
13. Confirm the audit trail records the genealogy rebuild.

## Current test classification

| Capability | Code status | Runtime status |
|---|---|---|
| Serial → traveller | Implemented | Not yet runtime-verified |
| Traveller → material lot | Implemented | Not yet runtime-verified |
| Traveller → process | Implemented | Not yet runtime-verified |
| Traveller → inspection | Implemented | Not yet runtime-verified |
| Traveller → NCR/CAPA | Implemented | Not yet runtime-verified |
| Traveller → inventory movement | Implemented | Not yet runtime-verified |
| Traveller → evidence | Implemented | Not yet runtime-verified |
| Forward / where-used | Implemented | Not yet runtime-verified |
| Live genealogy triggers | Implemented | Not yet runtime-verified |
| Historical rebuild | Implemented | Not yet runtime-verified |
| Equipment genealogy | Not implemented | Red |
| Operator qualification/signature | Not implemented | Red |
| Work-instruction revision at execution | Not implemented | Red |
| Process parameter capture/limits | Not implemented | Red |
| Calibration linkage | Not implemented | Red |

## Important boundary

This is a software genealogy control. It does not create physical evidence that a bicycle was actually built, inspected, tested or released. Production verification still requires execution against the Cloudflare runtime and authoritative database.

The design follows the mature eDHR/eBR principle that a serialized unit should support searchable forward and backward traceability across materials, people, equipment, processes and measurements. See Siemens' lot-traceability and electronic-batch-record references for the benchmark model.
