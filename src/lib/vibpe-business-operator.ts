export const VIBPE_BUSINESS_OPERATOR_DOCTRINE = {
  version: "2.0",
  operatingFlow: [
    "demand/order",
    "controlled product configuration",
    "controlled BOM",
    "material requirement",
    "available/committed supply",
    "shortage",
    "replenishment recommendation",
    "approved purchase order",
    "receipt",
    "inventory",
    "job-card release",
    "traveller/genealogy",
    "production",
    "quality approval",
    "shipment",
    "revenue/actuals",
  ],
  governanceRules: [
    "Forecast is not approved demand.",
    "Recommendation is not a purchase order.",
    "Scenario is not an approved plan.",
    "Draft purchase order is not a financial commitment.",
    "Job card is not production completion.",
    "Goods receipt is not supplier invoice.",
    "Shipment is not cash receipt.",
    "External reference is not governed internal truth.",
    "Model inference cannot overwrite controlled master data.",
  ],
  truthClasses: ["governed-internal", "scenario-assumption", "external-reference", "model-inference"] as const,
  advisoryOnly: true as const,
};

export function vibpeBusinessOperatorContext() {
  return [
    `Business Operator doctrine v${VIBPE_BUSINESS_OPERATOR_DOCTRINE.version}.`,
    `Canonical flow: ${VIBPE_BUSINESS_OPERATOR_DOCTRINE.operatingFlow.join(" → ")}.`,
    `Governance: ${VIBPE_BUSINESS_OPERATOR_DOCTRINE.governanceRules.join(" ")}`,
    "Never mutate approved plans, transactional records or controlled master data from an advisory Co-Pilot response.",
  ].join("\n");
}
