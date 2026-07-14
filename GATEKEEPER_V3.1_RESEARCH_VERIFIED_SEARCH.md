# GATEKEEPER v3.1 — Research-Verified Search
### Architecture Amendment · Supersedes §4, §6, and §7 of GATEKEEPER_V3_ARCHITECTURE.md
**Status:** Approved — validated across 5 live test runs (Lavender, Chinatown, Raffles Place, Tanjong Pagar SG; Johor Bahru MY) before any code was written
**Applies to:** Module 3.1 (RADAR). All other modules (Gate, Wishlist, Portfolio, Vault, Audit, Codex, Intel, Settings) are unaffected and remain governed by the original document.

---

## 0. What Changed and Why

The original §4/§6/§7 design scored a café by asking one question: *does this place appear in Google's top-15 text-search results for this literal keyword phrase, city-wide?* Five live-fire tests during design review exposed this as unreliable and unexplainable:

1. **Concurrency collapse** — 9 parallel keyword searches against a single Google Cloud project produced 4 silent timeouts on the highest-value keywords.
2. **Invisible ground truth** — a real, proven, starred café (Fluid Collective) never appeared, with no way to tell whether it failed the criteria or simply never got queried.
3. **Address trust failure** — a single blog snippet placed Apartment Coffee on the wrong street; nothing in the original design would have caught this before showing it to the owner.
4. **No brand-to-outlet resolution** — Alchemist's CIMB Plaza outlet and Hong Leong Building outlet, 350m apart, have opposite pour-over profiles; a brand-level match would have conflated them.
5. **No way to explain a rejection** — Sunday Morning Coffee Shop (JB, 4.5★, 554 reviews) needed to be excluded on principle (house blend, not single-origin), and the original design had no mechanism to show that reasoning.

This amendment replaces the scoring engine with a **two-step, source-triangulated model**. Every failure mode above was specifically re-tested against the new model and passed (Appendix A).

---

## 1. The Two-Step Model

```
STEP 1 — RESEARCH                          STEP 2 — VERIFY
(asynchronous, Claude-assisted,             (live, in-app, automatic,
 zero Google API cost)                       bounded Google API cost)

Web/social search for the specific    →     Named candidates ONLY (never a
city + armed keyword combination            broad city sweep) resolved via
   ↓                                        Google Places: canonical address,
Named candidates + evidence,                coordinates, rating, review count,
tagged per concept, cited per source        and review-text corroboration
   ↓                                            ↓
Output: a Registry record                   Ground-truth check: does Google's
(JSON, versioned, cacheable)                own data agree or conflict with
                                             Step 1's claims?
                                                 ↓
                              COMBINE: confirmation-tiered, distance-filtered,
                              fully explainable ranked result
```

**Critical constraint (must be honored by any implementation):** Step 1 requires an LLM with live web search. The deployed client-only PWA (DR-1 of the original document) has no such capability and must not attempt to fake it. Step 1 is therefore **never** a runtime feature of the app — it is a **Research Session**, run by the owner asking Claude (this chat, or Claude Code) to research a city + keyword combination. The output is a data file, structurally identical to how `master.ts` is refreshed from a new CSV. Step 2 is the only step that runs live inside the deployed app, and it is Google-only, per the original DR-1.

---

## 2. Source Tier System

| Tier | Source | Trust weight | Independence rule |
|---|---|---|---|
| **0** | Owner's own field-audited archive (master data + on-device audits) | Highest — first-party | Self-sufficient; no corroboration required |
| **G** | Live Google Places review text, pulled during Step 2 | High — independent, real-time | Each distinct reviewer counts once; sampled (~5 reviews/place), so absence ≠ disconfirmation |
| **1** | Fresh web search performed *this* Research Session (blogs, Reddit, official café sites, local press) | Medium | Independent per unique domain/author. Two paragraphs from the same article are ONE source, not two |
| **2** | Prior AI-authored research (older Registry entries, previously uploaded guides) | Lead only | **Never counted toward confirmation on its own.** Must be corroborated by Tier G or a fresh Tier 1 source in the current session before it counts |

This tier system is the direct fix for the "stop relying on my research" instruction: Tier 2 material can seed a candidate list, but cannot, by itself, confirm a claim.

---

## 3. Confirmation Rule (normative)

For a candidate place *P* and an armed concept *C* (e.g. "pour over" — note V60/hand-brew/filter share one concept per the original Appendix C aliasing rule), let *S(P,C)* be the set of distinct evidence items found, each tagged with its tier.

```
confirmation_level(P, C) =
  CONFIRMED   if Tier 0 ∈ S(P,C)
              OR |{distinct tiers in S(P,C) excluding Tier 2}| ≥ 2
              OR |{distinct Tier-1 domains in S(P,C)}| ≥ 2

  TENTATIVE   if exactly one Tier-G or Tier-1 source exists, with no
              corroboration yet — OR Tier 2 alone (uncorroborated lead)

  CONFLICTED  if sources disagree (e.g. one confirms filter, another
              states "espresso-based coffee shop")

  UNCONFIRMED if no evidence of any tier was found
```

**Strict-mode pass condition** (default) for candidate *P* against armed concept set *K*:
```
PASS(P) ⟺ ∀ C ∈ K : confirmation_level(P, C) ∈ {CONFIRMED, TENTATIVE, CONFLICTED}
```
i.e. any concept that returns hard UNCONFIRMED excludes the candidate. CONFLICTED concepts still pass but render a ⚠️ badge, never a clean ✓, so the owner sees the disagreement rather than a false positive.

**Weighted/broad mode** (opt-in fallback when strict returns zero results): same base(P) formula as the original §4 (`Σ weight of CONFIRMED-or-better concepts / Σ armed weight`), with the original rating/depth bonuses and type penalty retained unchanged.

This directly implements the "narrow down" behavior requested: arming more keywords under strict mode can only shrink the result set, never grow it, and every exclusion is traceable to a specific concept that failed.

---

## 4. Step 2 — Verify (live implementation contract)

For each named candidate produced by the active Registry (never a broad discovery query):

```
POST https://places.googleapis.com/v1/places:searchText
{
  "textQuery": "<candidate name> <candidate area/city>",
  "maxResultCount": 1
}
FieldMask: places.id, places.displayName, places.formattedAddress,
           places.location, places.rating, places.userRatingCount,
           places.currentOpeningHours.openNow, places.primaryType,
           places.reviews
```

One call per candidate resolves **and** corroborates in the same round trip (reviews are returned inline, no separate Place Details call needed). This is the cost fix: a neighborhood Research Session with 15–30 registry candidates costs 15–30 calls, once, ever — not per search. Subsequent searches against the same cached Registry cost **zero** additional Google calls until the owner explicitly refreshes.

**Ground-truth override rule (the Apartment Coffee lesson, now codified):** the address/coordinates returned by this call are authoritative and **replace** whatever address Step 1 supplied. If Google's canonical location contradicts Step 1's claimed neighborhood (e.g. a different postal district entirely), the candidate is flagged `LOCATION_MISMATCH` and excluded from that Research Session's radius-filtered results, never silently kept.

**Distance filtering:** haversine (per original §7.6) computed from the *live, Step-2-verified* coordinates against the user's current position or typed area. Radius filtering happens **after** ground-truth resolution, never before.

---

## 5. Registry Data Schema

A Research Session produces a versioned JSON record per city/area:

```ts
interface RegistryEntry {
  candidateName: string;
  areaClaimed: string;          // as stated by Step 1 sources — advisory only
  concepts: {
    [concept: string]: {
      level: 'CONFIRMED' | 'TENTATIVE' | 'CONFLICTED' | 'UNCONFIRMED';
      evidence: { tier: 0 | 'G' | 1 | 2; source: string; quote: string; url?: string }[];
    };
  };
  researchedAt: string;         // ISO date — Registry entries are refreshable, not permanent
  sessionQuery: string;         // the city + keyword combination this was researched under
}
interface Registry {
  city: string;
  area: string;
  keywordSet: string[];
  entries: RegistryEntry[];
  generatedBy: 'claude-research-session';
  schemaVersion: 1;
}
```

Registries live alongside `master.ts` in `src/data/registry/{city-slug}.ts`, one file per researched area, regenerated the same way `master.ts` is regenerated from a new CSV — by asking Claude to run a new Research Session and hand over an updated file.

---

## 6. Decision Records (additions)

**DR-8 · Step 1 is never attempted at runtime by the deployed app.** Rationale: preserves DR-1 (client-only, zero backend) from the original document. A backend LLM proxy for live web research was considered and rejected — it would add real infrastructure and ongoing cost specifically to solve a problem (café discovery) that a periodic, owner-initiated Research Session solves for free.

**DR-9 · Tier 2 (prior AI research) is a lead source, never a confirming source.** Rationale: the four pre-existing Singapore guides in the owner's project are themselves AI-generated and unverified by the owner directly; treating them as independent of each other or of fresh research risks compounding a shared error (as very nearly happened with Apartment Coffee's address). This does not discard them — it demotes them to candidate generation only.

**DR-10 · Step 2 always overrides Step 1 on location.** Rationale: Google's own canonical place data is the only source in this system with a direct, structured, machine-checkable ground truth for "where is this, exactly." No web source is trusted for radius-filtering math.

**DR-11 · Strict mode is the default match mode, weighted mode is the fallback.** Rationale: the owner's explicit intent ("narrow down the results") maps to AND-composition of confirmed concepts, not a weighted OR blend. Weighted mode remains available for when strict mode returns nothing, surfaced explicitly as a relaxed search rather than a silent behavior change.

---

## 7. Updated System Architecture (Radar module only)

```
┌── Research Session (Claude, on request, offline from the app) ──┐
│  web_search → named candidates → evidence tagged per concept    │
│  → Registry JSON handed to owner → committed to repo            │
└───────────────────────────┬───────────────────────────────────┘
                             │ (file, not a runtime call)
┌────────────────────────────▼────────────────────────────────────┐
│                    Gatekeeper App — Radar Module                 │
│  1. Load active Registry for selected area (bundled or imported) │
│  2. User arms keyword subset (must be ⊆ Registry's keywordSet    │
│     to remain valid, else prompt to re-research)                 │
│  3. Step 2: one Places call per Registry candidate (bounded,     │
│     cached 15 min per identical candidate set)                   │
│  4. Ground-truth resolve → haversine filter by radius            │
│  5. Apply confirmation_level() per concept, per candidate        │
│  6. Strict-mode filter → sort by distance → render with          │
│     tap-to-evidence badges, ⚠️ conflict flags shown inline,       │
│     UNCONFIRMED-excluded candidates listed in a collapsed         │
│     "Not shortlisted" section for transparency, never hidden      │
└────────────────────────────────────────────────────────────────┘
```

---

## 8. Explainability UI Requirements (new, binding)

- Every badge on a result card must be tappable, revealing tier, source name, and the exact quote.
- Every concept that failed must be visibly ✗, not merely absent from a badge row — omission reads as "unknown," a hard ✗ must read as "checked, not found."
- Rejected candidates that were considered are shown in a dismissible "Not Shortlisted" list with their specific failing concept named — never silently dropped, per the Sunday Morning / Baristart precedent.
- A `LOCATION_MISMATCH` flag renders distinctly from a normal exclusion, so the owner can tell "wrong data" apart from "doesn't meet criteria."

---

## 9. Cost Model (revised)

- Step 1: **$0** Google cost, ever — it's web search, run by Claude.
- Step 2: **1 call per Registry candidate**, once per Registry refresh. A dense neighborhood Registry (~20–30 candidates) costs ~20–30 calls total, then **zero** for every subsequent search against it within the cache window, and near-zero (occasional re-verify) after.
- This is a reduction from the original design's 9-parallel-keyword-searches-per-search-event model, which cost 9 calls **every single time** the owner searched.

---

## 10. Updated Acceptance Criteria (append to original §16)

11. A Research Session output (Registry JSON) loaded into the app produces results where every shown badge is tappable to its source quote.
12. Changing the search radius never changes a candidate's confirmation levels — only its inclusion/exclusion.
13. A candidate with a Step-1-claimed address that Google's Step 2 lookup contradicts is flagged `LOCATION_MISMATCH`, never silently relocated or silently dropped.
14. Arming an additional keyword under strict mode never increases the result count versus the same search with that keyword unarmed.
15. The five Appendix A regression fixtures reproduce their documented results exactly.

---

## Appendix A — Regression Fixtures (live-validated before implementation)

| City / Area | Radius | Keywords | Expected pass set (ordered) | Notable exclusion |
|---|---|---|---|---|
| Lavender, SG | 2 km | specialty, pour over, single origin, V60 | KerYi Coffee, Asylum Coffeehouse, Apartment Coffee, CSHH (⚠️ conflicted) | Zerah — excluded by radius, not criteria |
| Chinatown, SG | — | same | Kurasu (Telok Ayer) | September Coffee — brunch-fusion, weak fit |
| Raffles Place, SG | 3 km | same | Alchemist (Hong Leong Bldg), Kurasu (Waterloo St), Kurasu (Grange Rd) | Alchemist (CIMB Plaza) — same brand, UNCONFIRMED pour-over |
| Tanjong Pagar, SG | 1 km | same | Equate Coffee (⚠️ Tier-0-only), Corner Corner, Nylon Coffee Roasters | Baristart Coffee — Tier-1 claim uncorroborated by 1,708 live reviews |
| Johor Bahru, MY | — | same | Sweet Blossom Coffee Roasters, Clod Coffee Bar & Roasters | Sunday Morning Coffee Shop — 4.5★/554 reviews, correctly excluded (house blend, not single-origin) |

These five cases are the minimum regression suite (§13 of the original document) for the Radar module going forward. Any refactor of the scoring engine must reproduce all five before merge.

---
*This amendment supersedes conflicting text in §4, §6, and §7 of GATEKEEPER_V3_ARCHITECTURE.md. All other sections of the original document remain in force.*
