# Gatekeeper v3.1 — Connoisseur Field Kit
## Research-Verified Search
Built per GATEKEEPER_V3_ARCHITECTURE.md (golden source). Vite 5 + TypeScript + Preact + IndexedDB PWA.

## Dev
npm install && npm run dev

## Test / Build
npm test        # 24 tests: confirmation engine, all 5 Appendix A regression fixtures,
                # ground truths, CSV contract
npm run build   # typecheck + production bundle → dist/

## Deploy
Netlify site: hari-gatekeeper (ID 957fb4ef-b9d7-4554-9ad0-3ba192257866)
Either drag dist/ into the site's Deploys page, or connect this repo (netlify.toml included).

## Research Sessions (new area registries)
Ask Claude to research a city/area + keyword combination. The output is a new
src/data/registry/{slug}.ts file, added to REGISTRIES in src/data/registry/index.ts.
See GATEKEEPER_V3.1_RESEARCH_VERIFIED_SEARCH.md for the full algorithm.

## Data refresh (new archive versions)
Regenerate src/data/master.ts from the latest master CSV/XLSX — see scripts/ note in architecture §8.2.

## API key
Entered at runtime in Settings → stored on-device only. Never commit a key.
