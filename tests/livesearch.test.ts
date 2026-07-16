import { describe, it, expect } from 'vitest';
import { circleToRect, tokenizeDna, scorePlace, sortLiveResults, extractContextualMatches, menuEvidenceKeywords, upgradeT1, type LiveResult } from '../src/services/livesearch';
import { vi } from 'vitest';
import { getScan } from '../src/services/store';

vi.mock('../src/services/store', () => ({
  getScan: vi.fn(),
  setScan: vi.fn(),
}));
import fs from 'fs';
import path from 'path';
// Note: test scans can be done via upgradeT1, but since it relies on indexDB and fetch, it might be tricky to test here without mocking.
// We will test scorePlace tiers and shrinkage here.

describe('circleToRect', () => {
  it('at equator, 3000m -> dLat roughly 0.02695', () => {
    const rect = circleToRect(0, 0, 3000);
    expect(rect.high.latitude).toBeCloseTo(0.02695, 4);
    expect(rect.high.longitude).toBeCloseTo(0.02695, 4);
  });
  
  it('at lat 60, dLng is 2x dLat', () => {
    const rect = circleToRect(60, 0, 3000);
    const dLat = rect.high.latitude - 60;
    const dLng = rect.high.longitude;
    expect(dLng / dLat).toBeCloseTo(2, 1);
  });
});

describe('tokenizeDna', () => {
  it('Mahlkönig EK43 (98mm Flat) -> contains ek43, excludes flat and 98mm', () => {
    const tokens = tokenizeDna('Mahlkönig EK43 (98mm Flat)');
    expect(tokens).toContain('ek43');
    expect(tokens).not.toContain('flat');
    expect(tokens).not.toContain('98mm');
  });

  it('Colombia, Huila -> colombia, huila', () => {
    const tokens = tokenizeDna('Colombia, Huila');
    expect(tokens).toEqual(['colombia', 'huila']);
  });

  it('Washed -> washed, Natural -> empty (stoplisted)', () => {
    expect(tokenizeDna('Washed')).toEqual(['washed']);
    expect(tokenizeDna('Natural')).toEqual([]);
  });
});

describe('scorePlace - V8 Tiers & Shrinkage', () => {
  const baseOpts = {
    evidenceKeywords: ['filter', 'v60', 'pourover', 'chemex', 'aeropress', 'masl'],
    archive: [],
    totalWeight: 1,
    filterCoffeeRequired: false,
    originLat: 0,
    originLng: 0
  };

  it('assigns T0 when in archive', () => {
    const raw = { id: '1', displayName: { text: 'Oaks Coffee' } };
    const place = scorePlace(raw, [], {
      ...baseOpts,
      archive: [{ Cafe_Name: 'Oaks Coffee' }]
    });
    expect(place?.tier).toBe('T0');
    expect(place?.tierBadge).toContain('Personally Audited');
    expect(place?.scoreBreakdown.evidenceScore).toBe(0.45);
  });

  it('assigns T2 when keywords found in reviews', () => {
    const raw = {
      id: '1', displayName: { text: 'Cafe' },
      reviews: [{ text: { text: 'filter v60 pourover chemex aeropress masl' } }]
    };
    const place = scorePlace(raw, [], baseOpts);
    expect(place?.tier).toBe('T2');
    expect(place?.tierBadge).toContain('Review-Verified');
  });

  it('assigns UNVERIFIED when filterCoffeeRequired is true and zero evidence', () => {
    const raw = { id: '1', displayName: { text: 'Cafe' } };
    const place = scorePlace(raw, [], { ...baseOpts, filterCoffeeRequired: true });
    expect(place).toBeNull(); // it drops it if no match and unverified
  });

  it('rating shrinkage: adj = (rating*n + 4.2*25)/(n+25)', () => {
    // 5.0 with 1 review: adj = (5 + 105) / 26 = 110 / 26 = 4.23 -> no bonus
    const raw1 = { id: '1', displayName: { text: 'Cafe' }, rating: 5.0, userRatingCount: 1 };
    const place1 = scorePlace(raw1, [], baseOpts);
    expect(place1?.scoreBreakdown.ratingBonus).toBe(0);

    // 4.6 with 100 reviews: adj = (460 + 105) / 125 = 565 / 125 = 4.52 -> +0.06
    const raw2 = { id: '2', displayName: { text: 'Cafe' }, rating: 4.6, userRatingCount: 100 };
    const place2 = scorePlace(raw2, [], baseOpts);
    expect(place2?.scoreBreakdown.ratingBonus).toBe(0.06);

    // 3.5 with 100 reviews: adj = (350 + 105) / 125 = 455 / 125 = 3.64 -> -0.10 penalty
    const raw3 = { id: '3', displayName: { text: 'Cafe' }, rating: 3.5, userRatingCount: 100 };
    const place3 = scorePlace(raw3, [], baseOpts);
    expect(place3?.scoreBreakdown.ratingBonus).toBe(-0.10);
  });

  it('two tier sorting: verified roaster beats cocktail bar regardless of distance', () => {
    const cocktailBar = scorePlace(
      { id: 'bar', displayName: { text: 'Bar' }, types: ['bar'], location: { latitude: 0, longitude: 0 }, reviews: [{text: {text: 'great cocktails'}}] },
      [],
      { ...baseOpts, originLat: 0, originLng: 0 }
    )!;

    const roaster = scorePlace(
      { id: 'roaster', displayName: { text: 'Roaster' }, primaryType: 'coffee_roastery', location: { latitude: 0.1, longitude: 0.1 }, reviews: [{text: {text: 'good coffee'}}] }, // further away
      [],
      { ...baseOpts, originLat: 0, originLng: 0 }
    )!;
    
    const results = [cocktailBar, roaster];
    results.sort(sortLiveResults);

    expect(results[0].placeId).toBe('roaster');
    expect(results[1].placeId).toBe('bar');
  });

  it('T3 fallback for roastery with coffee mention', () => {
    const raw = { id: '1', displayName: { text: 'Roaster' }, primaryType: 'coffee_roastery', reviews: [{text: {text: 'good coffee'}}] };
    const place = scorePlace(raw, [], baseOpts);
    expect(place?.tier).toBe('T3');
    expect(place?.tierBadge).toContain('Roaster (inferred)');
  });
});

describe('Contextual Match & Menu Evidence Scanner', () => {
  it('detects specialty coffee menu keywords in cafe HTML', () => {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'cafe-menu.html'), 'utf-8');
    const cleanText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const matches = extractContextualMatches(cleanText, menuEvidenceKeywords);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.map(m => m.word).includes('filter')).toBe(true);
  });

  it('yields zero evidence for nightclub HTML', () => {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'nightclub.html'), 'utf-8');
    const cleanText = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const matches = extractContextualMatches(cleanText, menuEvidenceKeywords);
    expect(matches.length).toBe(0);
  });
  
  it('contextualMatch returns identical results for review path and menu path (guards against drift)', () => {
    const text = "we serve great natural process coffee";
    const reviewMatches = extractContextualMatches(text, ['natural']);
    const menuMatches = extractContextualMatches(text, ['natural']);
    expect(reviewMatches).toEqual(menuMatches);
    expect(reviewMatches.length).toBe(1);
    expect(reviewMatches[0].word).toBe('natural');
  });
  
  it('natural ingredients does not match but natural coffee does', () => {
    expect(extractContextualMatches('100% natural ingredients', ['natural']).length).toBe(0);
    expect(extractContextualMatches('natural coffee beans', ['natural']).length).toBe(1);
  });
});

describe('Sorting and Verdicts', () => {
  it('blocked placeId sorts below everything regardless of score', () => {
    const blocked: LiveResult = { placeId: 'b', score: 99, verdict: 'REJECT', tier: 'T1', distanceM: 10 } as any;
    const regular: LiveResult = { placeId: 'r', score: 50, tier: 'T2', distanceM: 20 } as any;
    const unverified: LiveResult = { placeId: 'u', score: 20, tier: 'UNVERIFIED', distanceM: 5 } as any;
    
    const arr = [blocked, regular, unverified];
    arr.sort(sortLiveResults);
    
    expect(arr[0].placeId).toBe('r'); // T2 beats blocked
    expect(arr[1].placeId).toBe('u'); // Unverified beats blocked
    expect(arr[2].placeId).toBe('b'); // Blocked is absolute bottom
  });
});

describe('V7 Regression Guards', () => {
  const baseOpts = {
    evidenceKeywords: ['filter', 'v60', 'pourover', 'chemex', 'aeropress', 'masl'],
    archive: [],
    totalWeight: 1,
    filterCoffeeRequired: false,
    originLat: 0,
    originLng: 0
  };

  it('payload must never contain circle', () => {
    const rect = circleToRect(1.35, 103.8, 3000);
    const json = JSON.stringify({ locationRestriction: { rectangle: rect } });
    expect(json).not.toContain('"circle"');
    expect(json).toContain('"rectangle"');
  });

  it('filtered water review does NOT match word-boundary filter', () => {
    const raw = {
      id: '1', displayName: { text: 'Cafe' },
      reviews: [{ text: { text: 'they use filtered water' } }]
    };
    const place = scorePlace(raw, [], baseOpts);
    expect(place?.scoreBreakdown.evidenceScore).toBe(0);
  });

  it('base never exceeds 1.0 even when matched includes the auto-appended query', () => {
    const rawCafe = { id: '1', displayName: { text: 'Cafe' } };
    const place = scorePlace(rawCafe, ['pour over', 'filter', 'specialty coffee'], { ...baseOpts, totalWeight: 3 });
    expect(place!.scoreBreakdown.base).toBeLessThanOrEqual(1.0);
  });

  it('radius filter integration: distanceM uses originLat/originLng, not null', () => {
    // A place in Tokyo (approx 35.68, 139.76)
    const raw = {
      id: '1', displayName: { text: 'Cafe' },
      location: { latitude: 35.68, longitude: 139.76 }
    };
    // originLat/originLng in Kyoto (approx 35.01, 135.76)
    const place = scorePlace(raw, [], {
      ...baseOpts,
      originLat: 35.01,
      originLng: 135.76
    });
    // Distance should be roughly 370km (370000 meters)
    expect(place?.distanceM).toBeGreaterThan(300000);
    expect(place?.distanceM).toBeLessThan(450000);
    expect(place?.originLat).toBe(35.01);
  });
});

describe('Filter Keyword Context edge cases', () => {
  it('filter keyword requires coffee context and rejects menu/water filtering', () => {
    const baseOpts = {
      evidenceKeywords: ['filter', 'v60', 'pourover', 'chemex', 'aeropress', 'masl'],
      archive: [],
      totalWeight: 1,
      filterCoffeeRequired: false,
      originLat: 0,
      originLng: 0
    };
    // 1. "trying to filter out the menu" -> NO MATCH
    const noMatch1 = scorePlace({ id: '1', displayName: { text: 'Cafe' }, reviews: [{ text: { text: 'trying to filter out the menu' } }] }, [], baseOpts);
    expect(noMatch1?.scoreBreakdown.evidenceScore).toBe(0);

    // 2. "filter something out" -> NO MATCH
    const noMatch2 = scorePlace({ id: '2', displayName: { text: 'Cafe' }, reviews: [{ text: { text: 'they try to filter something out' } }] }, [], baseOpts);
    expect(noMatch2?.scoreBreakdown.evidenceScore).toBe(0);

    // 3. "they serve good filter coffee" -> MATCH
    const match1 = scorePlace({ id: '3', displayName: { text: 'Cafe' }, reviews: [{ text: { text: 'they serve good filter coffee' } }] }, [], baseOpts);
    expect(match1?.scoreBreakdown.evidenceScore).toBeGreaterThan(0);

    // 4. "I had a great ethiopia filter today" -> MATCH
    const match2 = scorePlace({ id: '4', displayName: { text: 'Cafe' }, reviews: [{ text: { text: 'had a nice filter from their specialty roast' } }] }, [], baseOpts);
    expect(match2?.scoreBreakdown.evidenceScore).toBeGreaterThan(0);
  });
});

describe('T1 Upgrade Coherence Gate', () => {
  it('2 menu signals + coffee-ratio 0.2 -> no upgrade', async () => {
    // Mock website content to have 2 strong signals
    (getScan as any).mockResolvedValue({ ts: Date.now(), text: 'we serve single origin and v60' });
    
    // Create a LiveResult with 0.2 coffee ratio (5 reviews, 1 mentions coffee)
    const rawReviews = ['coffee is okay', 'nice place', 'good food', 'great service', 'awesome vibe']; 
    const baseResult = {
      placeId: 'gate-test-1',
      websiteUri: 'https://test.com',
      tier: 'T2',
      rawReviews,
      scoreBreakdown: { coffeeMention: 0, lexiconScore: 0, evidenceScore: 0, matchedKeywords: [], totalBeforeCap: 0 }
    } as unknown as LiveResult;
    
    const upgraded = await upgradeT1([baseResult]);
    expect(upgraded[0].tier).toBe('T2'); // No upgrade because ratio is 0.2
  });

  it('1 menu signal + coffee-ratio 0.5 -> Menu Hint (0.30)', async () => {
    // Mock website content to have 1 strong signal
    (getScan as any).mockResolvedValue({ ts: Date.now(), text: 'we serve v60' });
    
    // Create a LiveResult with 0.5 coffee ratio (2 reviews, 1 mentions coffee)
    const rawReviews = ['good coffee', 'nice place']; 
    const baseResult = {
      placeId: 'gate-test-2',
      websiteUri: 'https://test.com',
      tier: 'T2',
      rawReviews,
      scoreBreakdown: { coffeeMention: 0, lexiconScore: 0, evidenceScore: 0, matchedKeywords: [], totalBeforeCap: 0 }
    } as unknown as LiveResult;
    
    const upgraded = await upgradeT1([baseResult]);
    expect(upgraded[0].tier).toBe('T2'); 
    expect(upgraded[0].tierBadge).toBe('📄 Menu Hint');
    expect(upgraded[0].scoreBreakdown.evidenceScore).toBe(0.30);
  });
});
