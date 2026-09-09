# VIBPE Finance, Compliance & Engineering Intelligence

## Objective

Extend VIBPE Co-Pilot 2.0 into a governed cross-functional analyst for finance, procurement, Indian GST/customs/trade compliance, accounting previews and carbon-road-bicycle engineering selection.

## Truth hierarchy

1. Approved VYNDI master data / actual ledgers / governed IBPE packet.
2. Approved scenario assumptions.
3. Versioned external regulatory/manufacturer references.
4. Model inference.

External references never overwrite approved internal master data automatically.

## Financial analytics

The analyst shall support:

- 36-month and arbitrary-horizon P&L, cash-flow and balance-sheet views.
- Working-capital analysis: receivable, inventory and payable days.
- Procurement cash forecasts and payment-lag timing.
- Landed-cost modelling for imports with separate cash-outflow and potentially recoverable input-tax treatment.
- FX sensitivity, supplier-payment terms, freight/insurance/clearing and duty scenarios.
- Gross margin, contribution margin, EBITDA, EBIT, PBT, PAT and break-even analysis.
- Funding runway, liquidity trough, reserve-policy breach and scenario optimisation.
- Plan vs forecast vs commitment vs actual variance analysis.

## Indian GST / customs / trade controls

Regulatory claims must carry authority, effective date and source reference. Tax/duty rates are versioned inputs, not constants embedded in the model.

Primary authorities:

- CBIC GST: https://cbic-gst.gov.in/
- ICEGATE / Indian Customs: https://www.icegate.gov.in/
- DGFT: https://www.dgft.gov.in/

The analyst must distinguish GST cash paid, eligible/provisional input tax credit and true economic cost. Customs analysis must not proceed as final when CTH/HS classification, origin, valuation or applicable notification is unresolved.

## Accounting intelligence

Accounting capability is advisory only. It may preview journal logic and explain accounting treatment, but must not post entries automatically.

Required event separation:

PO -> goods receipt -> supplier invoice -> payment -> ITC eligibility/reconciliation.

Forecast/scenario values never become actual ledger entries.

## Carbon bicycle engineering intelligence

Engineering intelligence supports selection and design exploration across:

- carbon-fibre grades and prepreg systems;
- laminate design reasoning;
- frame/fork load-path and stiffness/toughness trade-offs;
- road groupsets and drivetrain compatibility;
- brakes, rotors and hydraulic interfaces;
- cassettes, cranksets, chainline and gearing;
- bottom brackets, headsets and axles;
- wheels/rims, tyres and tyre/rim compatibility;
- cockpit, seatpost and saddle interfaces;
- geometry, clearance and fit constraints.

Manufacturer data supports selection but does not release production design.

Current primary manufacturer references include:

- Toray carbon/prepreg datasheets: https://www.toraycma.com/resources/data-sheets/
- Shimano product specifications: https://productinfo.shimano.com/
- DT Swiss technical documentation: https://www.dtswiss.com/en/support/manuals
- Schwalbe technical product data: https://www.schwalbe.com/

Additional manufacturer adapters should follow the same source/provenance contract rather than copying uncontrolled reseller catalogues.

## Carbon material governance

Toray reference values such as T700S properties are manufacturer selection data. VIBPE must not infer a production-ready ply schedule solely from fibre tensile/modulus values. Final ply angles, count, local reinforcement, ply drops/overlaps, resin/cure cycle, FEA allowables, fatigue/damage-tolerance criteria and manufacturing release remain controlled engineering outputs.

## Procurement design loop

Demand/order -> configuration -> controlled BOM -> inventory/ATP -> shortage -> supplier candidates -> compatibility + engineering screening -> landed cost + tax/trade screening -> lead-time/payment terms -> procurement scenario -> cash/funding impact -> approval workspace.

The Co-Pilot may recommend the best controlled option but may not create a commitment without owning-workspace approval.
