import { describe, it, expect } from 'vitest';
import { circleToRect, tokenizeDna, scorePlace, sortLiveResults, menuEvidenceRegex } from '../src/services/livesearch';
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

describe('T1 Menu Evidence Scanner', () => {
  it('detects specialty coffee menu keywords in cafe HTML', () => {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'cafe-menu.html'), 'utf-8');
    const match = html.match(menuEvidenceRegex);
    expect(match).toBeTruthy();
    expect(match![0].toLowerCase()).toBe('filter coffee');
  });

  it('yields zero evidence for nightclub HTML', () => {
    const html = fs.readFileSync(path.join(__dirname, 'fixtures', 'nightclub.html'), 'utf-8');
    const match = html.match(menuEvidenceRegex);
    expect(match).toBeNull();
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
