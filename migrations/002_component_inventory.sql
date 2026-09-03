create table if not exists component_inventory (
  id text primary key,
  category text not null check (category in ('groupset','wheelset','tyre')),
  subcategory text not null default '',
  brand text not null,
  model text not null,
  detail text not null default '',
  sku text not null unique,
  price_inr integer not null check (price_inr >= 0),
  stock_qty integer not null default 0 check (stock_qty >= 0),
  reorder_level integer not null default 2 check (reorder_level >= 0),
  core_enabled boolean not null default false,
  pro_enabled boolean not null default false,
  apex_enabled boolean not null default false,
  source text not null default 'Internal estimate — verify with supplier',
  notes text not null default '',
  updated_at timestamptz not null default now()
);

insert into component_inventory
  (id, category, subcategory, brand, model, detail, sku, price_inr, stock_qty, reorder_level, core_enabled, pro_enabled, apex_enabled, source, notes)
values
  ('gs-tiagra-4700','groupset','Mechanical','Shimano','Tiagra 4700','2x10 mechanical','SHI-TIA-4700',45000,6,2,true,false,false,'India market reference / internal target','Core entry Shimano option.'),
  ('gs-105-r7000','groupset','Mechanical','Shimano','105 R7000','2x11 mechanical','SHI-105-R7000',70000,8,2,true,true,false,'India market reference / internal target','Use for Core and Pro entry specification.'),
  ('gs-105-r7150','groupset','Electronic','Shimano','105 R7150 Di2','2x12 electronic','SHI-105-R7150',138000,4,1,false,true,false,'BUMSONTHESADDLE India reference','Current retail reference is about ₹137,860; verify final supplier/OEM quote.'),
  ('gs-ultegra-r8170','groupset','Electronic','Shimano','Ultegra R8170 Di2','2x12 electronic','SHI-ULT-R8170',210000,3,1,false,true,true,'Mastermind Bicycle Studio India reference','Premium Pro / Apex drivetrain.'),
  ('gs-duraace-r9270','groupset','Electronic','Shimano','Dura-Ace R9270 Di2','2x12 electronic flagship','SHI-DA-R9270',353000,1,1,false,false,true,'Mastermind Bicycle Studio India reference','Apex-only flagship.'),
  ('gs-rival-axs','groupset','Electronic','SRAM','Rival AXS','2x12 wireless electronic','SRAM-RIV-AXS',175000,3,1,false,true,false,'Internal India target — supplier verify','Pro alternative.'),
  ('gs-force-axs','groupset','Electronic','SRAM','Force AXS','2x12 wireless electronic','SRAM-FORCE-AXS',250000,2,1,false,true,true,'Internal India target — supplier verify','Premium Pro / Apex alternative.'),
  ('gs-red-axs','groupset','Electronic','SRAM','RED AXS','2x12 wireless flagship','SRAM-RED-AXS',380000,1,1,false,false,true,'Internal India target — supplier verify','Apex-only flagship.'),
  ('ws-alloy','wheelset','Alloy','Performance','Performance Alloy','Training / everyday','WH-ALLOY-01',30000,10,3,true,false,false,'Internal estimate','Core-only entry wheel.'),
  ('ws-alloy-plus','wheelset','Alloy','Light Alloy 30','Light Alloy 30','Fast endurance / tubeless-ready','WH-ALLOY-30',45000,8,2,true,true,false,'Internal estimate','Core and Pro transition option.'),
  ('ws-carbon-50','wheelset','Carbon Aero','3T','Carbon CW-3T2','50 mm carbon aero','WH-CARB-50',65000,5,1,false,true,true,'Internal estimate','Pro/Apex baseline carbon option.'),
  ('ws-carbon-58','wheelset','Carbon Aero','Magene','EXAR Pro DB58','58 mm carbon aero','WH-CARB-58',78900,3,1,false,true,true,'Internal estimate','Apex higher-depth option; supplier verification required.'),
  ('ty-ultra-sport','tyre','Performance','Continental','Ultra Sport III','Training / entry race · pair','TY-ULT-SPORT-PAIR',7590,12,3,true,false,false,'Internal India price reference','Core training tyre.'),
  ('ty-rubino-pro','tyre','Endurance','Vittoria','Rubino Pro IV G2.0','Endurance · pair','TY-RUBINO-PRO-PAIR',9800,10,3,true,true,false,'Internal India price reference','Core/Pro standard.'),
  ('ty-gp5000','tyre','Performance','Continental','Grand Prix 5000','Performance · pair','TY-GP5000-PAIR',17790,7,2,false,true,true,'Internal India price reference','Pro/Apex premium standard.'),
  ('ty-corsa-pro','tyre','Race','Vittoria','Corsa Pro G2.0','Race · pair','TY-CORSA-PRO-PAIR',19000,4,1,false,false,true,'Internal India price reference','Apex race option.')
on conflict (id) do nothing;
