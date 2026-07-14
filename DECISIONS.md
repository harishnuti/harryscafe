# Deviations Log (per Architecture §0)
- D1: Service worker is hand-rolled (public/sw.js, cache-first same-origin) instead of Workbox. Rationale: zero extra build tooling, identical offline outcome at this scale. Revisit if precache manifests become necessary.
- D2: Café name "FLUID" (entry #33) normalized to "Fluid Collective" in master data. Rationale: entry #52 context confirms same house ("Third visit to Fluid Collective"). Flagged to owner 06 Jul 2026.
- D3: Entries #49 and #53 starred per explicit verdict language ("Top-tier entry — starred"; "Top of my list"). Flagged to owner 06 Jul 2026.

## v3.1 — Research-Verified Search (architecture pivot)
Supersedes v3.0's keyword-fanout Radar entirely, per GATEKEEPER_V3.1_RESEARCH_VERIFIED_SEARCH.md.
- D4: Old `src/services/places.ts` runSearch/scorePlace (9-parallel-keyword-search + top-15-ranking
  score) removed. Replaced by src/services/verify.ts (Step 2 — one call per named Registry candidate,
  concurrency 2, ground-truth location override) + src/services/confirmation.ts (tier-based
  confirmation logic, §3 of the amendment).
- D5: Concept aliasing (V60/hand brew/filter coffee → pour over; third wave → specialty coffee)
  implemented in confirmation.ts's resolveEvidence(), not duplicated as separate registry keys.
  Caught by the test suite (Appendix A fixtures initially failed until this was added) — a good
  example of the regression suite doing its job on the very first implementation pass.
- D6: 5 Registries shipped as bundled TypeScript data (src/data/registry/*.ts), populated from the
  actual Research Sessions run during architecture design — not placeholder/synthetic data.
- D7: tests/score.test.ts (v3.0 scoring fixtures) removed; tests/confirmation.test.ts added,
  encoding all 5 Appendix A regression fixtures as executable tests.
