-- Register the broader Vayu Shastr Drive corpus as governed VIBPE reference knowledge.
-- This source is advisory by default. Controlled-reference ranking is metadata only
-- and does not bypass the existing master-data promotion process.

insert into vibpe_knowledge_sources
  (id, source_type, name, external_id, external_url, authority, is_enabled)
values
  (
    'VIBPE-SRC-VAYU-SHASTR-DRIVE',
    'google-drive-folder',
    'VAYU SHASTR Drive Corpus',
    '1QDwLydKu5tQthElxTGCT4BO2AP5xXkKS',
    'https://drive.google.com/drive/folders/1QDwLydKu5tQthElxTGCT4BO2AP5xXkKS',
    'advisory',
    true
  )
on conflict (id) do update set
  external_id = excluded.external_id,
  external_url = excluded.external_url,
  name = excluded.name,
  authority = 'advisory',
  is_enabled = true,
  updated_at = now();

comment on table vibpe_knowledge_sources is
  'Governed VIBPE source registry. Broad Drive corpora remain advisory unless promoted through owning master-data governance.';
