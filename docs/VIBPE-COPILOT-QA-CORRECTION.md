# VIBPE Co-Pilot autonomous QA / correction

## Purpose

This control continuously tests the real `runVibpeCopilot2` response path against a governed synthetic business state. It is not a canned-answer test and it is not a production-data bot.

The current corpus contains 16 questions across eight packs:

1. cash ledger reconciliation;
2. procurement recommendations;
3. demand / commitment feasibility;
4. inventory ATP / reservations / shortage;
5. job cards / Travellers;
6. liquidity;
7. funding;
8. actual-vs-plan reconciliation.

Each answer is classified for correctness, completeness, provenance, ledger-vs-plan semantics, snapshot freshness, repetition and actionability.

## Correction loop

`runVibpeQaCycle()` implements the repeat-until-pass contract:

1. ask the same structured question through the real Co-Pilot path;
2. assess all seven dimensions;
3. capture the raw answer and expected criteria;
4. propose the smallest scoped correction;
5. validate correction scope and mutation guardrails;
6. when an authorised sandbox `apply` callback is supplied, apply the correction and its regression tests;
7. repeat the same question, up to the bounded cycle limit, until it passes.

CI intentionally runs in **audit/proposal mode**: it executes the real answer path and records a validated proposal when a case fails, but does not self-modify the repository. Code application is allowed only in an explicit governed development/sandbox execution where the caller provides the `apply` callback. This prevents CI from silently rewriting source code.

## Guardrails

The QA/correction engine must never:

- alter transactional business data automatically;
- create, approve or issue a purchase order automatically;
- commit funding automatically;
- change a customer promise automatically;
- release production automatically;
- edit migrations or transaction-authority modules as a correction shortcut.

Any QA mutation, including fixture mutations, requires a governed test fixture or sandbox. Corrections are allow-listed to VIBPE/IBPE Co-Pilot code, VIBPE tests/docs and the VIBPE Co-Pilot CI workflow.

## Governed specialist truth

Questions where planning packets are insufficient are answered from read-only canonical sources before planning fallback:

- cash: `vyndi_cash_authority` plus latest governed IBPE snapshot;
- inventory: `vyndi_report_procurement_net_requirement` plus committed requirements;
- job card / Traveller: confirmed-order → current job-card → material requirement → `epr_travellers` lineage;
- actual-vs-plan: `vyndi_monthly_transaction_actuals` versus the current approved operating plan.

Planning procurement and funding answers explicitly remain recommendations, not commitments. Planning liquidity is explicitly not presented as current ledger cash.

## Evidence output

Every run writes both JSON and Markdown under `artifacts/vibpe-qa/`. Each cycle records:

- question;
- raw answer;
- expected-answer criteria;
- defect class and seven dimension results;
- correction proposal;
- changed files (when an apply cycle is authorised);
- regression-test results;
- before and after response.

GitHub Actions uploads these reports as the `vibpe-qa-cycle-audits` artifact for 30 days. Missing audit output fails the VIBPE Co-Pilot deployment gate.

## Performance boundary

The autonomous QA suite runs in CI or an explicit QA execution, not on every user question. Live runtime cost is limited to the read-only specialist query only when the user asks a question in one of those specific live-authority domains. Normal unrelated Co-Pilot questions continue through the existing routing path.
