# VIBPE Weekly Review Knowledge Ingestion

## Source

Google Drive folder: **VYNDI Weekly Status Reviews — VIBPE Knowledge**

- Folder ID: `1_2Py8ORHfR2zyhT4S-nUL0PYihK87T12`
- Source ID: `VIBPE-SRC-WEEKLY-REVIEWS`
- Authority: advisory evidence
- Intended content: dated VYNDI weekly status reviews

## Runtime configuration

The deployed VYNDI application cannot reuse a ChatGPT Google Drive connector session. Configure one of the following on the application runtime.

Preferred long-lived OAuth configuration:

- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REFRESH_TOKEN`

Temporary/manual configuration:

- `GOOGLE_DRIVE_ACCESS_TOKEN`

The OAuth principal must have read access to the source folder and its Google Docs.

## Sync flow

`refreshVibpeWeeklyReviewsFromDrive`:

1. lists Google Docs directly inside the registered folder;
2. exports each document as plain text;
3. derives the review date from the document title when present;
4. classifies statements into governed claim classes;
5. hashes content for idempotency;
6. supersedes prior versions of the same Drive document without deleting lineage;
7. records document provenance and revision/version;
8. writes claims with advisory or unresolved authority;
9. records a `knowledge_ingest` entry in `vyndi_audit_events`.

## Authority rules

Weekly review content is never direct master data.

- `verified_fact`, `decision`, `priority`, and `material_change` => advisory.
- `unresolved_item`, `assumption`, and `blocker` => unresolved.
- A governed internal master record always overrides a conflicting weekly-review claim.
- The conflicting review claim remains available as provenance/evidence.
- Promotion to master knowledge must happen through the owning approval workflow.

Example: an old review mentioning a T47 68 mm shell cannot override the governed engineering requirement **T47i, 85.5 mm shell width**.

## Tables

- `vibpe_knowledge_sources`
- `vibpe_knowledge_documents`
- `vibpe_knowledge_claims`

## Regression coverage

`scripts/vibpe-weekly-review-knowledge.test.mjs` proves:

- unresolved weekly claims cannot become authoritative;
- master knowledge wins over a conflicting review claim;
- review-only knowledge remains advisory/assumption context.

The global migration execution test also executes the new schema from an empty database.


## Automatic refresh

VIBPE Co-Pilot performs a best-effort source freshness check before answering. If the weekly-review source has not been ingested within the previous 6 hours, it attempts a Google Drive refresh before knowledge retrieval.

A missing/expired Drive OAuth configuration or transient Google failure is non-blocking: governed IBPE analysis continues using the last successfully ingested evidence. The Knowledge page also exposes a manual **Refresh Drive** action and the active review register for auditability.
