import type { RuntimeIbpeInput } from "./ibpe-runtime-parity.ts";
import {
  compileAdvancedPlanningModel,
  type GovernedCapacityStandard,
} from "./advanced-planning-adapter.ts";
import type { RoutingOperation } from "./advanced-planning-constraints.ts";
import {
  buildAdvancedPlanningDecisionPacket,
  type AdvancedPlanningDecisionPacketBuildResult,
  type AdvancedPlanningSourceLineage,
} from "./advanced-planning-decision-packet.ts";
import type { CapableToPromiseRequest } from "./constrained-capable-to-promise.ts";

export type IbpeCapacityStandardEvidence = GovernedCapacityStandard & {
  planningStatus: string;
};

export type AdvancedPlanningAuthorityAssessment = {
  sourceTruth: "persisted-governed-ibpe-input";
  routingMode: "capacity-standard-derived" | "persisted-approved";
  routingAuthority: "provisional" | "approved-capacity-standards" | "approved-persisted";
  persistedRoutingRevisionIds?: string[];
  supplierLaneAuthority: "not-compiled";
  firmCtpEligible: false;
  optimisationEligible: false;
  limitations: string[];
};

export type BuildAdvancedPlanningFromIbpeInput = {
  lineage: AdvancedPlanningSourceLineage;
  input: RuntimeIbpeInput;
  capacityStandards: IbpeCapacityStandardEvidence[];
  governedRoutingOperations?: RoutingOperation[];
  persistedRoutingRevisionIds?: string[];
  createdAt: string;
  packetId: string;
  ctpRequests?: CapableToPromiseRequest[];
};

export type BuildAdvancedPlanningFromIbpeResult = {
  authority: AdvancedPlanningAuthorityAssessment;
  adapterNotices: ReturnType<typeof compileAdvancedPlanningModel>["notices"];
  packetBuild: AdvancedPlanningDecisionPacketBuildResult;
};

// These are the governed objective semantics already used by the advanced model
// tests/contracts. Keeping a valid objective basis is different from invoking a
// solver: this bridge only computes deterministic feasibility/CTP evidence and
// leaves optimisation disabled in the authority assessment below.
const GOVERNED_OBJECTIVE_WEIGHTS = {
  unmetCommittedDemand: 100,
  unmetForecastDemand: 30,
  lateness: 50,
  resourceOverload: 100,
  supplierOverload: 100,
  procurementCost: 5,
  workingCapital: 3,
  scheduleChange: 2,
};

export function buildAdvancedPlanningFromGovernedIbpe(
  source: BuildAdvancedPlanningFromIbpeInput,
): BuildAdvancedPlanningFromIbpeResult {
  const capacityStandards = source.capacityStandards.map(({ planningStatus: _planningStatus, ...standard }) => standard);
  const allCapacityApproved =
    source.capacityStandards.length > 0 &&
    source.capacityStandards.every((row) => row.planningStatus === "approved");
  const hasPersistedRouting = (source.governedRoutingOperations?.length ?? 0) > 0;

  const compiled = compileAdvancedPlanningModel({
    horizonPeriods: 36,
    planningInput: {
      demand: source.input.demand,
      bom: source.input.bom,
      inventory: source.input.inventory,
      receipts: source.input.receipts,
    },
    capacityStandards,
    governedRoutingOperations: source.governedRoutingOperations,
    supplierLanes: [],
    objectiveWeights: GOVERNED_OBJECTIVE_WEIGHTS,
    committedDemandPriority: 100,
    forecastDemandPriority: 50,
  });

  const authority: AdvancedPlanningAuthorityAssessment = {
    sourceTruth: "persisted-governed-ibpe-input",
    routingMode: hasPersistedRouting ? "persisted-approved" : "capacity-standard-derived",
    routingAuthority: hasPersistedRouting
      ? "approved-persisted"
      : allCapacityApproved
        ? "approved-capacity-standards"
        : "provisional",
    persistedRoutingRevisionIds: hasPersistedRouting ? [...(source.persistedRoutingRevisionIds ?? [])].sort() : undefined,
    supplierLaneAuthority: "not-compiled",
    firmCtpEligible: false,
    optimisationEligible: false,
    limitations: [
      ...(hasPersistedRouting
        ? ["Operation sequence and resource eligibility come from approved, effective persisted routing revisions; finite availability remains governed by capacity standards."]
        : ["Routing operations are currently derived from capacity standards rather than persisted approved routing revisions."]),
      "Supplier-lane landed cost, reliability and finite capacity are not yet compiled into the governed source packet.",
      "The model carries governed objective weights for validation and future solver parity, but this bridge does not invoke mathematical optimisation.",
      "Any CTP result remains advisory until the owning Commercial workspace approves a customer commitment.",
    ],
  };

  const packetBuild = buildAdvancedPlanningDecisionPacket({
    packetId: source.packetId,
    createdAt: source.createdAt,
    lineage: source.lineage,
    model: compiled.model,
    ctpRequests: source.ctpRequests,
  });

  return {
    authority,
    adapterNotices: compiled.notices,
    packetBuild,
  };
}