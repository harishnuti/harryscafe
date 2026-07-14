import { describe, it, expect } from 'vitest';
import { getClusters } from '../src/services/flavor';

describe('getClusters', () => {
  it('bergamot and yuzu -> [citrus]', () => {
    const clusters = getClusters('bergamot and yuzu');
    expect(clusters).toContain('citrus');
    // yuzu and bergamot map to citrus. 'and' is short (<3 chars). So only citrus should exist
    expect(clusters.length).toBe(1);
  });

  it('notes citrus, floral vs verdict lemon jasmine -> exact match (the V5 miss)', () => {
    const promised = getClusters('citrus, floral');
    const tasted = getClusters('lemon jasmine');
    
    // Check overlap simulating intel logic
    const overlap = promised.filter(p => tasted.includes(p));
    expect(overlap).toContain('citrus');
    expect(overlap).toContain('floral');
    expect(overlap.length).toBe(promised.length);
  });
});
