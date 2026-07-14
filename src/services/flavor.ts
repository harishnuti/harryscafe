export const CLUSTERS: Record<string, string[]> = {
  'citrus': ['citrus', 'lemon', 'orange', 'lime', 'bergamot', 'yuzu', 'grapefruit', 'tangerine', 'mandarin'],
  'berry': ['berry', 'strawberry', 'blueberry', 'raspberry', 'blackberry', 'cranberry'],
  'stonefruit': ['peach', 'apricot', 'plum', 'cherry', 'nectarine'],
  'tropical': ['mango', 'passionfruit', 'pineapple', 'papaya', 'lychee', 'guava'],
  'floral': ['floral', 'jasmine', 'rose', 'lavender', 'hibiscus', 'blossom', 'elderflower'],
  'chocolate': ['chocolate', 'cocoa', 'cacao', 'fudge', 'brownie', 'nutella'],
  'nutty': ['nutty', 'almond', 'hazelnut', 'pecan', 'walnut', 'macadamia', 'peanut'],
  'caramel': ['caramel', 'toffee', 'butterscotch', 'molasses', 'syrup', 'honey', 'maple'],
  'spice': ['spice', 'cinnamon', 'clove', 'nutmeg', 'cardamom', 'ginger', 'pepper'],
  'wine': ['wine', 'boozy', 'rum', 'cognac', 'whiskey', 'fermented', 'champagne']
};

export const getClusters = (text: string) => {
  const words = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(w => w.length > 2);
  const found = new Set<string>();
  words.forEach(w => {
    let matched = false;
    for (const [cluster, synonyms] of Object.entries(CLUSTERS)) {
      if (synonyms.includes(w)) { found.add(cluster); matched = true; break; }
    }
    if (!matched && w.length > 3) found.add(w);
  });
  return Array.from(found);
};
