# EPR Inventory Ledger Control Boundary

**Status:** Implemented at schema/control-contract level; production database execution must still be verified on the Cloudflare runtime.

## Purpose

The EPR inventory ledger is the authoritative append-only quantity ledger for EPR inventory movements. UI seed inventory is not treated as authoritative stock.

## Posting rule

An inventory movement may become an authoritative ledger entry only when:

1. the traveller exists and its venture matches;
2. the SKU exists in an approved active BOM/SKU mapping for the traveller model and BOM revision;
3. the movement unit matches the approved mapping unit;
4. positive movements use a positive ledger delta;
5. issue/consume movements use a negative ledger delta;
6. the resulting ledger balance cannot become negative;
7. the movement and ledger entry are committed atomically;
8. the movement cannot create more than one ledger entry.

## Important boundary

Existing inventory `stockQty` values are reference/seed data until a controlled opening-balance process is implemented. The system must not silently import those values into the authoritative ledger.

## Required next implementation

The application layer must post the EPR movement and ledger entry in one database transaction, locking the SKU/unit balance while checking available quantity. On failure, neither record is committed.

The same transaction must append the audit event.

## Safety states

- **Postable:** all mapping and ledger controls pass.
- **Blocked:** mapping, unit, traveller, or authorization is invalid.
- **Insufficient stock:** a negative resulting balance would occur.
- **Exception:** database/transaction integrity prevents authoritative posting.

No UI should label a movement as authoritative merely because the EPR movement row was created.
