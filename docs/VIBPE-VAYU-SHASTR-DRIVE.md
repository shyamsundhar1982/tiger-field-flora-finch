# VIBPE Vāyu Shastr Drive Corpus

## Registered source

- User-supplied parent link: `11H0Jv-9KE8AXyQ2XM8yE22U1HHoCNb5i`
- Resolved inner corpus folder: **VAYU SHASTR**
- Governed root folder ID: `1QDwLydKu5tQthElxTGCT4BO2AP5xXkKS`
- VIBPE source ID: `VIBPE-SRC-VAYU-SHASTR-DRIVE`
- Default authority: advisory/reference

The user-supplied parent link contains the VAYU SHASTR folder; VIBPE indexes the inner folder rather than the wrapper folder.

## Source classes

### controlled-reference
Paths under:
- `FINAL DOSSIER`
- `VAYU_MASTER_ENGINEERING_PACKAGE_REV1`

These rank higher during retrieval but remain advisory until promoted by an owning governed workflow.

### reference
Supplier/Toray material, TANSAM/TANCAM communication, RFQ, presentation and other working/reference material.

### legacy-working
Architecture iterations and files whose names indicate draft, rough, sample, copy, old, preliminary or Rev 0 status. These are down-ranked and assumption-like content remains unresolved.

## Secret exclusion

VIBPE never indexes the folder:
`12D8SfbcnX9y5E9oOa614SE7BUYBbRQEK` — **google client secret for shyamsundhar1982**.

The crawler also excludes names matching credential/password/private-key/API-key/OAuth/access-token/refresh-token patterns.

## Supported content

Content indexing currently supports:
- native Google Docs;
- native Google Sheets via CSV export when available;
- plain text, HTML, Markdown, CSV, JSON, XML and SVG text.

Other binaries such as PDF, DOCX, ZIP, raster images and unsupported formats are stored as metadata-only references. VIBPE knows they exist and where they are, but must not imply their contents were parsed.

## Refresh

- Manual: Knowledge → **Refresh Vāyu Drive**
- Automatic: VIBPE Co-Pilot performs a best-effort refresh when the source is older than 12 hours.
- OAuth/network failure is non-blocking; VIBPE continues with the last successful corpus.

## Authority

Drive corpus evidence cannot silently overwrite engineering master data, BOM, inventory, supplier master, cost authority, approved plans, transaction state or accounting actuals. Master-data promotion remains a separate controlled action.
