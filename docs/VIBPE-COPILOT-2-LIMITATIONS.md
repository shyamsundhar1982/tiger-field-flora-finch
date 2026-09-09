# VIBPE Co-Pilot 2.0 Current Limitations

VIBPE 2.0 is wired into the production Co-Pilot request path ahead of the existing governed fallback.

Current boundaries:

- VIBPE 2.0 directly handles conversational, contextual follow-up, planning-horizon and parsed scenario requests.
- Requests it does not claim continue through the existing deterministic/AI path.
- Session context is process-local and may not persist across serverless instances.
- External knowledge remains reference-only and cannot overwrite approved VYNDI business truth.
- Runtime activation must be confirmed separately on each deployed target.
