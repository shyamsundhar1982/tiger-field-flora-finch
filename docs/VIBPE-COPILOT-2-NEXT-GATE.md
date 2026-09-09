# VIBPE Co-Pilot 2.0 Integration Gate

Before merge:

1. Integrate `runVibpeCopilot2` into the existing request path before generic deterministic fallback.
2. Run TypeScript/build and all VIBPE regression tests.
3. Correct any schema/type drift found by CI.
4. Confirm the user-reported prompts exercise the new path.
5. Convert PR #62 from draft only when the gate is green.
