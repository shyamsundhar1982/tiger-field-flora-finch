/**
 * VYNDI IBPE Operating Workspace — Phase 1 read model.
 *
 * This module is intentionally read-only. It consumes the canonical ERP report
 * pack and derives management evidence without posting, approving, reserving,
 * procuring, releasing, invoicing, or mutating any operational truth.
 */
export type IbpeRow = Record<string, unknown>;

export interface IbpeErpReportPack {
  generatedAt: string;
  inventory: {
    cutover: IbpeRow[];
    reservationHealth: IbpeRow[];
    mslHealth: IbpeRow[];
    fifoAging: IbpeRow[];
    procurementNetRequirement: IbpeRow[];
    receivingExceptions: IbpeRow[];
  };
  engineeringProduction: {
    bomCompliance: IbpeRow[];
    productionReleaseGate: IbpeRow[];
  };
  commercial: {
    orderBookSync: IbpeRow[];
    orderBacklog: IbpeRow[];
  };
  finance: {
    monthlyTransactionActuals: IbpeRow[];
    receivablesAging: IbpeRow[];
    payablesAging: IbpeRow[];
  };
  governance: {
    auditCoverage: IbpeRow[];
    recentAuditEvents: IbpeRow[];
  };
  crossCutting: {
    sopSnapshot: IbpeRow;
  };
}

export type IbpeEvidenceStatus = "OK" | "ATTENTION" | "UNVERIFIED";

export interface IbpeEvidenceSection {
  key: string;
  label: string;
  authorityRoute: string;
  status: IbpeEvidenceStatus;
  rows: IbpeRow[];
  attentionCount: number;
  note: string;
}

const text = (row: IbpeRow, key: string) => String(row[key] ?? "");
const number = (row: IbpeRow, key: string) => Number(row[key] ?? 0);

function section(
  key: string,
  label: string,
  authorityRoute: string,
  rows: IbpeRow[],
  attention: (row: IbpeRow) => boolean,
  note: string,
): IbpeEvidenceSection {
  const attentionCount = rows.filter(attention).length;
  return {
    key,
    label,
    authorityRoute,
    rows,
    attentionCount,
    status: rows.length === 0 ? "UNVERIFIED" : attentionCount > 0 ? "ATTENTION" : "OK",
    note,
  };
}

export function buildIbpeOperatingWorkspace(pack: IbpeErpReportPack) {
  const sections: IbpeEvidenceSection[] = [
    section(
      "commercial-order-sync",
      "Demand & confirmed-order synchronization",
      "/command/sales",
      pack.commercial.orderBookSync,
      (row) => text(row, "sync_status") !== "SYNCED",
      "Confirmed commercial truth only; leads and chat are not canonical demand.",
    ),
    section(
      "bom-compliance",
      "Approved BOM / production configuration",
      "/command/bom-control",
      pack.engineeringProduction.bomCompliance,
      (row) => text(row, "compliance") !== "OK",
      "Production release remains governed by approved BOM/configuration authority.",
    ),
    section(
      "inventory-reservations",
      "Inventory ATP & reservations",
      "/command/inventory",
      pack.inventory.reservationHealth,
      (row) => text(row, "health") !== "OK",
      "Read-only view of canonical inventory and reservation health.",
    ),
    section(
      "inventory-msl",
      "MSL & forecast stock health",
      "/command/inventory",
      pack.inventory.mslHealth,
      (row) => text(row, "health") !== "OK",
      "Phase 1 does not automatically change MSL, safety stock or forecasts.",
    ),
    section(
      "procurement-net",
      "Procurement net requirement",
      "/command/procurement-planning",
      pack.inventory.procurementNetRequirement,
      (row) => number(row, "net_buy_to_msl") > 0 || number(row, "net_buy_to_monthly_use") > 0,
      "Recommendations are evidence only; no autonomous PO or supplier write is permitted.",
    ),
    section(
      "production-release",
      "Job-card / production release gates",
      "/command/production",
      pack.engineeringProduction.productionReleaseGate,
      (row) => ["AWAITING_RELEASE", "HOLD"].includes(text(row, "gate_status")),
      "Job Card → Traveller → Production authority remains outside this read model.",
    ),
    section(
      "receivables",
      "Finance receivables",
      "/command/receivables",
      pack.finance.receivablesAging,
      (row) => !["", "CURRENT"].includes(text(row, "aging_bucket")),
      "Accounting truth remains owned by canonical finance transactions.",
    ),
    section(
      "payables",
      "Finance payables",
      "/command/payables",
      pack.finance.payablesAging,
      (row) => text(row, "payable_class") === "BLOCKED" || !["", "CURRENT"].includes(text(row, "aging_bucket")),
      "No automated payment, pricing or procurement action is enabled.",
    ),
    section(
      "governance-audit",
      "Governance & audit evidence",
      "/command/actions",
      pack.governance.auditCoverage,
      () => false,
      "VIBPE Co-Pilot may consume governed evidence; its chat output is never canonical.",
    ),
  ];

  const actionRequired = sections.reduce((sum, item) => sum + item.attentionCount, 0);
  const unverified = sections.filter((item) => item.status === "UNVERIFIED").length;
  const attentionAreas = sections.filter((item) => item.status === "ATTENTION").map((item) => item.label);

  return {
    schemaVersion: "VYNDI-IBPE-OPERATING-WORKSPACE-1.0",
    generatedAt: pack.generatedAt,
    source: "canonical-erp-report-pack" as const,
    mode: "read-only" as const,
    sopSnapshot: pack.crossCutting.sopSnapshot,
    sections,
    todaysControlRoom: {
      actionRequired,
      unverified,
      attentionAreas,
    },
    founderBriefing: {
      headline:
        actionRequired > 0
          ? `${actionRequired} governed exception${actionRequired === 1 ? "" : "s"} require management attention.`
          : "No governed report exception is currently active.",
      evidenceCutoff: pack.generatedAt,
      limitations: [
        "This Phase 1 workspace is advisory and read-only.",
        "Missing/empty governed evidence is shown as UNVERIFIED, never silently treated as healthy.",
        "Business Update input and confirmed-write authority are not enabled in this gate.",
      ],
    },
    businessUpdate: {
      mode: "preview-only" as const,
      canonicalWriteEnabled: false,
      autonomousLearningEnabled: false,
      autonomousProcurementEnabled: false,
      autonomousPlanningWritesEnabled: false,
    },
  };
}
