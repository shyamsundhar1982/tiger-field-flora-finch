-- Procurement price authority currently stores an INR-denominated amount.
-- Do not permit foreign-currency quote values to be interpreted numerically as INR
-- until a governed FX conversion authority is introduced.

alter table vyndi_procurement_prices
  add constraint vyndi_procurement_prices_inr_only
  check (currency = 'INR');

comment on column vyndi_procurement_prices.currency is
  'Must be INR while unit_price_inr is the governed amount. Foreign-currency quotes require governed FX conversion before entry.';
