const TRANSACTION_REFERENCE_PART = /^transaction-ledger:M\d+$/i;

const referenceParts = (sourceReference: string | null | undefined) =>
  (sourceReference ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

export function extractManagementEvidence(sourceReference: string | null | undefined): string {
  return referenceParts(sourceReference)
    .filter((part) => !TRANSACTION_REFERENCE_PART.test(part))
    .join("; ");
}

export function buildActualSourceReference(month: number, sourceReference: string | null | undefined): string {
  const managementEvidence = extractManagementEvidence(sourceReference);
  return [`transaction-ledger:M${month}`, managementEvidence].filter(Boolean).join("; ");
}
