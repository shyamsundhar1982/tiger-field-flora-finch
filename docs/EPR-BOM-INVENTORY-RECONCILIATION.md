# EPR ↔ BOM ↔ Inventory ↔ COGS Reconciliation Contract

**Status:** Control contract defined; authoritative mapping schema is now present, but automated reconciliation remains intentionally blocked until mappings are explicitly approved.

## 1. Current source structures

The commercial BOM is currently a tier-level cost model (`core`, `pro`, `apex`) with line items such as Frame, Fork, Groupset, Wheelset, Cockpit, Saddle/Seatpost, Tyres, Assembly/QC/Packaging, Freight, Customs/BCD+IGST, and Warranty reserve. Each line carries a tier cost, but the BOM line does not currently contain an authoritative inventory SKU. `src/lib/finance/bom-engine.ts` derives extended cost from BOM quantity × unit cost.

The inventory master is SKU-based and contains SKU, stock quantity, price, reorder level and model-eligibility flags. This is a separate structure from the commercial BOM and therefore cannot safely be joined by fuzzy item name matching.

The EPR execution chain records inventory movements by traveller + venture + SKU, but those movements are currently an execution ledger; they must not be treated as authoritative stock balances or COGS until linked to the inventory source of truth.

## 2. Authoritative mapping schema

Migration `005_epr_bom_inventory_mapping.sql` introduces `epr_bom_inventory_mappings` with the required dimensions:

`venture + model_id + BOM revision + BOM line/component + SKU + quantity + unit`

It also records mapping status, effective dates, approval identity/time, notes and audit timestamps. Active open-ended mappings are uniquely constrained for a given venture/model/revision/component/SKU combination.

**Important:** the migration intentionally seeds **no mappings**. No SKU assignment has been invented from similar names, prices or tier eligibility flags.

The stable `bom_line_key` is deliberately required so future mappings point to a controlled component key rather than a mutable display label.

## 3. Required authoritative join

The reconciliation key must be explicit:

`venture + model_id + BOM revision + BOM line/component + SKU + quantity + unit`

For serial-level execution, the chain becomes:

`traveller → serial → BOM revision → BOM component → SKU → lot → movement → consumption → COGS`

## 4. Reconciliation rules

### BOM ↔ Inventory
- Every physical BOM component intended for inventory consumption must resolve to one or more approved SKUs.
- A BOM line without an approved SKU mapping is **unreconciled**, not zero inventory.
- A SKU present in inventory but absent from the approved BOM is **unallocated** unless explicitly classified as spare/accessory/overage.
- Fuzzy matching on item names, brand names or prices is prohibited for authoritative reconciliation.

### Inventory ↔ EPR
- Every `issue` / `consume` movement must reference an existing approved SKU mapping.
- Movement quantity must use an explicit unit.
- Negative stock must be prevented by the authoritative inventory ledger before a movement can be posted as consumed.
- Traveller venture and SKU venture must agree.

### EPR ↔ COGS
- COGS attribution requires a serial/traveller, approved BOM revision, SKU and consumed quantity.
- Inventory valuation must use the authoritative cost basis, not the commercial BOM estimate when an actual landed/approved cost exists.
- Freight, customs and warranty reserves remain separate model assumptions until accounting treatment is explicitly reconciled.

## 5. Deliberate safety gate

The application must not display a fabricated "reconciled" state merely because a BOM total and inventory movement total can be mathematically compared. The system should expose:

- **Reconciled** — all required joins and quantities agree.
- **Partially reconciled** — some approved mappings/consumption exist but closure is incomplete.
- **Unreconciled** — required mapping or authoritative stock/cost evidence is missing.
- **Exception** — quantities, venture, revision, SKU or cost basis conflict.

## 6. Next implementation slice

1. ~~Introduce an authoritative BOM-component/SKU mapping table.~~ **Done — migration 005.**
2. Attach mapping to BOM revision and venture. **Schema ready; mappings still require explicit approval.**
3. Validate EPR inventory movements against that mapping.
4. Maintain an authoritative inventory ledger/balance rather than deriving stock from UI seed data.
5. Add serial-level consumption records.
6. Reconcile actual consumed cost to BOM planned cost.
7. Surface exceptions in the Financial Cockpit / EPR workspace.

Until steps 2–4 have approved data and an authoritative inventory ledger, automated BOM ↔ Inventory ↔ EPR ↔ COGS reconciliation remains **blocked by design**.
