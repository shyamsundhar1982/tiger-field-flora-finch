# VIBPE Co-Pilot 2.0 Tool Contract

The Co-Pilot should consume governed business services rather than infer transactional truth from arbitrary raw tables.

Preferred service surface:

- getGovernedPlan
- getDemandForecast
- getSalesOrders
- getControlledBom
- getInventoryPosition
- getMaterialShortages
- getSupplierLeadTimes
- getPurchaseRecommendations
- getPurchaseHistory
- getCapacityPlan
- getProductionJobCards
- getOperatingCosts
- getPeopleOfficeCosts
- getCashPosition
- getFundingPlan
- evaluateScenario
- compareScenarios

Each service remains owned by its domain. Co-Pilot access is read/analysis-oriented unless a separate owning workflow explicitly authorises a write. Recommendation generation must not be confused with transaction execution.
