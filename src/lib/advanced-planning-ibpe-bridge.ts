import type { RuntimeIbpeInput } from "./ibpe-runtime-parity.ts";
import {
  compileAdvancedPlanningModel,
  type GovernedCapacityStandard,
} from "./advanced-planning-adapter.ts";
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
  routingMode: "capacity-standard-derived";
  routingAuthority: "provisional" | "approved-capacity-standards";
  supplierLaneAuthority: "not-compiled";
  firmCtpEligible: false;
  optimisationEligible: false;
  limitations: string[];
};

export type BuildAdvancedPlanningFromIbpeInput = {
  lineage: AdvancedPlanningSourceLineage;
  input: RuntimeIbpeInput;
  capacityStandards: IbpeCapacityStandardEvidence[];
  createdAt: string;
  packetId: string;
  ctpRequests?: CapableToPromiseRequest[];
};

export type BuildAdvancedPlanningFromIbpeResult = {
  authority: AdvancedPlanningAuthorityAssessment;
  adapterNotices: ReturnType<typeof compileAdvancedPlanningModel>["notices"];
  packetBuild: AdvancedPlanningDecisionPacketBuildResult;
};

const NON_OPTIMISING_OBJECTIVE_WEIGHTS = {
  unmetCommittedDemand: 0,
  unmetForecastDemand: 0,
  lateness: 0,
  resourceOverload: 0,
  supplierOverload: 0,
  procurementCost: 0,
  workingCapital: 0,
  scheduleChange: 0,
};

export function buildAdvancedPlanningFromGovernedIbpe(
  source: BuildAdvancedPlanningFromIbpeInput,
): BuildAdvancedPlanningFromIbpeResult {
  const capacityStandards = source.capacityStandards.map(({ planningStatus: _planningStatus, ...standard }) => standard);
  const allCapacityApproved =
    source.capacityStandards.length > 0 &&
    source.capacityStandards.every((row) => row.planningStatus === "approved");

  const compiled = compileAdvancedPlanningModel({
    horizonPeriods: 36,
    planningInput: {
      demand: source.input.demand,
      bom: source.input.bom,
      inventory: source.input.inventory,
      receipts: source.input.receipts,
    },
    capacityStandards,
    supplierLanes: [],
    objectiveWeights: NON_OPTIMISING_OBJECTIVE_WEIGHTS,
    committedDemandPriority: 100,
    forecastDemandPriority: 50,
  });

  const authority: AdvancedPlanningAuthorityAssessment = {
    sourceTruth: "persisted-governed-ibpe-input",
    routingMode: "capacity-standard-derived",
    routingAuthority: allCapacityApproved ? "approved-capacity-standards" : "provisional",
    supplierLaneAuthority: "not-compiled",
    firmCtpEligible: false,
    optimisationEligible: false,
    limitations: [
      "Routing operations are currently derived from capacity standards rather than persisted approved routing revisions.",
      "Supplier-lane landed cost, reliability and finite capacity are not yet compiled into the governed source packet.",
      "Objective weights are deliberately zero because this bridge performs feasibility/CTP evidence preparation, not mathematical optimisation.",
      "Any CTP result remains advisory until governed routing authority is persisted and the owning Commercial workspace approves a customer commitment.",
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
