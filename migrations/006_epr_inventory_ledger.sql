create table if not exists epr_inventory_ledger (
  id text primary key,
  venture text not null check (venture in ('carbon','aluminium')),
  sku text not null,
  unit text not null,
  quantity_delta numeric(14,4) not null check (quantity_delta <> 0),
  movement_id text not null references epr_inventory_movements(id) on delete restrict,
  traveller_id text references epr_travellers(id) on delete restrict,
  serial_number text,
  reference text not null default '',
  notes text not null default '',
  recorded_by text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists epr_inventory_ledger_movement_unique_idx
  on epr_inventory_ledger (movement_id);

create index if not exists epr_inventory_ledger_balance_idx
  on epr_inventory_ledger (venture, sku, unit, created_at);

comment on table epr_inventory_ledger is
  'Authoritative append-only inventory quantity ledger for EPR movements. Current balance is derived from ledger entries, not UI seed stock.';
comment on column epr_inventory_ledger.quantity_delta is
  'Positive quantity increases available stock; negative quantity consumes/issues stock.';
