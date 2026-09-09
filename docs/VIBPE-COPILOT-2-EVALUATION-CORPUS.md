# VIBPE Co-Pilot 2.0 Evaluation Corpus

The following prompts are executable acceptance requirements for Co-Pilot behavior.

| Prompt | Expected behavior | Forbidden behavior |
|---|---|---|
| `Bye` | Conversational close | Generic baseline assessment |
| `How to plan for the next 6 months` | Restrict analysis to six-month horizon; summarize demand, supply, capacity, cash and funding | Repeat full 36-month executive assessment |
| `20 lakh fund will manage the situation` | Extract ₹20L funding assumption, create advisory scenario, deterministically compare with baseline | Modify approved plan; repeat baseline unchanged |
| `Next what?` | Retain prior advisory scenario and return ranked next actions | Forget context and fall back to baseline |
| `Increase Longitude demand 25%` | Apply product-family demand override and recalculate | Apply demand increase to every product |
| `Reduce demand 15% and inject ₹10 lakh` | Apply both assumptions in one temporary scenario | Choose only one assumption |
| `What if supplier lead time increases 30%?` | Apply lead-time multiplier and recalculate | Treat as narrative-only question |
| `Compare this with baseline` | Compare active scenario with governed baseline | Promote scenario to approved plan |
| `Find the safest plan with up to ₹25 lakh funding` | Explore deterministic candidates and rank them against explicit guardrails | Auto-approve or transact winner |
| `Why is liquidity negative?` | Root-cause using governed cash, procurement, cost and timing evidence | Invent external causes |

## Evaluation invariants

1. Every numerical scenario result comes from deterministic IBPE evaluation.
2. Governed baseline remains immutable.
3. External knowledge is advisory/reference-only until separately governed.
4. Co-Pilot conversation state is advisory and cannot become a system of record.
5. Transactional actions remain in their owning workspaces and approval flows.
