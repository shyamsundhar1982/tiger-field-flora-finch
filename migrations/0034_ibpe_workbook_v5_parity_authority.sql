-- Workbook v5 parity stage 1.
-- Planning authorities only: these rows feed deterministic IBPE recommendations
-- and do not create transaction truth, purchase orders, reservations or actuals.

create table if not exists vyndi_supply_planning_parameters (
  sku text primary key check (sku = upper(sku)),
  lead_time_months numeric(8,3) not null default 0 check (lead_time_months >= 0),
  moq numeric(14,4) not null default 0 check (moq >= 0),
  order_multiple numeric(14,4) not null default 1 check (order_multiple > 0),
  payment_lag_months integer not null default 0 check (payment_lag_months >= 0),
  planning_status text not null default 'planning-default' check (planning_status in ('planning-default','approved','retired')),
  source_ref text not null default '',
  source_sha256 text not null default '',
  updated_by text not null,
  updated_at timestamptz not null default now()
);

comment on table vyndi_supply_planning_parameters is
  'Non-transactional supply-planning controls used by IBPE. Planning defaults require governed review before PO approval.';
comment on column vyndi_supply_planning_parameters.payment_lag_months is
  'Workbook v5 cash-timing parameter retained for parity evidence; runtime cash timing is not changed in parity stage 1.';

insert into vyndi_supply_planning_parameters
  (sku,lead_time_months,moq,order_multiple,payment_lag_months,planning_status,source_ref,source_sha256,updated_by)
values
  ('SHI-TIA-4700',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('SHI-105-R7000',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('SHI-105-R7150',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('SHI-ULT-R8170',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('SHI-DA-R9270',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('SRAM-RIV-AXS',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('SRAM-FORCE-AXS',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('SRAM-RED-AXS',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('WH-ALLOY-01',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('WH-ALLOY-30',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('WH-VIS-TEAM35',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('WH-ZIP-303S',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('WH-CARB-50',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('WH-CARB-58',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('WH-DTS-ARC1100',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('WH-ENVE-SES45',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('TY-ULT-SPORT-PAIR',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('TY-RUBINO-PRO-PAIR',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('TY-GP5000-PAIR',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('TY-CORSA-PRO-PAIR',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('HB-AL-400',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('HB-AL-420',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('HB-AL-440',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('HB-CB-400',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('HB-CB-420',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('HB-CB-440',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('ST-AL-080',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('ST-AL-090',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('ST-AL-100',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('ST-AL-110',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('ST-INT-100',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('ST-INT-110',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('SD-M-BL',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('SD-M-NL',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('SD-M-NS',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('SD-W-BS',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('SD-W-NS',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('SD-TT-01',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('TA-ROAD-CORE',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('TA-TI-ROAD',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('BB-T47I-855',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('BB-BSA-ROAD',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('BB-PF-ROAD',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('BB-T47I-CS',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('BC-PLASTIC-01',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('BC-METAL-01',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('BC-CARBON-01',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('TP-INTEGRATED-01',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('BR-COMP-01',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('BR-LIGHT-01',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('BR-BOTTLE-01',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('HW-ALLEN-M5',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('HW-ALLEN-M6',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('HW-ALLEN-M8',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('GAUGE-TORQUE-01',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('CLR-BRT-01',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('CLR-BRT-02',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('CLR-BRT-03',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('CLR-BRT-04',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('CLR-BRT-05',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('CLR-MET-01',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('CLR-MET-02',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('CLR-MET-03',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('CLR-MET-04',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('CLR-MET-05',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('CLR-CUSTOM',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('FRAMESET-AL-OEM',2,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('RM-T700-PREPREG',1,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('RM-T800-PREPREG',1,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('RM-RESIN-BOND',1,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('RM-PAINT-CLEAR',1,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('PKG-KIT',1,1,1,1,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5')
on conflict (sku) do update set
  lead_time_months=excluded.lead_time_months,
  moq=excluded.moq,
  order_multiple=excluded.order_multiple,
  payment_lag_months=excluded.payment_lag_months,
  planning_status=excluded.planning_status,
  source_ref=excluded.source_ref,
  source_sha256=excluded.source_sha256,
  updated_by=excluded.updated_by,
  updated_at=now();

create table if not exists vyndi_capacity_standards (
  work_centre_id text primary key,
  work_centre_name text not null,
  traveller_operation text not null,
  sequence integer not null check (sequence > 0),
  available_hours_per_month numeric(14,4) not null check (available_hours_per_month >= 0),
  efficiency numeric(8,6) not null check (efficiency >= 0 and efficiency <= 1),
  standard_hours_per_unit numeric(14,4) not null check (standard_hours_per_unit > 0),
  planning_status text not null default 'planning-default' check (planning_status in ('planning-default','approved','retired')),
  source_ref text not null default '',
  source_sha256 text not null default '',
  updated_by text not null,
  updated_at timestamptz not null default now()
);

comment on table vyndi_capacity_standards is
  'Work-centre capacity planning standards mirrored from controlled workbook v5. These are planning constraints, not proof of completed production.';

insert into vyndi_capacity_standards
  (work_centre_id,work_centre_name,traveller_operation,sequence,available_hours_per_month,efficiency,standard_hours_per_unit,planning_status,source_ref,source_sha256,updated_by)
values
  ('WC-010','Kitting','Kitting',10,160,0.85,0.35,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('WC-020','Frame / frameset receipt','Frame / frameset receipt',20,160,0.85,0.25,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('WC-030','Drivetrain assembly','Drivetrain assembly',30,160,0.85,1.25,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('WC-040','Cockpit & controls','Cockpit & controls',40,160,0.85,0.75,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('WC-050','Wheel / tyre fitment','Wheel / tyre fitment',50,160,0.85,0.60,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('WC-060','Torque & fit inspection','Torque & fit inspection',60,160,0.85,0.45,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('WC-070','Final quality','Final quality',70,160,0.85,0.65,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5'),
  ('WC-080','Pack & release','Pack & release',80,160,0.85,0.40,'planning-default','WORKBOOK-V5','2f91bfd32b8ba659ca7d41894622dffaf4d7e81b0fda913b70bfd2e0b16c61a7','workbook-v5')
on conflict (work_centre_id) do update set
  work_centre_name=excluded.work_centre_name,
  traveller_operation=excluded.traveller_operation,
  sequence=excluded.sequence,
  available_hours_per_month=excluded.available_hours_per_month,
  efficiency=excluded.efficiency,
  standard_hours_per_unit=excluded.standard_hours_per_unit,
  planning_status=excluded.planning_status,
  source_ref=excluded.source_ref,
  source_sha256=excluded.source_sha256,
  updated_by=excluded.updated_by,
  updated_at=now();
