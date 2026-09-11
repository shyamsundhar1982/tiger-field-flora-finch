-- G1: canonical VYNDI product authority.
-- Business identity is Longitude / Latitude / Altitude.
-- core / pro / apex remain internal compatibility aliases only.

create table if not exists vyndi_product_families (
  family_code text primary key,
  display_name text not null unique,
  compatibility_tier text not null unique check (compatibility_tier in ('core','pro','apex')),
  material_class text not null,
  status text not null default 'approved' check (status in ('draft','pending_approval','approved','superseded')),
  revision integer not null default 1 check (revision > 0),
  effective_from timestamptz,
  source_ref text not null default 'SYSTEM:PRODUCT-CUTOVER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists vyndi_product_variants (
  variant_id text primary key,
  business_code text not null unique,
  family_code text not null references vyndi_product_families(family_code),
  display_name text not null,
  compatibility_variant_id text not null unique,
  brand text not null,
  groupset text not null,
  wheelset text not null,
  tyres text not null,
  asp_inr numeric(14,2) not null check (asp_inr >= 0),
  active boolean not null default true,
  status text not null default 'approved' check (status in ('draft','pending_approval','approved','superseded')),
  revision integer not null default 1 check (revision > 0),
  source_ref text not null default 'SYSTEM:MODEL-CUTOVER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_code, display_name)
);

insert into vyndi_product_families
  (family_code, display_name, compatibility_tier, material_class, status, revision, source_ref)
values
  ('longitude', 'VINDY Longitude', 'core', 'aluminium', 'approved', 1, 'CUTOVER:src/lib/data/models.ts'),
  ('latitude',  'VINDY Latitude',  'pro',  'carbon', 'approved', 1, 'CUTOVER:src/lib/data/models.ts'),
  ('altitude',  'VINDY Altitude',  'apex', 'premium-carbon', 'approved', 1, 'CUTOVER:src/lib/data/models.ts')
on conflict (family_code) do update set
  display_name=excluded.display_name,
  compatibility_tier=excluded.compatibility_tier,
  material_class=excluded.material_class,
  source_ref=excluded.source_ref,
  updated_at=now();

insert into vyndi_product_variants
  (variant_id,business_code,family_code,display_name,compatibility_variant_id,brand,groupset,wheelset,tyres,asp_inr,status,revision,source_ref)
values
  ('core-tiagra','LONGITUDE-TIAGRA','longitude','VINDY Longitude Tiagra','core-tiagra','Shimano','Shimano Tiagra','Performance Alloy','Continental Ultra Sport III',111900,'approved',1,'CUTOVER:src/lib/data/models.ts'),
  ('core-105','LONGITUDE-105','longitude','VINDY Longitude 105','core-105','Shimano','Shimano 105 R7000','Performance Alloy','Vittoria Rubino Pro IV',145300,'approved',1,'CUTOVER:src/lib/data/models.ts'),
  ('core-105-elite','LONGITUDE-105-ELITE','longitude','VINDY Longitude 105 Elite','core-105-elite','Shimano','Shimano 105 R7000','Light Alloy 30','Continental GP5000',158100,'approved',1,'CUTOVER:src/lib/data/models.ts'),
  ('pro-105-di2','LATITUDE-105-DI2','latitude','VINDY Latitude 105 Di2','pro-105-di2','Shimano','Shimano 105 Di2','3T Carbon CW-3T2','Vittoria Rubino Pro IV',215000,'approved',1,'CUTOVER:src/lib/data/models.ts'),
  ('pro-rival-axs','LATITUDE-RIVAL-AXS','latitude','VINDY Latitude Rival AXS','pro-rival-axs','SRAM','SRAM Rival AXS','3T Carbon CW-3T2','Vittoria Rubino Pro IV',205000,'approved',1,'CUTOVER:src/lib/data/models.ts'),
  ('pro-ultegra-di2','LATITUDE-ULTEGRA-DI2','latitude','VINDY Latitude Ultegra Di2','pro-ultegra-di2','Shimano','Shimano Ultegra Di2','3T Carbon CW-3T2','Continental GP5000',255000,'approved',1,'CUTOVER:src/lib/data/models.ts'),
  ('pro-force-axs','LATITUDE-FORCE-AXS','latitude','VINDY Latitude Force AXS','pro-force-axs','SRAM','SRAM Force AXS','3T Carbon CW-3T2','Continental GP5000',245000,'approved',1,'CUTOVER:src/lib/data/models.ts'),
  ('apex-ultegra-di2','ALTITUDE-ULTEGRA-DI2','altitude','VINDY Altitude Ultegra Di2','apex-ultegra-di2','Shimano','Shimano Ultegra Di2','Magene EXAR Pro DB58','Vittoria Corsa Pro',295000,'approved',1,'CUTOVER:src/lib/data/models.ts'),
  ('apex-duraace-di2','ALTITUDE-DURA-ACE-DI2','altitude','VINDY Altitude Dura-Ace Di2','apex-duraace-di2','Shimano','Shimano Dura-Ace Di2','Magene EXAR Pro DB58','Vittoria Corsa Pro',395000,'approved',1,'CUTOVER:src/lib/data/models.ts'),
  ('apex-red-axs','ALTITUDE-RED-AXS','altitude','VINDY Altitude RED AXS','apex-red-axs','SRAM','SRAM RED AXS','Magene EXAR Pro DB58','Vittoria Corsa Pro',425000,'approved',1,'CUTOVER:src/lib/data/models.ts')
on conflict (variant_id) do update set
  business_code=excluded.business_code,
  family_code=excluded.family_code,
  display_name=excluded.display_name,
  compatibility_variant_id=excluded.compatibility_variant_id,
  brand=excluded.brand,
  groupset=excluded.groupset,
  wheelset=excluded.wheelset,
  tyres=excluded.tyres,
  asp_inr=excluded.asp_inr,
  source_ref=excluded.source_ref,
  updated_at=now();

create or replace view vyndi_product_catalog as
select
  f.family_code,
  f.display_name as family_name,
  f.material_class,
  f.status as family_status,
  f.revision as family_revision,
  v.variant_id,
  v.business_code,
  v.display_name as variant_name,
  v.brand,
  v.groupset,
  v.wheelset,
  v.tyres,
  v.asp_inr,
  v.status as variant_status,
  v.revision as variant_revision,
  v.active
from vyndi_product_families f
join vyndi_product_variants v on v.family_code=f.family_code
where f.status='approved' and v.status='approved';

comment on column vyndi_product_families.compatibility_tier is
  'Internal compatibility alias for legacy code only. UI/business identity must use family_code/display_name.';
comment on column vyndi_product_variants.compatibility_variant_id is
  'Legacy variant identifier retained so existing Sales Orders remain resolvable.';
