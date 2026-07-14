# GATEKEEPER v3 — Solution Architecture Document
### The Connoisseur Field Kit · Golden Source Specification
**Owner:** Hari (Master Extraction Archivist) · **Prepared for:** Claude Code implementation
**Version:** 3.0.0-draft1 · **Date:** July 2026 · **Status:** Approved for build pending API key

---

## 0. Document Purpose & How to Use It

This document is the single authoritative specification for Gatekeeper v3. It is written to be handed directly to Claude Code as the project brief. Every module has explicit acceptance criteria (§16). Where engineering judgment calls exist, a decision is recorded with rationale (§5, marked **DR-n**). An implementing agent should follow decisions as written unless a blocking technical constraint is discovered, in which case the deviation must be logged in `DECISIONS.md` in the repo root.

Build order for Claude Code: scaffold (§14.1) → data layer (§8) → Radar search engine (§6–7) → results UI (§3.1) → portfolio & dossiers (§3.4–3.5) → audit capture (§3.6) → codex & intel (§3.7–3.8) → PWA hardening (§9) → test pass (§13) → deploy (§14).

---

## 1. Executive Summary

Gatekeeper is a single-user, mobile-first Progressive Web App for a specialty-coffee connoisseur who audits cafés with scientific rigor. Version 3 graduates the app from a "query launcher" to a **true search client**: it calls the Google Places API (New) directly, merges and scores candidate cafés against the owner's weighted keyword arsenal, and renders a ranked, badge-annotated result list sorted by distance from the user's live position — before any handoff to Google/Apple Maps. Around this core, v3 delivers a visual portfolio of the 48-entry master archive, café dossiers, a prioritized wishlist, a field-audit capture form matched to the master CSV schema, an enriched Hardware Codex, and an analytics layer ("Intel").

The system is deliberately **client-only**: no backend, no accounts, no server costs. All state persists on-device (IndexedDB). The only external dependency is the Google Places API, called directly from the client with a domain-restricted key supplied by the owner. Hosting is the existing Netlify project `hari-gatekeeper` (site ID `957fb4ef-b9d7-4554-9ad0-3ba192257866`, URL `https://hari-gatekeeper.netlify.app`).

**Non-goals for v3:** multi-user support, social features, cloud sync, native App Store distribution, scraping of café websites/menus, review aggregation beyond Google ratings.

---

## 2. User Context & Personas

There is exactly one user: Hari — Singapore-based, operates a rigorous personal coffee audit archive (48 entries as of July 2026 across Singapore, Bali, Mumbai, Johor Bahru; 27 unique cafés; master data in a versioned CSV/XLSX pair with a fixed 22-column schema). His methodology includes a three-phase thermal read (hot / mid-cool / cool), a "Palate DNA" preference profile (washed-process clarity, malic acidity, linalool florals, flat-burr grinders, flat-bottom brewers, 1:15–1:17 ratios, Gesha at the varietal apex), and a strict vetting philosophy: cafés must *earn* list placement.

Usage contexts, in priority order: (1) standing on a street or planning a trip, wanting the best specialty café nearby ranked by his criteria; (2) mid-visit at a bar, capturing a field audit one-thumbed; (3) at leisure, browsing his portfolio, dossiers, hardware knowledge, and analytics; (4) maintaining a wishlist pipeline of vetted targets (current known targets: Glyph Supply Co — Jurong, high priority; Dough — Victoria Street, medium; upcoming travel: Coorg/Chikmagalur India in December, Tokyo and Melbourne aspirational).

Design temperament: dark, warm espresso palette; editorial serif/mono typography; information-dense but composed; zero amateur visual language. The established design system (v2) carries forward: bg `#0e0a06`, card `#1c140b`, accent `#d98d3a`, cream text `#f2e8d5`, fonts Cormorant Garamond / Space Mono / DM Sans.

---

## 3. Functional Specification

### 3.1 Module: RADAR — The Search Engine (v3 flagship)

**Purpose.** Find specialty cafés near a location that pass the owner's weighted keyword criteria, and present them ranked in-app before any maps handoff.

**Inputs.** (a) The keyword arsenal: an editable, persisted list of keywords, each with a user-assigned weight 1–10 and an armed/disarmed toggle. Defaults ship per Appendix C. (b) Location: device GPS via Geolocation API by default, with a manual text override ("Jurong", "Shibuya, Tokyo") geocoded through the Places Text Search itself. (c) Filters: minimum Google rating (default 4.3, adjustable 3.5–4.8), minimum review count (default 30), open-now toggle (default off), search radius (default 3 km; options 1/3/5/10/25 km), result cap (default 20).

**Behavior.**
1. On Search, resolve origin coordinates (GPS or geocoded override). GPS failure falls back to last-known origin, then to a Singapore CBD default with a visible notice.
2. Fire one Places API `searchText` request per armed keyword, in parallel (see §7 for exact request contract). Each request is location-biased to the origin and radius.
3. Merge results by `place.id`. For each unique place, record *which* keywords surfaced it.
4. Score each place per the algorithm in §4. Discard places under the score floor (default 35%).
5. Compute geodesic distance from origin (haversine; §7.6).
6. Render the ranked list (default sort: distance ascending; alternate sorts: match % descending, rating descending — one-tap toggle).
7. Cache the full result set with timestamp in IndexedDB (`searches` store) so the last search re-renders instantly offline.

**Result card anatomy.** Each card shows: café name; distance (m/km, one decimal); **match % as a prominent ring or bar**; Google rating ★ and review count; open-now status if requested; and a **badge row** — one badge per matched keyword concept, using an icon+label chip (e.g., ⏳ pour over · ◎ specialty · 🔥 roaster · 🌱 single origin · ⭐ highly rated ≥4.5 · 🏆 review-deep ≥300). Badges derive from the keyword→concept mapping in Appendix C; unmatched concepts simply don't render (no negative badges).

**Card actions.** Tap anywhere → detail sheet with address, rating breakdown, price level if present, and two buttons: **Open in Google Maps** (primary; deep-link by place ID: `https://www.google.com/maps/search/?api=1&query=<escaped name>&query_place_id=<placeId>`) and **Open in Apple Maps** (`https://maps.apple.com/?q=<name>&ll=<lat>,<lng>`). Secondary actions: **Add to Wishlist** (pre-fills name/area/coords) and **Run the Gate** (jumps to Gate module with candidate name pre-filled).

**States.** Loading (skeleton cards + per-keyword progress ticks), partial failure (some keyword calls failed — show results with a warning strip naming failed keywords), quota/auth failure (clear message: key invalid / referrer blocked / quota exceeded, with a link to Settings), empty (no places passed the floor — suggest lowering floor or widening radius), offline (render last cached search with its age).

### 3.2 Module: GATE — The Examination

Carried over from v2 functionally intact: a weighted, user-editable checklist (defaults in Appendix D) with an adjustable admission threshold (default 65%); candidates score live; **Admit** pushes to Wishlist/Targets with score attached; **Decline** logs to The Declined with score and date. v3 additions: criteria weights are editable inline (long-press or edit icon, no delete-and-re-add); an examination can be attached to a Radar result (carrying place ID and coordinates); examination history is persisted per café name so re-examinations show deltas.

### 3.3 Module: WISHLIST — The Pipeline

A prioritized list of cafés to visit. Fields: name, area/city, coordinates + place ID when originating from Radar, priority (HIGH / MEDIUM / LOW), source note (who recommended / why), gate score if examined, date added. Seeded with Glyph Supply Co (HIGH) and Dough (MEDIUM). Actions per item: Navigate (Google Maps deep link), Run the Gate, Begin Audit (pre-fills capture form), Mark Visited (prompts to begin audit; on save, item moves out of wishlist automatically because the café now exists in the portfolio), Remove. Sortable by priority and date added.

### 3.4 Module: PORTFOLIO — The Visited Record

A visual, browsable representation of everything audited. Two views, toggleable:

*Journey view* — entries as a reverse-chronological feed of rich cards (coffee name, café, date, process badge, star marker, flavor notes line, verdict excerpt), filterable by city, process family, varietal court, and starred-only, with full-text search. This is the "show a friend" view.

*Dossier view* — the v2 café dossiers, upgraded: per-café aggregation of visits, entries, stars, grinders observed, brewers, ratios, temperature protocols, origins poured, varietals, processes, average price, standout entry, last visit; sortable by visits/recency/standouts; actions Navigate / Repeat Audit / View Entries. Dossiers must recompute live to include on-device field audits, not just the embedded master 48.

### 3.5 Module: VAULT — The Ledger

The complete entry archive: embedded master dataset (48 entries, enriched fields per §8.2) plus device-captured field audits (marked ◈ FIELD). Expandable rows exposing all audit fields. Full-text search across coffee, café, varietal, process, notes, verdict, origin. This is the module of record; Portfolio is the module of presentation.

### 3.6 Module: AUDIT — Field Capture

The one-thumb entry form, carried from v2 with these upgrades: café autocomplete from proven cafés + wishlist; datalists for grinders (22+ market units, Appendix E), brewers (18+), varietals (36+ incl. Eugenioides), processes (19+ incl. mosto, EF2), origins (33 regions incl. Coorg & Chikmagalur), temperature protocols (constant / step-down / ramp presets); ratio picker 1:14→1:17 + espresso; dose/yield numerics; three-phase read as three distinct fields (HOT / MID-COOL / COOL) concatenated into `Your_Verdict` on export with phase prefixes; visit context field. **CSV export must emit rows byte-compatible with the master schema** (Appendix A) via Web Share API with clipboard fallback. `Technical_Enrichment` exports as `"Pending Claude enrichment"` — enrichment remains Claude's job in the established workflow, and the app must not fabricate it.

### 3.7 Module: CODEX — Hardware & Knowledge Reference

A curated, offline reference library rendered from a structured dataset embedded in the app (Appendix F seeds it; the dataset is designed for easy extension via future file updates). Three shelves:

*Grinders* — per unit: burr geometry (size, flat/conical, coating), grind character (fines profile, clarity vs body bias), café sightings from the archive (computed), and a connoisseur note (e.g., EK43's bimodal-but-low-fines signature; why Lagom P64 suits flash-chill florals; SSP burr variants on the Sculptor 078).

*Brewers* — per unit: bed geometry, bypass behavior, flow character, thermal retention, archive sightings, technique notes (e.g., Orea V4 bottom-bypass and its effect on perceived sweetness; Deep27 immersion-assist and the Kyūkei 85→95 ramp; xBloom automation vs the owner's 2050 manifesto distinction — automated *assistance* vs automated *replacement*).

*Method* — reference cards for the owner's own doctrine: the three-phase thermal read, the Palate DNA profile, ratio band reasoning, the flat-vs-conical evidence from the archive, temperature protocol taxonomy (constant / step-down dual / ascending ramp), and the acid lexicon (citric, malic, phosphoric, acetic/lactic) with archive exemplars.

Each codex card cross-links: tapping "EK43" anywhere (dossier, vault row) opens its codex card; codex cards list the archive entries that used the hardware.

### 3.8 Module: INTEL — Analytics

Carried from v2 and recomputed live including field audits: KPI strip; ratio spectrum with Palate DNA band conformity %; grinder league (cups + stars per unit, burr class); brewer geometry split with star rates and the documented V60 over-extraction pattern note; temperature protocol census; origin census; varietal court; process register; price intelligence (avg, extremes, best-value starred cup). v3 addition: a **Radar effectiveness** panel — searches run, cafés surfaced, converted to wishlist, converted to audits (a personal funnel).

### 3.9 Module: SETTINGS

API key entry (stored device-only in IndexedDB, masked display, test-call button that validates the key with a 1-result probe and reports the exact failure class if any); search defaults (radius, floors, filters); primary maps app (Google default, Apple secondary — affects which button is primary on result cards); data management (export full JSON backup, import/restore backup with schema-version check, export field audits CSV, danger-zone wipe); about panel (version, entry counts, storage usage estimate via `navigator.storage.estimate()`).

---

## 4. The Scoring Algorithm (normative)

Let the armed keyword set be K = {k₁…kₙ}, each with weight wᵢ ∈ [1,10]. For a candidate place p returned by at least one search:

```
matched(p)   = { kᵢ ∈ K : p appeared in the searchText results for kᵢ }
base(p)      = Σ wᵢ over matched(p) / Σ wᵢ over K            ∈ (0,1]
rating_bonus = +0.06 if rating ≥ 4.5 and reviews ≥ 50
             = +0.03 if rating ≥ 4.3 and reviews ≥ 30
             =  0    otherwise
depth_bonus  = +0.04 if reviews ≥ 300
             = +0.02 if reviews ≥ 100
             =  0    otherwise
type_penalty = −0.15 if primaryType ∉ {cafe, coffee_shop, bakery, restaurant}
score(p)     = clamp(base(p) + rating_bonus + depth_bonus + type_penalty, 0, 1)
display      = round(score × 100)%
```

Floor: discard `score < 0.35` (user-adjustable 0.20–0.60). Rank position within a keyword's results does not affect the score in v3 (recorded as a v4 candidate: positional decay `wᵢ × (1 − 0.02·rank)`). The badge row renders the *concepts* of matched(p) via Appendix C's mapping, plus ⭐ if rating_bonus > 0 and 🏆 if depth_bonus ≥ 0.04. The score tooltip/detail sheet must itemize the arithmetic — the owner audits everything, including the app.

Deduplication: places merge on `place.id`. Name-similarity merging is explicitly out of scope (place IDs are canonical).

---

## 5. Technical Stack — Decision Records

**DR-1 · Runtime architecture: client-only SPA/PWA. No backend.** Rationale: single user, zero ops budget, offline-first requirement, and the Places API (New) supports browser calls with referrer-restricted keys. A serverless proxy (Netlify Functions) was considered for key concealment and rejected for v3: referrer restriction + per-key quota caps give adequate protection for a personal app, and the proxy adds latency, cold starts, and a second codebase. Recorded as the designated v4 upgrade path if key abuse is ever observed.

**DR-2 · Framework: Vite + TypeScript + Preact.** Rationale: the app has real state now (search sessions, stores, cross-module navigation); vanilla single-file served v1/v2 well but is past its maintainability ceiling. Preact delivers a React programming model at ~4 kB, keeps the bundle inside the performance budget (§12), and is idiomatic for Claude Code. Vite gives instant dev server, TS, and a clean Netlify build. React, Svelte, and no-framework were considered; Preact wins on size-to-ergonomics for a solo PWA.

**DR-3 · State: module-local signals (`@preact/signals`) + a thin persistence layer over IndexedDB (`idb` library).** No Redux-class machinery — unjustified for one user.

**DR-4 · Storage: IndexedDB, versioned, replacing v2 localStorage.** Rationale: localStorage is synchronous, ~5 MB, string-only; IndexedDB handles cached search payloads, backups, and future images. A one-time migration imports any existing v2 `gk_*` localStorage keys (§8.4).

**DR-5 · Styling: hand-rolled CSS with custom properties (the established design system), organized as CSS modules per component.** No Tailwind — the visual identity is bespoke and already specified; utility CSS would fight it.

**DR-6 · Maps rendering: none in v3.** Result list is the product; embedding an interactive map adds an SDK, cost class, and complexity. Deep links to Google/Apple Maps handle spatial exploration. Recorded v4 candidate: static minimap tiles.

**DR-7 · Distribution: PWA on Netlify.** Add-to-Home-Screen on iOS Safari, full manifest + service worker (§9). Native wrapper (Capacitor) recorded as v5 option if push notifications or background location ever matter.

Stack summary: `Vite 5 · TypeScript 5 · Preact 10 + @preact/signals · idb 8 · Workbox 7 (SW build) · Vitest + Playwright · Netlify (static deploy, existing site)`.

---

## 6. System Architecture

```
┌────────────────────────────── iPhone / Browser ──────────────────────────────┐
│  ┌──────────── UI Layer (Preact) ────────────┐                               │
│  │ Radar · Gate · Wishlist · Portfolio ·     │                               │
│  │ Vault · Audit · Codex · Intel · Settings  │                               │
│  └───────┬───────────────────────┬───────────┘                               │
│  ┌───────▼────────┐   ┌──────────▼──────────┐   ┌────────────────────────┐   │
│  │ Search Service │   │  Data Service       │   │  Export Service        │   │
│  │ · fan-out      │   │  · master dataset   │   │  · CSV emitter         │   │
│  │ · merge/score  │   │  · dossier compute  │   │  · JSON backup         │   │
│  │ · rank/cache   │   │  · intel compute    │   │  · Web Share / clip    │   │
│  └───────┬────────┘   └──────────┬──────────┘   └────────────────────────┘   │
│  ┌───────▼──────────────────────▼───────────────────────────────────────┐    │
│  │            Persistence Layer — IndexedDB  (idb)                      │    │
│  │  stores: settings · keywords · criteria · wishlist · audits ·        │    │
│  │          searches(cache) · examinations                              │    │
│  └───────────────────────────────────────────────────────────────────────    │
│  Service Worker (Workbox): app-shell precache · runtime caching · offline    │
└───────────────┬───────────────────────────────────────────────────────────────┘
                │ HTTPS (only external call)
        ┌───────▼───────────────────────────┐
        │  Google Places API (New)          │
        │  places:searchText                │
        │  key: owner-supplied, referrer-   │
        │  restricted to the Netlify origin │
        └───────────────────────────────────┘
Hosting: Netlify site hari-gatekeeper (static; HTTPS; HTTP/2)
```

The master archive dataset ships inside the bundle as a typed module (regenerated from the CSV at build time by a script, §8.2), so the entire portfolio/codex/intel experience is fully offline. The only network-dependent feature is a live Radar search; everything else, including the last cached search, works in airplane mode.

---

## 7. Google Places API (New) — Integration Contract

**7.1 Endpoint.** `POST https://places.googleapis.com/v1/places:searchText` with headers `Content-Type: application/json`, `X-Goog-Api-Key: <key>`, and a **field mask** (mandatory; controls billing SKU):
`X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.primaryType,places.priceLevel,places.googleMapsUri`

**7.2 Request body** per armed keyword kᵢ:
```json
{
  "textQuery": "<kᵢ> coffee",            // raw keyword if it already contains 'coffee'
  "locationBias": { "circle": { "center": { "latitude": LAT, "longitude": LNG },
                                 "radius": RADIUS_M } },
  "maxResultCount": 15,
  "openNow": <bool, only when filter armed>
}
```
When the user types a manual area override, append `" in <area>"` to `textQuery` and omit `locationBias`; take the origin for distance math from the top result's location (documented approximation, shown in UI as "distances from <area> center").

**7.3 Concurrency & rate.** Fan out with `Promise.allSettled`, concurrency cap 4, per-request timeout 8 s via `AbortController`. Partial failures degrade gracefully (§3.1 states).

**7.4 Cost control.** Text Search (with this mask) bills in the Pro SKU; Google's monthly free allowance comfortably covers personal volume (a search session = n armed keywords ≤ ~8 requests; even daily use lands ~250 requests/month). Hard guards anyway: (a) client-side session cache — identical query set + origin within 500 m within 15 min is served from cache; (b) in-app monthly request counter surfaced in Settings; (c) documentation directs the owner to set a Google Cloud budget alert. The app must never auto-poll; searches are always explicit user actions.

**7.5 Key security model.** Key entered once in Settings, stored in IndexedDB only, never bundled, never committed, never logged. Google-side restrictions (owner setup, documented in Settings help text): HTTP referrer restriction to `https://hari-gatekeeper.netlify.app/*` and API restriction to Places API (New) only. Threat model accepted for v3: a key extracted from the device is useless off-origin; worst case is quota burn on the owner's own project, bounded by the budget alert. Escalation path: DR-1's Netlify Function proxy.

**7.6 Distance.** Haversine, WGS-84 mean radius 6371.0088 km; display `<1 km → meters (no decimals)`, `≥1 km → km, one decimal`.

**7.7 Attribution & ToS.** Result screens display "Powered by Google" per Places attribution requirements; place data is rendered live or from the short-lived session cache only (≤15 min), not persisted into permanent stores except the fields the user explicitly saves to Wishlist (name, coords, place ID — permitted identifiers).

---

## 8. Data Architecture

**8.1 IndexedDB schema** — database `gatekeeper`, version 1:

| Store | Key | Contents |
|---|---|---|
| `settings` | fixed keys | apiKey, radiusDefault, ratingFloor, reviewFloor, scoreFloor, mapsPrimary, schemaVersion |
| `keywords` | uuid | { text, weight 1–10, armed, concept? } |
| `criteria` | uuid | { text, weight 1–10 } gate criteria |
| `examinations` | uuid | { cafeName, placeId?, date, toggles[], score, verdict } |
| `wishlist` | uuid | { name, area, lat?, lng?, placeId?, priority, note, gateScore?, added } |
| `audits` | uuid | full 22-field record mirroring the CSV schema + capturedAt |
| `searches` | uuid | { origin, radius, keywords[], results[], ts } — ring buffer, keep last 10 |

**8.2 Embedded master dataset.** `src/data/master.ts` exports `MasterEntry[]` (48 records) with fields: `n, dateISO, cafe, city, coffee, originCountry, originRegion, varietal, process, processFamily, brew, brewGeometry(flat|conical|immersion|pour|milk|auto), ratioLabel, ratioValue|null, tempProtocol, tempClass(constant|stepdown|ramp|unknown), grinder, grinderClass, priceSGD|null, officialNotes, verdictShort, star, contextTag`. A build script `scripts/csv-to-master.ts` regenerates this module from the canonical CSV (`hari_coffee_audit_unified_2026_<date>.csv`) so future archive updates are a one-command refresh: `npm run data:refresh -- path/to/new.csv`. The script must apply the established normalizations (café name consistency e.g. "Kyuukei Coffee"; N/A-vs-Unknown semantics preserved verbatim; column-specific parsing only — never fuzzy row matching).

**8.3 CSV export contract.** Field audits export with the exact master header (Appendix A), RFC-4180 quoting, `Source = "Gatekeeper Field Kit"`, `Technical_Enrichment = "Pending Claude enrichment"`. Round-trip requirement: a row exported by the app and appended to the master CSV must survive `data:refresh` unchanged.

**8.4 Migration.** On first boot, if `localStorage['gk_kws'|'gk_crits'|'gk_hits'|'gk_audits']` exist (v2), import into the corresponding stores, then write `localStorage['gk_migrated']='1'` and leave originals untouched (rollback safety).

**8.5 Backup/restore.** Full-state JSON: `{ schemaVersion, exportedAt, settings-sans-apiKey?, keywords, criteria, examinations, wishlist, audits }`. API key excluded by default from shared backups (checkbox to include, default off — backups travel through share sheets). Restore validates schemaVersion and store shapes before any write, then writes transactionally.

---

## 9. PWA Specification

Manifest: name "Gatekeeper", short_name "Gatekeeper", display `standalone`, orientation `portrait`, theme/background `#0e0a06`, icons 180/192/512 (generated espresso-tone ☕ mark), start_url `/`. iOS meta set (`apple-mobile-web-app-capable`, status-bar `black-translucent`, touch icon) because iOS still honors these over parts of the manifest.

Service worker (Workbox, injected at build): precache the app shell (HTML/JS/CSS/fonts/icons) with cache-first + versioned cleanup; Google Fonts runtime-cached stale-while-revalidate; **Places API responses are never SW-cached** (session cache in IndexedDB is the only permitted reuse, §7.4). Update flow: on new SW waiting, show a quiet "Update ready — tap to refresh" toast; never force-reload mid-audit-entry.

Offline matrix: Portfolio/Vault/Codex/Intel/Gate/Wishlist/Audit — fully functional. Radar — renders last cached search with age label; live search disabled with a clear offline notice. Geolocation prompt appears only on first Radar use, never on app launch.

---

## 10. Security & Privacy

Single-origin static app over HTTPS. No analytics, no third-party scripts, no cookies. CSP header via `netlify.toml`: `default-src 'self'; connect-src 'self' https://places.googleapis.com; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:;` (tighten `unsafe-inline` post-v3 by hashing). API key handling per §7.5. Location is used transiently for search math, stored only inside the bounded `searches` ring buffer, and never transmitted anywhere except inside the Places request itself. All personal archive data remains on-device or in the owner's own GitHub/Netlify estate.

---

## 11. Error Handling & Resilience Doctrine

Every external interaction has a typed failure path surfaced in the UI in the owner's editorial voice — precise, never cute. Classes: `GEO_DENIED / GEO_TIMEOUT` (offer manual area), `KEY_MISSING / KEY_INVALID / KEY_REFERRER / QUOTA` (each with distinct copy and a Settings link; the test-call button in Settings reproduces the class), `NET_OFFLINE` (cached-search mode), `PARTIAL_RESULTS` (warning strip listing failed keywords), `STORE_FULL` (IndexedDB quota — prompt backup+prune of `searches`). All service-layer functions return `Result<T, AppError>`; no raw exceptions cross into components. Console is clean in production.

---

## 12. Performance Budget

First load on 4G: ≤ 180 kB gzipped JS (Preact + app ≈ 60–90 kB realistic), ≤ 30 kB CSS, fonts subset+`display=swap`. Time-to-interactive on an iPhone 12-class device: < 2.0 s cold, < 0.5 s from SW cache. Radar search: skeletons render immediately; first scored results paint as soon as the first two keyword calls settle (progressive merge), full list within timeout ceiling 8 s. Vault/Portfolio render 48+N rows without virtualization (unneeded below ~500 rows; revisit at v4). Lighthouse PWA category: 100; Performance ≥ 90 mobile.

---

## 13. Testing Strategy

*Unit (Vitest):* scoring algorithm across weight/bonus/penalty matrices including floor edges; haversine against known fixtures; CSV emitter round-trip vs Appendix A golden file; dossier and intel aggregation against the embedded 48 (assert: 27 cafés, 15 stars, 32 known ratios, 26 in-band, avg price S$10.48 ±0.01 — these are the verified ground truths); migration importer.
*Integration (Vitest + fake fetch):* fan-out/merge with mixed success/failure/timeout; session-cache hit logic; quota counter.
*E2E (Playwright, mobile viewport):* search happy path with mocked Places responses → ranked list → badges correct → maps deep link URL shape; audit capture → vault appearance → CSV export string; backup/restore cycle; offline mode (SW) smoke.
*Manual device pass (owner):* iOS Safari A2HS, geolocation prompt, share-sheet exports, standalone-mode status bar.

CI: GitHub Actions — typecheck, unit+integration, Playwright headless, build; Netlify deploys on green main.

---

## 14. Repository, Build & Deployment

**14.1 Repo layout** (new repo `hari-gatekeeper-app`, or `/app` workspace in the existing portal repo — owner's choice; new repo recommended for clean CI):
```
/src
  /app            shell, router (hash-based), theme.css
  /modules        radar/ gate/ wishlist/ portfolio/ vault/ audit/ codex/ intel/ settings/
  /services       search.ts places.ts score.ts geo.ts store.ts export.ts migrate.ts
  /data           master.ts codex.ts keywords.ts criteria.ts
/scripts          csv-to-master.ts icon-gen.ts
/tests            unit/ e2e/
netlify.toml      (headers incl. CSP; SPA fallback)
vite.config.ts    (Preact preset, Workbox inject)
DECISIONS.md      (deviations log, per §0)
```
**14.2 Netlify.** Existing site `hari-gatekeeper` (ID `957fb4ef-…`). Build `npm run build`, publish `dist/`. Connect the repo for git-push deploys (ends the manual drag-and-drop era for the app). `netlify.toml` carries headers and `/*  /index.html  200` fallback.
**14.3 Versioning.** SemVer in manifest + Settings/About; CHANGELOG.md; tags per release.

---

## 15. Roadmap Beyond v3 (recorded, not committed)

v3.1 — positional decay in scoring; per-concept score breakdown chart; wishlist geofenced "you're near a target" banner (foreground-only). v4 — Netlify Function proxy option for the key; static minimaps; photo attachment on audits (IndexedDB blobs) feeding the infographic workflow; import of the Drawdown narrative as an in-app "Story" tab; Coorg/Chikmagalur trip mode (offline origin-region codex pack). v5 — Capacitor wrapper evaluation; optional encrypted cloud backup (owner-held key); multi-city keyword profiles (Tokyo/Melbourne presets).

---

## 16. Acceptance Criteria (v3 ship gate)

1. With a valid key, a search from a Singapore location with defaults returns a ranked list ≤ 8 s; every card shows distance, match %, rating, and ≥1 accurate badge; tapping opens the exact place in Google Maps via place ID.
2. Match % arithmetic is inspectable per café and matches §4 exactly for hand-computed fixtures.
3. Airplane mode: app launches from home screen, portfolio/vault/codex/intel/audit fully usable, last search visible with age.
4. A field audit captured on-device exports a CSV row that round-trips through `data:refresh` byte-identically.
5. Dossiers and Intel include device audits in their aggregates immediately after save.
6. v2 localStorage data migrates on first boot with nothing lost.
7. Wrong/unrestricted-referrer/missing key each produce their distinct, correct error message via the Settings test button.
8. Lighthouse: PWA 100, Performance ≥ 90, Accessibility ≥ 90 (mobile).
9. No network requests exist in the app other than `places.googleapis.com` and font loading; verified in E2E.
10. The design reads as the owner's established identity — dark espresso, editorial serif, zero amateur UI vocabulary — confirmed by the owner on device.

---

## Appendix A — Master CSV Schema (canonical, byte-exact header)
```
Date,City,Cafe_Name,Coffee_Name,Producer_Farm,Origin,Varietal,Process,Roast_Level,Brew_Method,Dose_g,Yield_g,Ratio,Water_Temp_C,Bloom,Grinder,Price_SGD,Official_Notes,Your_Verdict,Technical_Enrichment,Visit_Context,Source
```
Semantics: `Unknown` = data genuinely missing; `N/A — <reason>` = structurally inapplicable (e.g., dose/yield for batch dispense). Dates ISO `YYYY-MM-DD`. Verdict may embed phase prefixes `HOT: … | MID-COOL: … | COOL: …`.

## Appendix B — Verified Ground Truths (test fixtures)
48 entries · 27 unique cafés · 15 starred · 32 known ratios, 26 within 1:15–1:17 (81%) · 33 priced cups, mean S$10.48 · top cafés by entries: Nylon (5), Asylum (4) · cities: Singapore, Ubud Bali, Mumbai, Johor Bahru · origin countries: 14 incl. China, Malaysia, Myanmar firsts.

## Appendix C — Default Keyword Arsenal → Badge Concepts
| Keyword (default weight) | Concept badge |
|---|---|
| specialty coffee (9) | ◎ Specialty |
| pour over (9) | ⏳ Pour Over |
| single origin (8) | 🌱 Single Origin |
| filter coffee (7) | ☕ Filter |
| hand brew (6) | ✋ Hand Brew |
| coffee roaster (6) | 🔥 Roaster |
| light roast (5) | 🌤 Light Roast |
| gesha (4) | 🧬 Rare Varietal |
| V60 (4) | ⏳ Pour Over (alias) |
| third wave (3) | ◎ Specialty (alias) |
Derived badges: ⭐ Highly Rated (§4 rating_bonus) · 🏆 Review-Deep (§4 depth_bonus ≥ 0.04). Aliases share a concept: the badge renders once, the weights still both count.

## Appendix D — Default Gate Criteria (weight)
Dedicated filter/pour-over menu (9) · Single origins offered (9) · Producer/farm named (8) · Process stated (8) · Barista can discuss ratio & temperature (7) · Grinder visible & identifiable (6) · Roast date disclosed / in-house roast (6) · Flat-bottom brewer in rotation (5) · Manual brewing only (5) · Rare varietal on menu (4). Threshold default 65%.

## Appendix E — Hardware Datalists (seed)
Grinders: Mahlkönig EK43 · EK43S · EK Omnia · X54 · CORE 54mm · Ditting 807 · Ditting KR804 · Option-O Lagom P64 · P100 · DF64 Gen2 · DF83V · Timemore Sculptor 078 · 078S · Fellow Ode Gen2 · Comandante C40 · Kinu M47 · 1Zpresso ZP6 · Mazzer Major V · Mazzer MM · Anfim SP II · Niche Zero · VA Mythos MY85 · Weber EG-1.
Brewers: Hario V60 · Orea V4 · April · Kalita 155/185 · Origami (± wave filter) · Hario Switch · Hario Alpha · Deep27 · xBloom · Chemex · Stagg X · AeroPress · Clever · Flatbed · Batch · Espresso.
Varietals & processes: per v2 lists, incl. Eugenioides (pending milestone), mosto, EF2, koji.

## Appendix F — Codex Seed Entries (structure example)
```ts
{ id:'ek43', kind:'grinder', name:'Mahlkönig EK43', burr:'98 mm flat, cast steel',
  character:'Bimodal-but-low-fines; the clarity benchmark for filter service',
  note:'High-RPM single-dose shop standard; the archive's most-sighted unit. Uniformity keeps naturals clean (Beloya, Santuário) and preserves washed structure at volume.',
  sightingsComputedFrom:'master.grinder ~ /EK43(?!S)/' }
```
Codex ships with ≥ 12 grinder entries, ≥ 10 brewers, and the 6 Method doctrine cards (§3.7). All owner-doctrine cards must be written in his established voice and grounded in archive evidence only.

---
*End of golden source. Deviations require a DECISIONS.md entry. Build well — the owner will audit the app the way he audits a cup: hot, mid-cool, and at the finish.*
