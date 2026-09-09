# Integration note

The next code change must occur in `src/lib/ibpe-copilot.ts`: after loading the governed run and before the generic `deterministicAnswer(...)` fallback, invoke VIBPE 2 intent/scenario orchestration. If it returns an intent-specific answer, return that answer with the existing governed lineage. Otherwise continue through the legacy specialized deterministic handlers.
