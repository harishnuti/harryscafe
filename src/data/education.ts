export interface EduSection {
  title: string;
  icon: string;
  content: string; // Markdown or HTML-like text
}

export const EDUCATION_DATA: EduSection[] = [
  {
    title: "Processing Methods",
    icon: "🍒",
    content: `
### Washed (Wet Process)
The fruit is removed before drying. This results in the cleanest cup with bright, sparkling acidity and high clarity. It highlights the true genetic and terroir characteristics of the bean without fermentation noise.

### Natural (Dry Process)
The cherry is dried whole. As the fruit ferments and dries around the seed, it imparts heavy fruit-forward esters (like strawberry, blueberry, or rum). Heavy body, lower acidity, and high sweetness.

### Anaerobic Fermentation
Coffee is sealed in oxygen-free tanks before drying. This forces different bacteria and yeasts to dominate, creating unusual, highly intense flavors like cinnamon, bubblegum, or wine.

### Thermal Shock
A modern experimental process where cherries are blasted with hot water to kill off wild microbes and open pores, then plunged into cold water. This locks in hyper-specific fermentation esters (like the punchy lychee notes often found in Nestor Lasso's Finca El Diviso).
    `
  },
  {
    title: "Sensory Science & Acids",
    icon: "🧪",
    content: `
### The Primary Coffee Acids
- **Citric Acid:** Bright, sharp, and crisp. Found heavily in high-altitude coffees (like washed Ethiopians). Tastes like lemon, orange, or grapefruit.
- **Malic Acid:** Smooth and lingering. Found in Kenyan and Colombian coffees. Tastes like green apple, plum, or peach.
- **Phosphoric Acid:** An inorganic acid uniquely high in Kenyan coffees (SL28/SL34). Adds a sparkling, effervescent "cola" or blackcurrant sensation.
- **Lactic Acid:** Created during fermentation (especially anaerobic). Adds a creamy, buttery texture and yogurt-like tang.
- **Acetic Acid:** Vinegar acid. In low amounts, it adds a pleasant winey sharpness. In high amounts, it tastes fermented or vinegary.
- **Chlorogenic Acid (CGA):** Bitter and astringent. Roasting breaks it down. If a coffee tastes green or excessively bitter (CGA lactones), it may be underdeveloped or over-extracted.
    `
  },
  {
    title: "Hardware: Grinders & Burrs",
    icon: "⚙️",
    content: `
### Flat vs Conical Burrs
- **Flat Burrs:** Produce a highly uniform, unimodal particle size distribution. This allows you to push extraction higher without hitting bitter boulders or muddy fines. Results in high clarity, flavor separation, and tea-like body. Examples: *Mahlkönig EK43, Lagom P64/P80*.
- **Conical Burrs:** Produce a bimodal distribution (two peaks: fines and boulders). This creates a blended, complex cup with heavier body and syrupy texture, but less flavor separation. Better for traditional espresso.

### The 98mm Standard
The Mahlkönig EK43 (98mm flat burr) set the gold standard for modern filter coffee. The massive burr size spins faster at the edge, slicing beans with extreme precision to minimize fines, enabling high-extraction, ultra-clean pour-overs.
    `
  },
  {
    title: "Origins & Terroir",
    icon: "🌍",
    content: `
### Ethiopia
The birthplace of coffee. Known for heirloom varietals. Washed Ethiopians are wildly floral (jasmine, bergamot) and tea-like. Naturals are heavy with blueberry and strawberry jam.

### Kenya
Grown in volcanic soil high in phosphoric acid. Famous for the SL-28 and SL-34 varietals. Expect punchy, aggressive blackcurrant, tomato, and grapefruit notes with a syrupy body.

### Colombia
The most experimental origin today. While traditional Colombians are chocolatey and malic (stone fruit), modern Colombian farms (like Finca El Paraiso or El Diviso) are pioneering Thermal Shock and Co-fermentation to create mind-bending, artificial-tasting fruit bombs.

### Panama
The modern king of luxury coffee, almost entirely due to the **Gesha** varietal. Grown in micro-climates like Boquete, Panama Geshas deliver ethereal notes of jasmine, peach, and bergamot.
    `
  }
];
