import { haversineM } from './places';
import { GEM_LEXICON, GENERIC_LEXICON } from '../data/gem-lexicon';
import { getScan, setScan } from './store';

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.primaryType,places.types,places.reviews,places.websiteUri';

interface RawPlace { id: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number }; rating?: number; userRatingCount?: number; currentOpeningHours?: { openNow?: boolean }; primaryType?: string; types?: string[]; reviews?: { text?: { text: string } }[]; websiteUri?: string }

export interface MatchedKeyword { word: string; score: number; source: 'review' | 'menu'; snippet?: string; }

export interface ScoreBreakdown {
  base: number;
  lexiconScore: number;
  ratingBonus: number;
  depthBonus: number;
  typeScore: number;
  evidenceScore: number;
  coffeeMention: number;
  nameBonus: number;
  totalBeforeCap: number;
  matchedKeywords: MatchedKeyword[];
}

export type EvidenceTier = 'T0' | 'T1' | 'T2' | 'T3' | 'UNVERIFIED';

export interface LiveResult {
  placeId: string; name: string; address: string; lat: number; lng: number;
  rating: number | null; reviews: number; openNow: boolean | null; primaryType: string;
  score: number; matched: string[]; distanceM: number; foodHeavy: boolean;
  tier: EvidenceTier;
  tierBadge: string;
  tierReason: string | null;
  rawReviews: string[];
  websiteUri?: string;
  scoreBreakdown: ScoreBreakdown;
  originLat: number | null;
  originLng: number | null;
  verdict?: 'REJECT' | 'APPROVE';
}

export interface ArchiveRow { Cafe_Name: string; Grinder?: string; Origin?: string; Process?: string; Brew_Method?: string; Varietal?: string; star?: boolean; }
export interface LiveSearchOpts { apiKey: string; areaText: string; radiusM: number; keywords: string[]; lat: number | null; lng: number | null; filterCoffeeRequired?: boolean; archive: ArchiveRow[]; verdicts?: Record<string, any>; }
export interface LiveSearchOutcome { results: LiveResult[]; failedKeywords: string[]; requestCount: number; dnaKeywords: string[] }

export class PlacesError extends Error {
  constructor(public kind: 'KEY_MISSING'|'KEY_INVALID'|'KEY_REFERRER'|'QUOTA'|'NET', msg: string) { super(msg); }
}

export const COFFEE_WORDS = /\b(coffee|espresso|latte|flat white|barista|brew|beans?|roast|cappuccino|long black|americano|mocha|cuppa|kopi)\b/i;

export function coffeeMentionScore(reviews: string[]): number {
  if (reviews.length === 0) return 0;
  const hits = reviews.filter(r => COFFEE_WORDS.test(r)).length;
  const ratio = hits / reviews.length;
  if (ratio === 0)   return -0.25;
  if (ratio < 0.4)   return -0.10;
  if (ratio >= 0.8)  return +0.15;
  return +0.05;
}

export function computeLexiconScore(reviews: string[]): number {
  if (reviews.length === 0) return 0;
  const combined = reviews.join(' ').toLowerCase();
  
  let gemHits = 0;
  for (const token of GEM_LEXICON) {
    if (combined.includes(token)) gemHits++;
  }
  let genericHits = 0;
  for (const token of GENERIC_LEXICON) {
    if (combined.includes(token)) genericHits++;
  }
  
  if (gemHits === 0 && genericHits === 0) return 0;
  
  const ratio = (gemHits - genericHits) / (gemHits + genericHits + 5);
  // Cap between -0.15 and 0.20
  return Math.max(-0.15, Math.min(0.20, ratio * 0.3));
}

export function circleToRect(lat: number, lng: number, radiusM: number) {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos(lat * Math.PI / 180));
  return {
    low:  { latitude: lat - dLat, longitude: lng - dLng },
    high: { latitude: lat + dLat, longitude: lng + dLng },
  };
}

async function callSearch(apiKey: string, textQuery: string, signal: AbortSignal, restriction?: { lat: number; lng: number; radiusM: number }, maxResultCount = 20): Promise<RawPlace[]> {
  const payload: any = { textQuery, maxResultCount };
  if (restriction) {
    payload.locationRestriction = {
      rectangle: circleToRect(restriction.lat, restriction.lng, restriction.radiusM),
    };
  }
  
  const res = await fetch(ENDPOINT, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
    body: JSON.stringify(payload),
  });
  if (res.status === 403) { const t = await res.text(); throw new PlacesError(/referer|referrer/i.test(t) ? 'KEY_REFERRER' : 'KEY_INVALID', t.slice(0, 200)); }
  if (res.status === 429) throw new PlacesError('QUOTA', 'Quota exceeded');
  if (res.status === 400 || res.status === 401) throw new PlacesError('KEY_INVALID', await res.text().then(t => t.slice(0, 200)));
  if (!res.ok) throw new PlacesError('NET', `HTTP ${res.status}`);
  const j = await res.json();
  return (j.places ?? []) as RawPlace[];
}

const DNA_STOP = new Set([
  'flat', 'white', 'natural', 'light', 'medium', 'dark', 'burr', 'coffee',
  'roast', 'roaster', 'blend', 'brew', 'unknown', 'series', 'hand', '—'
]);

export function tokenizeDna(raw: string): string[] {
  return raw.toLowerCase()
    .replace(/[()\/,+&]/g, ' ')
    .split(/\s+/)
    .map(t => t.replace(/[^a-z0-9ö]/g, ''))
    .filter(t => t.length >= 4 || /\d/.test(t))
    .filter(t => !DNA_STOP.has(t))
    .filter(t => !/^\d+mm$/.test(t) && !/^\d+g$/.test(t));
}

export function extractDna(archive: ArchiveRow[], topN = 4): string[] {
  const counts = new Map<string, number>();
  for (const m of archive) {
    for (const field of [m.Grinder, m.Origin, m.Process, m.Varietal, m.Brew_Method]) {
      if (!field || field === 'Unknown' || field === '—') continue;
      for (const tok of new Set(tokenizeDna(field)))
        counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN * 3)
    .map(([t]) => t);
}

export function extractContextualMatches(text: string, keywords: string[]): { word: string, snippet: string }[] {
  const matches: { word: string, snippet: string }[] = [];
  const lowerText = text.toLowerCase();
  
  for (const kw of keywords) {
    const isAmbiguous = ['filter', 'natural', 'washed', 'honey'].includes(kw);
    const isBoundaryNeeded = ['masl'].includes(kw) || isAmbiguous;
    
    let matchIdx = -1;
    
    if (isAmbiguous) {
      const contextRegex = new RegExp(`\\b(coffee|roast|beans|brew|cup|menu|v60|pourover|specialty|process)\\W+(?:\\w+\\W+){0,6}${kw}\\b|\\b${kw}\\W+(?:\\w+\\W+){0,6}(coffee|roast|beans|brew|cup|menu|v60|pourover|specialty|process)\\b`, 'i');
      
      let isValid = contextRegex.test(text);
      if (kw === 'filter' && isValid) {
        if (/\bfilter(ed)? water\b/i.test(text) || /\bfilter(ing)? (something )?out\b/i.test(text)) {
          isValid = false;
        }
      }
      
      if (isValid) {
        const m = text.match(contextRegex);
        if (m) matchIdx = m.index!;
      }
    } else if (isBoundaryNeeded) {
      const m = text.match(new RegExp(`\\b${kw}\\b`, 'i'));
      if (m) matchIdx = m.index!;
    } else {
      matchIdx = lowerText.indexOf(kw.toLowerCase());
    }

    if (matchIdx !== -1) {
      const start = Math.max(0, matchIdx - 40);
      const end = Math.min(text.length, matchIdx + kw.length + 40);
      let snippet = text.slice(start, end).replace(/\s+/g, ' ').trim();
      if (start > 0) snippet = '...' + snippet;
      if (end < text.length) snippet = snippet + '...';
      matches.push({ word: kw, snippet });
    }
  }
  return matches;
}

export function scorePlace(raw: RawPlace, matched: string[], opts: {
  evidenceKeywords: string[]; archive: ArchiveRow[]; totalWeight: number;
  filterCoffeeRequired: boolean; originLat: number|null; originLng: number|null;
  verdicts?: Record<string, any>;
}): LiveResult | null {
  const normName = raw.displayName?.text?.toLowerCase() || '';
  const rawReviews = raw.reviews?.map(r => r.text?.text ?? '').filter(Boolean) ?? [];
  const coffeeMention = coffeeMentionScore(rawReviews);

  let tier: EvidenceTier = 'UNVERIFIED';
  let tierBadge = 'Unverified';
  let tierReason: string | null = null;
  let evidenceScore = 0;
  const matchedKws: MatchedKeyword[] = [];

  // T0: Master Audit Log
  const archived = opts.archive.find(m => m.Cafe_Name && (normName.includes(m.Cafe_Name.toLowerCase()) || m.Cafe_Name.toLowerCase().includes(normName)));
  if (archived) {
    tier = 'T0';
    tierBadge = '⭐ Personally Audited';
    tierReason = `Found in your master archive`;
    evidenceScore = archived.star ? 0.55 : 0.45;
    matchedKws.push({ word: "Master Audit Log", score: evidenceScore, source: 'review' });
  }
  
  const verdict = opts.verdicts?.[raw.id]?.verdict;
  if (verdict === 'APPROVE') {
    if (tier !== 'T0') {
      tier = 'T0';
      tierBadge = '👍 Confirmed Gem';
      tierReason = 'Manually approved by you';
    }
    evidenceScore = Math.max(evidenceScore, 0.40);
    matchedKws.push({ word: "Manual Approval", score: 0.40, source: 'review' });
  }

  // T2/T3: Review and Roaster Scan
  if (tier === 'UNVERIFIED' && rawReviews.length > 0) {
    const combinedText = rawReviews.join(' ').toLowerCase();
    const ctxMatches = extractContextualMatches(combinedText, opts.evidenceKeywords);
    
    for (const { word: kw, snippet } of ctxMatches) {
      const scoreBump = matchedKws.length === 0 ? 0.25 : 0.10;
      if (evidenceScore < 0.40) {
        const actualBump = Math.min(scoreBump, 0.40 - evidenceScore);
        evidenceScore += actualBump;
        const isDna = !['pour over', 'pourover', 'v60', 'filter', 'batch brew', 'hand brew', 'chemex', 'origami', 'aeropress', 'flat burr', 'masl', 'roasted in house'].includes(kw);
        matchedKws.push({ word: isDna ? `${kw} (Palate DNA)` : kw, score: actualBump, source: 'review', snippet });
      } else {
        matchedKws.push({ word: kw, score: 0, source: 'review', snippet });
      }
    }
    if (matchedKws.length > 0) {
      tier = 'T2';
      tierBadge = '✔ Review-Verified';
      tierReason = `Found keywords: ${matchedKws.map(m => m.word).join(', ')}`;
    }
  }

  // T3 fallback
  const coffeeMentionRatio = rawReviews.length > 0 ? rawReviews.filter(r => COFFEE_WORDS.test(r)).length / rawReviews.length : 0;
  if (tier === 'UNVERIFIED' && coffeeMentionRatio >= 0.4) {
    if (normName.includes('roaster') || raw.primaryType === 'coffee_roastery') {
      tier = 'T3';
      tierBadge = '🔥 Roaster (inferred)';
      tierReason = "Coffee Roastery + High coffee review focus";
      evidenceScore = 0.25;
    } else if (normName.includes('specialty coffee')) {
      tier = 'T3';
      tierBadge = '🔥 Roaster (inferred)';
      tierReason = '"Specialty coffee" in name + High coffee review focus';
      evidenceScore = 0.25;
    }
  }
  
  if (tier === 'UNVERIFIED' && opts.filterCoffeeRequired) evidenceScore = -0.20;
  if (opts.filterCoffeeRequired && matched.length === 0 && tier === 'UNVERIFIED') return null;
  
  const rating = raw.rating ?? null, n = raw.userRatingCount ?? 0;
  let ratingBonus = 0;
  if (rating !== null) {
    const adj = (rating * n + 4.2 * 25) / (n + 25);
    if (adj >= 4.5) ratingBonus = 0.06;
    else if (adj >= 4.3) ratingBonus = 0.03;
    else if (adj < 4.0) ratingBonus = -0.10;
  }

  let depthBonus = 0;
  if (n >= 300) depthBonus = 0.04; else if (n >= 100) depthBonus = 0.02;
  
  const NIGHTLIFE = ['bar', 'night_club', 'pub', 'wine_bar', 'liquor_store'];
  const DESSERT   = ['dessert_shop', 'ice_cream_shop', 'bakery', 'cake_shop', 'chocolate_shop'];
  
  const foodTypes = ['restaurant', 'bakery', 'meal_takeaway', 'meal_delivery'];
  const foodHeavy = raw.primaryType ? foodTypes.includes(raw.primaryType) : (raw.types?.some(t => foodTypes.includes(t)) || false);
  const strictCoffee = raw.primaryType === 'coffee_shop' || raw.primaryType === 'coffee_roastery';
  
  const allTypes = [raw.primaryType, ...(raw.types ?? [])].filter(Boolean) as string[];
  let typeScore = 0;
  if (allTypes.some(t => NIGHTLIFE.includes(t)))      typeScore = -0.25;
  else if (foodHeavy || allTypes.some(t => DESSERT.includes(t))) typeScore = -0.15;
  else if (strictCoffee)                              typeScore = 0.10;
  
  let nameBonus = 0;
  if (/roast|brew|pour|drip|% ?arabica|coffee/i.test(normName)) nameBonus = 0.05;

  const lexiconScoreVal = computeLexiconScore(rawReviews);

  const base = Math.min(1, matched.length / opts.totalWeight) * 0.25;
  const totalBeforeCap = base + ratingBonus + depthBonus + typeScore + evidenceScore + coffeeMention + nameBonus + lexiconScoreVal;
  const score = Math.max(0, Math.min(1, totalBeforeCap));
  const scoreBreakdown = { base, lexiconScore: lexiconScoreVal, ratingBonus, depthBonus, typeScore, evidenceScore, coffeeMention, nameBonus, totalBeforeCap, matchedKeywords: matchedKws };
  
  const lat = raw.location?.latitude ?? opts.originLat ?? 0, lng = raw.location?.longitude ?? opts.originLng ?? 0;
  const distanceM = (opts.originLat !== null && opts.originLng !== null) ? haversineM(opts.originLat, opts.originLng, lat, lng) : 0;
  
  return {
    placeId: raw.id, name: raw.displayName?.text ?? 'Unnamed', address: raw.formattedAddress ?? '',
    lat, lng, rating, reviews: n, openNow: raw.currentOpeningHours?.openNow ?? null,
    primaryType: raw.primaryType ?? '', score: Math.round(score * 100), matched, distanceM, foodHeavy,
    tier, tierBadge, tierReason, rawReviews, websiteUri: raw.websiteUri, scoreBreakdown, originLat: opts.originLat, originLng: opts.originLng,
    verdict
  };
}

export async function liveAreaSearch(o: LiveSearchOpts): Promise<LiveSearchOutcome> {
  if (!o.apiKey) throw new PlacesError('KEY_MISSING', 'No API key configured');
  const kws = [...new Set(o.keywords.map(k => k.trim()).filter(Boolean))];
  const area = o.areaText.trim();
  const queries = kws.map(k => {
    const q = /coffee|cafe|roaster/i.test(k) ? k : `${k} coffee`;
    return area ? `${q} in ${area}` : q;
  });
  
  if (area && !kws.some(k => k.toLowerCase().includes('specialty coffee'))) {
    queries.push(`specialty coffee in ${area}`);
  }
  
  const totalWeight = queries.length || 1;

  const failed: string[] = []; let requestCount = 0;
  const perKw: (RawPlace[] | null)[] = new Array(queries.length).fill(null);

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 12000);
  
  let originLat = o.lat, originLng = o.lng;
  let lastError: unknown = null;

  try {
    if (area && (originLat === null || originLng === null)) {
      const AREA_TYPES = ['locality', 'sublocality', 'sublocality_level_1',
        'neighborhood', 'administrative_area_level_1', 'administrative_area_level_2',
        'postal_town', 'route', 'shopping_mall', 'transit_station', 'subway_station'];
      
      const geoPlaces = await callSearch(o.apiKey, area, controller.signal, undefined, 5);
      requestCount++;
      const best = geoPlaces.find(p => p.types?.some(t => AREA_TYPES.includes(t))) ?? geoPlaces[0];
      if (best?.location) {
        originLat = best.location.latitude;
        originLng = best.location.longitude;
      }
    }

    const restriction = (originLat !== null && originLng !== null && o.radiusM) 
      ? { lat: originLat, lng: originLng, radiusM: o.radiusM } 
      : undefined;

    const chunk = 4;
    for (let i = 0; i < queries.length; i += chunk) {
      const batch = queries.slice(i, i + chunk).map((q, idx) => 
        callSearch(o.apiKey, q, controller.signal, restriction).then(p => { perKw[i + idx] = p; requestCount++; })
          .catch(e => { failed.push(q); lastError = e; console.error(`Failed ${q}:`, e); })
      );
      await Promise.all(batch);
    }
  } finally { clearTimeout(to); }

  const map = new Map<string, { raw: RawPlace; matched: string[] }>();
  perKw.forEach((places, idx) => {
    if (!places) return;
    const kw = kws[idx] ?? 'specialty coffee';
    for (const p of places) {
      if (!map.has(p.id)) map.set(p.id, { raw: p, matched: [] });
      const e = map.get(p.id)!;
      if (!e.matched.includes(kw)) e.matched.push(kw);
    }
  });

  if (map.size === 0 && failed.length === queries.length && lastError instanceof PlacesError) {
    throw lastError;
  }

  const dnaKeywords = extractDna(o.archive);
  const evidenceKeywords = [
    ...new Set(["pour over", "pourover", "v60", "filter", "batch brew", "hand brew", "chemex", "origami", "aeropress", "flat burr", "masl", "roasted in house", ...dnaKeywords])
  ];
  
  const out: LiveResult[] = [];
  for (const { raw, matched } of map.values()) {
    const result = scorePlace(raw, matched, {
      evidenceKeywords, archive: o.archive, totalWeight, 
      filterCoffeeRequired: o.filterCoffeeRequired || false, originLat, originLng, verdicts: o.verdicts
    });
    if (result) out.push(result);
  }

  const filtered = out.filter(r => (originLat === null || originLng === null) ? true : r.distanceM <= o.radiusM);
  filtered.sort(sortLiveResults);
  return { results: filtered, failedKeywords: failed, requestCount, dnaKeywords };
}

export function sortLiveResults(a: LiveResult, b: LiveResult) {
  // Blocked places go at the absolute bottom
  if (a.verdict === 'REJECT' && b.verdict !== 'REJECT') return 1;
  if (b.verdict === 'REJECT' && a.verdict !== 'REJECT') return -1;
  
  const tierRank = { 'T0': 0, 'T1': 1, 'T2': 2, 'T3': 3, 'UNVERIFIED': 4 };
  const tierA = tierRank[a.tier];
  const tierB = tierRank[b.tier];
  if (tierA !== tierB) return tierA - tierB;
  if (b.score !== a.score) return b.score - a.score;
  return a.distanceM - b.distanceM;
}

export const menuEvidenceKeywords = ['v60', 'kalita', 'origami', 'orea', 'april', 'chemex', 'pour over', 'pourover', 'hand brew', 'filter', 'single origin', 'gesha', 'geisha', 'anaerobic', 'washed', 'natural', 'honey', 'roast date', 'roasted in house', 'brew bar', 'manual brew', 'slow bar'];

export async function upgradeT1(results: LiveResult[]): Promise<LiveResult[]> {
  const verified = results.filter(r => r.tier !== 'T0' && r.tier !== 'UNVERIFIED' && r.websiteUri).slice(0, 6);
  const unverified = results.filter(r => r.tier === 'UNVERIFIED' && r.websiteUri).slice(0, 4);
  const candidates = [...verified, ...unverified];
  if (candidates.length === 0) return results;

  const upgraded = [...results];
  let changed = false;

  await Promise.all(candidates.map(async (c) => {
    try {
      const cache = await getScan(c.placeId);
      let text = '';
      if (cache && Date.now() - cache.ts < 30 * 24 * 60 * 60 * 1000) {
        text = cache.text;
      } else {
        const res = await fetch(`/.netlify/functions/scan?url=${encodeURIComponent(c.websiteUri!)}`);
        if (res.status === 200) {
          text = await res.text();
          await setScan(c.placeId, text);
        }
      }

      if (text) {
        // Strip out HTML tags for accurate context matching
        const cleanText = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        const menuMatches = extractContextualMatches(cleanText, menuEvidenceKeywords);
        
        if (menuMatches.length > 0) {
          const idx = upgraded.findIndex(r => r.placeId === c.placeId);
          if (idx !== -1) {
            const old = upgraded[idx];
            
            // Coherence Gate: Requires coffee mention >= 0.4 or positive lexicon
            const ratio = old.rawReviews.length > 0
              ? old.rawReviews.filter(r => COFFEE_WORDS.test(r)).length / old.rawReviews.length 
              : null;
            const passedCoherence = ratio === null ? true : ratio >= 0.4 || old.scoreBreakdown.lexiconScore > 0;
            
            if (passedCoherence) {
              const oldScore = old.scoreBreakdown.evidenceScore;
              
              // Count unique words
              const uniqueWords = new Set(menuMatches.map(m => m.word));
              const isT1 = uniqueWords.size >= 2;
              
              const newEvidenceScore = isT1 ? 0.50 : 0.30;
              
              if (newEvidenceScore > oldScore) {
                const newScoreBreakdown = {
                  ...old.scoreBreakdown,
                  evidenceScore: newEvidenceScore,
                  totalBeforeCap: old.scoreBreakdown.totalBeforeCap - oldScore + newEvidenceScore,
                  matchedKeywords: [
                    ...old.scoreBreakdown.matchedKeywords,
                    ...menuMatches.map(m => ({ word: m.word, score: 0, source: 'menu' as const, snippet: m.snippet }))
                  ]
                };
                
                const finalScore = Math.max(0, Math.min(1, newScoreBreakdown.totalBeforeCap));
                upgraded[idx] = {
                  ...old,
                  tier: isT1 ? 'T1' : 'T2',
                  tierBadge: isT1 ? '📜 Menu-Verified' : '📄 Menu Hint',
                  tierReason: `Menu lists: ${[...uniqueWords].join(', ')}`,
                  score: Math.round(finalScore * 100),
                  scoreBreakdown: newScoreBreakdown
                };
                changed = true;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Scan failed for', c.websiteUri, e);
    }
  }));

  if (changed) {
    upgraded.sort(sortLiveResults);
  }
  return upgraded;
}
