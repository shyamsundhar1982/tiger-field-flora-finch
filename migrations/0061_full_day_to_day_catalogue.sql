-- Full day-to-day catalogue reconciliation (VYNDI).
-- Rule: item is registered independently of transactions. Balance stays 0 until receipt.
-- Builds on 0059/0060; only adds missing rows (on conflict do update identity fields).

-- ---------------------------------------------------------------------------
-- 1–5 + remaining inventory catalogue (components, raw, tooling, quality, stores)
-- ---------------------------------------------------------------------------
insert into master_inventory_items
  (id, ledger_id, sku, name, category, unit, minimum_stock_level, planned_monthly_use, active, created_by, updated_by)
select
  'cat-' || lower(replace(sku, '_', '-')),
  ledger,
  sku,
  name,
  category,
  unit,
  0,
  0,
  true,
  'catalogue-full',
  'catalogue-full'
from (values
  -- Components (supplement 0060)
  ('components','COMP-HEAD-TUBE','Head tubes','Finished components','ea'),
  ('components','COMP-BOTTOM-BRACKET','Bottom brackets','Drivetrain','ea'),
  ('components','COMP-SEAT-CLAMP','Seat clamps','Cockpit','ea'),
  ('components','COMP-CHAINRING','Chainrings','Drivetrain','ea'),
  ('components','COMP-BB-BEARING','Bottom-bracket bearings','Drivetrain','set'),
  ('components','COMP-BRAKE-LEVER','Brake levers','Braking','ea'),
  ('components','COMP-NIPPLE','Nipples','Wheels','set'),
  ('components','COMP-RIM-TAPE','Rim tape','Wheels','roll'),
  ('components','COMP-TUBELESS-VALVE','Tubeless valves','Wheels','ea'),
  ('components','COMP-CABLE-HOUSING','Cable housing','Controls','m'),
  ('components','COMP-HYDRAULIC-HOSE','Hydraulic hoses','Controls','m'),
  ('components','COMP-BOTTLE-MOUNT','Bottle mounts','Accessories','ea'),
  ('components','COMP-REFLECTOR','Reflectors','Accessories','ea'),
  ('components','COMP-THREADLOCK','Thread-locking compound','Consumables','ea'),
  ('components','COMP-GREASE','Grease','Consumables','ea'),
  ('components','COMP-ASSEMBLY-PASTE','Assembly paste','Consumables','ea'),
  ('components','COMP-WARRANTY-CARD','Warranty cards','Packaging','ea'),
  ('components','COMP-PACKAGING-INSERT','Packaging inserts','Packaging','ea'),
  ('components','COMP-OWNER-MANUAL','Owner manuals','Packaging','ea'),

  -- Raw materials (supplement)
  ('raw-materials','RAW-WOVEN-CARBON','Woven carbon fabric','Carbon','m2'),
  ('raw-materials','RAW-RESIN-ADDITIVE','Resin additives','Resin','kg'),
  ('raw-materials','RAW-VACUUM-CONNECTOR','Vacuum connectors','Composite process','ea'),
  ('raw-materials','RAW-HONEYCOMB','Honeycomb core','Core materials','m2'),
  ('raw-materials','RAW-STEEL-INSERT','Steel inserts','Hardware','ea'),
  ('raw-materials','RAW-BRASS-INSERT','Brass inserts','Hardware','ea'),
  ('raw-materials','RAW-DEGREASER','Degreaser','Finishing','litre'),
  ('raw-materials','RAW-GRINDING-WHEEL','Grinding wheels','Finishing','ea'),
  ('raw-materials','RAW-MARKING-INK','Marking ink','Operations','ea'),
  ('raw-materials','RAW-WELD-CONSUMABLE','Welding consumables','Operations','set'),
  ('raw-materials','RAW-COOLANT','Coolants','Workshop','litre'),
  ('raw-materials','RAW-SCRAP-REWORK','Scrap / rework material','Operations','kg'),

  -- Tooling (supplement)
  ('tooling','TOOL-ASSEMBLY-FIXTURE','Assembly fixtures','Fixtures','ea'),
  ('tooling','TOOL-INSPECTION-FIXTURE','Inspection fixtures','Fixtures','ea'),
  ('tooling','TOOL-SEATPOST-MOULD','Seat-post moulds','Moulds','ea'),
  ('tooling','TOOL-PRESSURE-GAUGE','Pressure gauges','Composite processing','ea'),
  ('tooling','TOOL-VACUUM-GAUGE','Vacuum gauges','Composite processing','ea'),
  ('tooling','TOOL-BAND-SAW','Band saw','Tooling','ea'),
  ('tooling','TOOL-BENCH-GRINDER','Bench grinder','Tooling','ea'),
  ('tooling','TOOL-DRILL-PRESS','Drill press','Tooling','ea'),
  ('tooling','TOOL-PAINT-PREP-BOOTH','Paint preparation booth','Finishing','ea'),
  ('tooling','TOOL-COOLED-STORAGE','Cooled storage containers','Storage','ea'),
  ('tooling','TOOL-RIVET','Rivet tools','Tooling','set'),
  ('tooling','TOOL-MEASURING-FIXTURE','Measuring fixtures','Tooling','set'),
  ('tooling','TOOL-CABINET','Tool cabinets and racks','Tool management','ea'),
  ('tooling','TOOL-CALIBRATION','Tool calibration equipment','Tool management','set'),

  -- Quality (supplement)
  ('quality','QUALITY-MICROMETER','Micrometers','Dimensional inspection','ea'),
  ('quality','QUALITY-DIGITAL-SCALE','Digital scales','Dimensional inspection','ea'),
  ('quality','QUALITY-PRESSURE','Pressure gauges (QC)','Calibration','ea'),
  ('quality','QUALITY-VACUUM','Vacuum gauges (QC)','Calibration','ea'),
  ('quality','QUALITY-PROBE','Temperature probes','Calibration','ea'),
  ('quality','QUALITY-BEARING-PRELOAD','Bearing preload testers','Testing','ea'),
  ('quality','QUALITY-BRAKE-TEST','Brake testing equipment','Testing','set'),
  ('quality','QUALITY-ULTRASONIC','Ultrasonic inspection equipment','NDT','ea'),
  ('quality','QUALITY-TAP-TEST','Tap-testing equipment','NDT','set'),
  ('quality','QUALITY-INSPECTION-TABLE','Inspection tables','Stores','ea'),
  ('quality','QUALITY-RACK','Quality racks','Stores','ea'),
  ('quality','QUALITY-NCR-STORAGE','Non-conformance storage','Stores','ea'),
  ('quality','QUALITY-CAL-CERT','Calibration certificates register','Documentation','ea'),
  ('quality','QUALITY-TEST-CONSUMABLE','Test consumables','Documentation','set'),

  -- Stores & tools (supplement)
  ('stores-tools','STORE-HAND-TRUCK','Hand trucks','Material handling','ea'),
  ('stores-tools','STORE-SPANNER','Spanners','Workshop','set'),
  ('stores-tools','STORE-SCREWDRIVER','Screwdrivers','Workshop','set'),
  ('stores-tools','STORE-ALLEN','Allen-key sets','Workshop','set'),
  ('stores-tools','STORE-PLIER','Pliers and cutters','Workshop','set'),
  ('stores-tools','STORE-HAMMER','Hammers and files','Workshop','set'),
  ('stores-tools','STORE-TAPE','Measuring tapes','Workshop','ea'),
  ('stores-tools','STORE-PACKING-TABLE','Packing tables','Dispatch','ea'),
  ('stores-tools','STORE-PPE-STORAGE','PPE storage','Safety','ea'),
  ('stores-tools','STORE-FG-RACK','Finished-goods racks','Dispatch','ea'),
  ('stores-tools','STORE-QUARANTINE-RACK','Quarantine racks (stores)','Stores','ea'),

  -- Dead / idle / retired (visible catalogue; active flag true so row remains queryable)
  ('stores-tools','DEAD-IDLE-EQUIP','Idle equipment','Dead / Idle','ea'),
  ('stores-tools','DEAD-IDLE-TOOLING','Idle tooling','Dead / Idle','ea'),
  ('stores-tools','DEAD-OBSOLETE','Obsolete equipment','Dead / Idle','ea'),
  ('stores-tools','DEAD-DAMAGED','Damaged equipment','Dead / Idle','ea'),
  ('stores-tools','DEAD-REPAIR-PENDING','Repair-pending equipment','Dead / Idle','ea'),
  ('stores-tools','DEAD-UNDER-INSPECTION','Under-inspection equipment','Dead / Idle','ea'),
  ('stores-tools','DEAD-RETIRED','Retired equipment','Dead / Idle','ea'),
  ('stores-tools','DEAD-SCRAPPED','Scrapped equipment','Dead / Idle','ea'),
  ('stores-tools','DEAD-SURPLUS','Surplus inventory','Dead / Idle','ea'),
  ('stores-tools','DEAD-NONPRODUCTIVE','Non-productive assets','Dead / Idle','ea'),
  ('stores-tools','DEAD-AWAITING-DISPOSAL','Assets awaiting disposal','Dead / Idle','ea'),
  ('stores-tools','DEAD-AWAITING-DECISION','Assets awaiting management decision','Dead / Idle','ea')
) as catalogue(ledger, sku, name, category, unit)
on conflict (ledger_id, sku) do update set
  name = excluded.name,
  category = excluded.category,
  unit = excluded.unit,
  active = true,
  updated_by = 'catalogue-full',
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 8. People records (catalogue roles — draft, zero cost until approved)
-- ---------------------------------------------------------------------------
insert into vyndi_people_records
  (id, display_name, function_name, role_title, engagement_type, lifecycle_status, start_month, end_month, source_ref, notes, created_by)
values
  ('role-founder','Founder','Leadership','Founder','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-director','Directors','Leadership','Director','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-gm','General management','Leadership','General manager','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-eng-mgr','Engineering manager','Engineering','Engineering manager','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-composite-eng','Composite engineer','Engineering','Composite engineer','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-design-eng','Design engineer','Engineering','Design engineer','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-cad-eng','CAD engineer','Engineering','CAD engineer','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-prod-sup','Production supervisor','Operations','Production supervisor','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-prod-op','Production operators','Operations','Production operator','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-composite-tech','Composite technicians','Operations','Composite technician','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-assy-tech','Assembly technicians','Operations','Assembly technician','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-qa-eng','Quality engineer','Quality','Quality engineer','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-qa-insp','Quality inspectors','Quality','Quality inspector','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-stores-mgr','Stores manager','Supply','Stores manager','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-stores-asst','Stores assistant','Supply','Stores assistant','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-proc-mgr','Procurement manager','Supply','Procurement manager','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-proc-asst','Procurement assistant','Supply','Procurement assistant','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-fin-mgr','Finance manager','Finance','Finance manager','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-accountant','Accountant','Finance','Accountant','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-admin','Administration staff','Administration','Admin staff','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-sales','Sales staff','Commercial','Sales','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-marketing','Marketing staff','Commercial','Marketing','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-cs','Customer support','Commercial','Customer support','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-logistics','Logistics coordinator','Supply','Logistics coordinator','planned_role','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-contract','Contract workers','Operations','Contract worker','contractor','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-temp','Temporary workers','Operations','Temporary worker','contractor','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-consultant','Consultants','Engineering','Consultant','consultant','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-freelance-eng','Freelance engineers','Engineering','Freelance engineer','consultant','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-ext-auditor','External auditors','Finance','External auditor','consultant','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full'),
  ('role-advisor','Advisors','Leadership','Advisor','consultant','draft',1,36,'CATALOGUE:PEOPLE','Catalogue role', 'catalogue-full')
on conflict (id) do update set
  display_name = excluded.display_name,
  function_name = excluded.function_name,
  role_title = excluded.role_title,
  engagement_type = excluded.engagement_type,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 9–11 Cost catalogue (office facilities, statutory, outsourcing expansions)
-- ---------------------------------------------------------------------------
insert into vyndi_people_office_cost_items
  (id, cost_group, name, stage, quantity, monthly_unit_cost_lakh, start_month, end_month, one_time_cost_lakh, one_time_month, lifecycle_status, source_ref, created_by)
values
  ('office-factory-rent','office','Factory rent','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-warehouse-rent','office','Warehouse rent','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-security-deposit','office','Security deposit','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-water','office','Water','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-gas','office','Gas','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-telephone','office','Telephone','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-mobile','office','Mobile communication','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-waste','office','Waste disposal','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-facility-maint','office','Facility maintenance','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-equip-maint','office','Equipment maintenance','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-ac-maint','office','Air-conditioning maintenance','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-cleaning','office','Cleaning services','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-security','office','Security services','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-repairs','office','Repairs','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-pest','office','Pest control','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-fire-safety','office','Fire-safety maintenance','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-property-tax','office','Property taxes','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-cam','office','Common-area maintenance','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-travel','office','Travel and local transport','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-courier','office','Courier charges','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),
  ('office-subscriptions','office','Office subscriptions','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OFFICE','catalogue-full'),

  ('statutory-bookkeeping','statutory','Bookkeeping','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-tax-filing','statutory','Tax filing','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-audit','statutory','Statutory audit','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-patent','statutory','Patent filing','Validation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-design-reg','statutory','Design registration','Validation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-trademark','statutory','Trademark filing','Validation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-contract-review','statutory','Contract review','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-compliance-consult','statutory','Compliance consulting','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-insurance-adv','statutory','Insurance advisory','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-labour','statutory','Labour-law compliance','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-factory','statutory','Factory compliance','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-env','statutory','Environmental compliance','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-cert-fee','statutory','Certification fees','Validation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-iso','statutory','ISO certification','Validation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-product-test','statutory','Product testing','Validation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-lab-test','statutory','Laboratory testing','Validation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-gov-fee','statutory','Government fees','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),
  ('statutory-bank-charge','statutory','Bank charges','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:STATUTORY','catalogue-full'),

  ('outsourcing-fea','outsourcing','FEA','Prototype',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-cfd','outsourcing','CFD','Prototype',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-composite-consult','outsourcing','Composite consulting','Prototype',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-cnc','outsourcing','CNC machining','Prototype',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-mould-mfg','outsourcing','Mould manufacturing','Prototype',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-paint','outsourcing','Painting and finishing','Prototype',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-weld','outsourcing','Welding','Prototype',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-heat','outsourcing','Heat treatment','Prototype',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-surface','outsourcing','Surface treatment','Prototype',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-test-lab','outsourcing','Testing laboratory','Validation',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-ndt','outsourcing','NDT inspection','Validation',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-ads','outsourcing','Advertising','Launch',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-photo','outsourcing','Photography','Launch',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-video','outsourcing','Video production','Launch',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-web','outsourcing','Website services','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-cloud','outsourcing','Cloud services','Foundation',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-recruit','outsourcing','Recruitment services','Scale',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full'),
  ('outsourcing-logistics','outsourcing','Logistics services','Scale',1,0,1,36,0,1,'draft','CATALOGUE:OUTSOURCING','catalogue-full')
on conflict (id) do update set
  name = excluded.name,
  cost_group = excluded.cost_group,
  stage = excluded.stage,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 6 + 12 Office assets & consumables (People & Office asset register)
-- ---------------------------------------------------------------------------
insert into vyndi_people_office_assets
  (id, name, category, asset_class, cost_lakh, monthly_cost_lakh, purchase_month, useful_life_months, allocation_pct, lifecycle_status, source_ref, created_by)
values
  ('office-laptops','Laptops','IT','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-monitors','Monitors','IT','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-keyboards','Keyboards','IT','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-mice','Mice','IT','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-printers','Printers','IT','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-scanners','Scanners','IT','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-routers','Routers','IT','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-switches','Network switches','IT','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-ups','UPS systems','IT','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-servers','Servers','IT','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-phones','Telephones','IT','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-cctv','CCTV equipment','Security','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-meeting-table','Meeting tables','Furniture','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-visitor-chair','Visitor chairs','Furniture','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-filing','Filing cabinets','Furniture','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-storage-cab','Storage cabinets','Furniture','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-whiteboard','Whiteboards','Equipment','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-projector','Projectors','Equipment','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-fans','Fans','Facilities','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-fridge','Refrigerators','Facilities','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-microwave','Microwave','Facilities','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-lighting','Lighting equipment','Facilities','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-fixtures','Office fixtures','Facilities','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-signage','Signage','Facilities','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),
  ('office-security-eq','Security equipment','Security','office_admin',0,0,1,60,100,'draft','CATALOGUE:OFFICE-ASSET','catalogue-full'),

  ('cons-paper','Paper','Stationery','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-toner','Printer toner','Stationery','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-cartridge','Printer cartridges','Stationery','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-files','Files and folders','Stationery','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-notebooks','Notebooks','Stationery','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-pens','Pens and markers','Stationery','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-labels','Labels and envelopes','Stationery','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-tape','Packaging tape','Stationery','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-cleaning-chem','Cleaning chemicals','Facilities','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-handwash','Handwash and sanitiser','Facilities','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-tissue','Tissue paper','Facilities','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-water','Drinking water','Pantry','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-pantry','Pantry supplies','Pantry','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-batteries','Batteries','Electrical','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-cable-ties','Cable ties','Electrical','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-electrical','Small electrical accessories','Electrical','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-first-aid','First-aid consumables','Safety','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-ppe','PPE','Safety','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-masks','Masks','Safety','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full'),
  ('cons-gloves','Gloves','Safety','office_consumable',0,0,1,12,100,'draft','CATALOGUE:CONSUMABLE','catalogue-full')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  asset_class = excluded.asset_class,
  updated_at = now();

comment on table master_inventory_items is
  'Operational inventory item register including full day-to-day catalogue. Quantity remains 0 until authorised receipt lots are posted.';
