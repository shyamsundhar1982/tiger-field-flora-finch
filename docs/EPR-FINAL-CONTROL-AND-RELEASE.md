# EPR Final Control Layer

Status: implementation complete at schema/server-control level in the final control slice.

## What is now authoritative

1. **BOM → SKU mapping**
   - Draft / active / superseded lifecycle.
   - Admin approval is required before an active mapping can be used for inventory posting.
   - Venture, internal model ID, BOM revision, BOM line key, SKU, quantity and unit remain explicit.
   - No fuzzy SKU reconciliation is permitted.

2. **Opening inventory**
   - Opening balance is a controlled admin workflow: draft → approved → posted.
   - Opening quantity and INR unit cost are explicit and audited.
   - `inventory.ts` seed `stockQty` is never imported automatically.
   - One posted opening balance is permitted per venture/SKU/unit.

3. **Inventory ledger**
   - Quantity remains append-only and authoritative.
   - Opening, issue, consume and return are posted through controlled database functions.
   - Negative authoritative stock is rejected.
   - Reserve affects available quantity but does not create COGS.

4. **Actual COGS**
   - Opening balances establish the cost basis.
   - Issue/consume uses weighted-average inventory cost at posting time.
   - Each issue/consume produces a serial-linked `epr_cogs_entries` record.
   - Planned BOM cost remains an estimate; actual consumed COGS is the authoritative execution value once posted.

5. **Release/evidence closure**
   - EPR-04 through EPR-12 must each be passed in order.
   - Every gate must have accepted evidence.
   - Fail/conditional inspections block software release closure.
   - Open NCR/CAPA blocks software release closure.
   - Successful closure changes the traveller to `completed` and writes an audit event.

## Final release boundary

`releaseEprTraveller` is a **software/EPR closure control**. It is not proof that a physical bicycle has passed ISO 4210, structural testing, NDT, dimensional inspection, or a real pilot build. Those claims still require objective evidence entered into the system.

Cloudflare production runtime/database verification remains an external deployment verification step and is not fabricated by this commit.
