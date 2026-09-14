-- Forward-only current-brand correction.
-- Historical migration 0049 remains immutable; compatibility identifiers are unchanged.

update vyndi_product_families
   set display_name = replace(display_name, 'VINDY', 'VYNDI'),
       updated_at = now()
 where display_name like '%VINDY%';

update vyndi_product_variants
   set display_name = replace(display_name, 'VINDY', 'VYNDI'),
       updated_at = now()
 where display_name like '%VINDY%';
