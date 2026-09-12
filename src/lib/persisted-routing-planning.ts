import type { RoutingOperation } from "./advanced-planning-constraints.ts";
import {
  compileGovernedRoutingAuthority,
  type GovernedRoutingOperation,
  type GovernedRoutingRevision,
  type RoutingAuthorityIssue,
} from "./governed-routing-authority.ts";

export type PersistedRoutingOperationRow = {
  revision_id: string;
  product_id: string;
  revision_code: string;
  effective_from: string;
  effective_to: string | null;
  revision_source_ref: string;
  operation_id: string;
  operation_code: string;
  sequence: number | string;
  run_hours_per_unit: number | string;
  setup_hours: number | string;
  yield_pct: number | string;
  epr_gate_id: string | null;
  traveller_operation: string | null;
  operation_source_ref: string;
  eligible_resource_ids: unknown;
  predecessor_operation_ids: unknown;
};

export type PersistedRoutingPlanningResult = {
  complete: boolean;
  routingOperations: RoutingOperation[];
  revisionIds: string[];
  issues: RoutingAuthorityIssue[];
  missingProductIds: string[];
  ambiguousProductIds: string[];
};

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

export function compilePersistedRoutingForPlanning(input: {
  rows: PersistedRoutingOperationRow[];
  productIds: string[];
  knownResourceIds: string[];
  asOfDate: string;
}): PersistedRoutingPlanningResult {
  const targetProducts = [...new Set(input.productIds.filter(Boolean))].sort();
  const asOf = dateOnly(input.asOfDate);
  const effectiveRows = input.rows.filter((row) => {
    const from = dateOnly(row.effective_from);
    const to = row.effective_to ? dateOnly(row.effective_to) : null;
    return from <= asOf && (!to || to >= asOf);
  });

  const missingProductIds: string[] = [];
  const ambiguousProductIds: string[] = [];
  const issues: RoutingAuthorityIssue[] = [];
  const routingOperations: RoutingOperation[] = [];
  const revisionIds: string[] = [];

  for (const productId of targetProducts) {
    const productRows = effectiveRows.filter((row) => row.product_id === productId);
    const revisionIdSet = [...new Set(productRows.map((row) => row.revision_id))];
    if (revisionIdSet.length === 0) {
      missingProductIds.push(productId);
      continue;
    }
    if (revisionIdSet.length !== 1) {
      ambiguousProductIds.push(productId);
      continue;
    }

    const revisionId = revisionIdSet[0];
    const rows = productRows
      .filter((row) => row.revision_id === revisionId)
      .sort((a, b) => Number(a.sequence) - Number(b.sequence) || a.operation_id.localeCompare(b.operation_id));
    const head = rows[0];
    if (!head) {
      missingProductIds.push(productId);
      continue;
    }

    const revision: GovernedRoutingRevision = {
      id: head.revision_id,
      productId: head.product_id,
      revision: head.revision_code,
      status: "approved",
      effectiveFrom: dateOnly(head.effective_from),
      effectiveTo: head.effective_to ? dateOnly(head.effective_to) : undefined,
      sourceRef: head.revision_source_ref,
    };
    const operations: GovernedRoutingOperation[] = rows.map((row) => ({
      id: row.operation_id,
      revisionId: row.revision_id,
      operationCode: row.operation_code,
      sequence: Number(row.sequence),
      eligibleResourceIds: stringArray(row.eligible_resource_ids),
      runHoursPerUnit: Number(row.run_hours_per_unit),
      setupHours: Number(row.setup_hours),
      yieldPct: Number(row.yield_pct),
      predecessorOperationIds: stringArray(row.predecessor_operation_ids),
      eprGateId: row.epr_gate_id ?? undefined,
      travellerOperation: row.traveller_operation ?? undefined,
      sourceRef: row.operation_source_ref,
    }));

    const compiled = compileGovernedRoutingAuthority({
      revision,
      operations,
      knownResourceIds: input.knownResourceIds,
      asOfDate: asOf,
    });
    issues.push(...compiled.issues);
    if (!compiled.solverReady) continue;

    revisionIds.push(revisionId);
    routingOperations.push(...compiled.operations);
  }

  const complete =
    targetProducts.length > 0 &&
    missingProductIds.length === 0 &&
    ambiguousProductIds.length === 0 &&
    revisionIds.length === targetProducts.length &&
    routingOperations.length > 0;

  return {
    complete,
    routingOperations: complete ? routingOperations : [],
    revisionIds: complete ? revisionIds.sort() : [],
    issues,
    missingProductIds,
    ambiguousProductIds,
  };
}
