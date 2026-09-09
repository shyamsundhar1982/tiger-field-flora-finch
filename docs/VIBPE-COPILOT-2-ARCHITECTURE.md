# VIBPE Co-Pilot 2.0

## Operating principle

VIBPE Co-Pilot is an advisory reasoning and orchestration layer. It must never replace governed business truth or silently mutate approved plans.

- **IBPE engine** computes deterministic business truth.
- **VYNDI Business Operator doctrine** defines operating rules, ownership boundaries, control semantics and approval gates.
- **VIBPE Co-Pilot** classifies intent, extracts scenario assumptions, invokes governed analysis, compares outcomes and explains recommendations.
- **External knowledge** is reference context only unless explicitly promoted through a governed approval process.

## Truth classes

Every material fact used by the Co-Pilot must remain distinguishable as one of:

1. Governed internal truth
2. Scenario assumption
3. External reference
4. Model inference

External references and model inference must never overwrite approved BOM, inventory, cost, demand, supplier, finance or production authority.

## Required intent classes

- conversation
- baseline assessment
- planning horizon
- scenario analysis
- comparison
- optimisation
- root-cause analysis
- demand planning
- material planning
- procurement planning
- capacity planning
- funding/liquidity analysis
- follow-up
- navigation/action request

## Scenario contract

Free-form user assumptions are translated into an advisory scenario request before deterministic evaluation. Supported dimensions include horizon, demand, funding, procurement cost, lead time, receipt delay, capacity and operating pace.

The governed baseline is immutable. A user-entered scenario is temporary unless separately approved in its owning workspace.

## Conversation context

Follow-up prompts such as `next what?`, `then what?`, `why?`, or `compare that` must retain the active advisory scenario and previous decision packet rather than falling back to a generic baseline assessment.

## External knowledge boundary

External knowledge may improve explanation, benchmark assumptions, terminology and operating practice. It cannot become transactional truth directly. Any external market, supplier, commodity, FX, regulatory or benchmark datum must carry source/time context and remain non-governing until approved.

## Business Operator doctrine

The Co-Pilot must respect canonical VYNDI operating flow:

Demand/order → controlled product configuration → controlled BOM → material requirement → available/committed supply → shortage → replenishment recommendation → approved PO → receipt → inventory → job-card release → traveller/genealogy → production → QA → shipment → revenue/actuals.

Control semantics:

- Forecast ≠ approved demand
- Recommendation ≠ purchase order
- Scenario ≠ approved plan
- Draft PO ≠ financial commitment
- Job card ≠ production completion
- Goods receipt ≠ supplier invoice
- Shipment ≠ cash receipt

## Maturity target

VIBPE 2.0 targets intent-aware business Q&A, arbitrary scenario simulation, multi-scenario comparison and governed recommendation. Optimisation may rank deterministic candidate scenarios, but cannot approve or transact them.
