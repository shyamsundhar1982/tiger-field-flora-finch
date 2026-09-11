-- Reconcile the previously maintained equipment catalogue into the canonical
-- inventory authority. These are catalogue rows only: opening balances remain 0
-- until an authorised receipt is posted.
insert into master_inventory_items
  (id, ledger_id, sku, name, category, unit, minimum_stock_level, planned_monthly_use, active, created_by, updated_by)
values
  ('tool-paint-booth','tooling','TOOL-PAINT-BOOTH','Paint booth / painting equipment','Finishing','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('tool-moulds','tooling','TOOL-MOULDS','Manufacturing moulds','Moulds','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('tool-autoclave','tooling','TOOL-AUTOCLAVE','Autoclave','Composite processing','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('tool-jigs','tooling','TOOL-JIGS','Manufacturing jigs','Jigs','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('tool-production-tables','tooling','TOOL-PRODUCTION-TABLES','Production / drag tables','Production tables','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('tool-vacuum-pumps','tooling','TOOL-VACUUM-PUMPS','Vacuum pumps and equipment','Composite processing','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('tool-compressors','tooling','TOOL-COMPRESSORS','Air compressors','Finishing','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('tool-cnc-router','tooling','TOOL-CNC-ROUTER','CNC router / trimming equipment','Tooling','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('store-containers','stores-tools','STORE-CONTAINERS','Material storage containers','Storage','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('store-racks','stores-tools','STORE-RACKS','Storage racks','Storage','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('store-bins','stores-tools','STORE-BINS','Parts bins','Storage','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('store-tool-crib','stores-tools','STORE-TOOL-CRIB','Tool crib','Tool management','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('store-workshop-tools','stores-tools','STORE-WORKSHOP-TOOLS','Workshop tools','Workshop','set',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('store-trolleys','stores-tools','STORE-TROLLEYS','Material and workshop trolleys','Stores','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('quality-test-equipment','quality','QUALITY-TEST-EQUIPMENT','Quality and test equipment','Quality & testing','set',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('quality-inspection-equipment','quality','QUALITY-INSPECTION-EQUIPMENT','Inspection equipment','Inspection','set',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('quality-calibration-gauges','quality','QUALITY-CALIBRATION-GAUGES','Calibration gauges and standards','Calibration','set',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('quality-ndt-equipment','quality','QUALITY-NDT-EQUIPMENT','NDT / ultrasonic inspection equipment','NDT','set',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('office-computers','stores-tools','OFFICE-COMPUTERS','Computers and laptops','Office equipment','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('office-tables-desks','stores-tools','OFFICE-TABLES-DESKS','Tables and desks','Office furniture','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('office-chairs','stores-tools','OFFICE-CHAIRS','Chairs','Office furniture','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('office-air-conditioners','stores-tools','OFFICE-AIR-CONDITIONERS','Air conditioners','Facilities','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('office-water-dispenser','stores-tools','OFFICE-WATER-DISPENSER','Water dispenser','Facilities','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('office-sofa','stores-tools','OFFICE-SOFA','Sofa','Office furniture','ea',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('cons-manufacturing','raw-materials','CONS-MANUFACTURING','Manufacturing consumables','Consumables','set',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('cons-workshop','raw-materials','CONS-WORKSHOP','Workshop consumables','Consumables','set',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('cons-ppe-cleaning','raw-materials','CONS-PPE-CLEANING','PPE and cleaning materials','Consumables','set',0,0,true,'catalogue-reconciliation','catalogue-reconciliation'),
  ('cons-office','raw-materials','CONS-OFFICE','Office consumables','Consumables','set',0,0,true,'catalogue-reconciliation','catalogue-reconciliation')
on conflict (ledger_id, sku) do update set
  name = excluded.name,
  category = excluded.category,
  unit = excluded.unit,
  active = true,
  updated_by = 'catalogue-reconciliation',
  updated_at = now();
