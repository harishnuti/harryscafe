/* Defaults per Architecture Appendices C–F */
export const DEFAULT_KEYWORDS = [
  { text: 'specialty coffee', weight: 9, armed: true,  concept: '◎ Specialty' },
  { text: 'pour over',        weight: 9, armed: true,  concept: '⏳ Pour Over' },
  { text: 'single origin',    weight: 8, armed: false, concept: '🌱 Single Origin' },
  { text: 'filter coffee',    weight: 7, armed: false, concept: '☕ Filter' },
  { text: 'hand brew',        weight: 6, armed: false, concept: '✋ Hand Brew' },
  { text: 'coffee roaster',   weight: 6, armed: false, concept: '🔥 Roaster' },
  { text: 'light roast',      weight: 5, armed: false, concept: '🌤 Light Roast' },
  { text: 'gesha',            weight: 4, armed: false, concept: '🧬 Rare Varietal' },
  { text: 'V60',              weight: 4, armed: false, concept: '⏳ Pour Over' },
  { text: 'third wave',       weight: 3, armed: false, concept: '◎ Specialty' },
];
export const DEFAULT_CRITERIA = [
  { text: 'Dedicated filter / pour-over menu', weight: 9 },
  { text: 'Single origins offered (not blend-only)', weight: 9 },
  { text: 'Producer or farm named on menu', weight: 8 },
  { text: 'Process stated (washed / natural / etc.)', weight: 8 },
  { text: 'Barista can discuss ratio & temperature', weight: 7 },
  { text: 'Grinder visible & identifiable', weight: 6 },
  { text: 'Roast date disclosed or in-house roast', weight: 6 },
  { text: 'Flat-bottom brewer in rotation', weight: 5 },
  { text: 'Manual brewing only — no full automation', weight: 5 },
  { text: 'Rare varietal on menu (Gesha tier)', weight: 4 },
];
export const SEED_WISHLIST = [
  { name: 'Glyph Supply Co', area: 'Jurong, Singapore', priority: 'HIGH' as const, note: 'Farm-specific bean tasting menu — barista-recommended. Long-standing watchlist target.', added: '2026-05-26' },
  { name: 'Dough', area: 'Victoria Street, Singapore', priority: 'MEDIUM' as const, note: 'Glyph sister café — specialty coffee + food. Recommended at Zerah.', added: '2026-05-26' },
];
export const DL = {
  grinders: ['Mahlkönig EK43 (98mm Flat)','Mahlkönig EK43S (98mm Flat)','Mahlkönig EK Omnia (98mm Flat)','Mahlkönig X54','Mahlkönig CORE (54mm Flat)','Ditting 807 (98mm Flat)','Ditting KR804','Option-O Lagom P64 (64mm Flat)','Option-O Lagom P100','DF64 Gen 2 (64mm Flat)','DF83V (83mm Flat)','Timemore Sculptor 078','Timemore Sculptor 078S','Fellow Ode Gen 2','Comandante C40 (Hand)','Kinu M47 (Hand)','1Zpresso ZP6 (Hand)','Mazzer Major V','Mazzer MM (83mm Flat)','Anfim SP II','Niche Zero (Conical)','Victoria Arduino Mythos MY85','Weber EG-1 (80mm Flat)'],
  brewers: ['Hario V60 (Conical)','Orea V4 (Flat-Bottom)','April Brewer (Flat-Bottom)','Kalita Wave 155 (Flat-Bottom)','Kalita Wave 185 (Flat-Bottom)','Origami (Conical)','Origami + Wave Filter (Flat)','Origami Dripper (Ceramic — Flat-Bottom Stand)','Hario Switch (Immersion Hybrid)','Hario Alpha (Flat-Bottom)','Deep27 (Flat-Bottom Immersion-Assist)','xBloom (Automated Flat-Bottom)','Chemex','Fellow Stagg X','AeroPress','Clever Dripper','Flatbed Dripper (Flat-Bottom)','Batch Brewer','Espresso Machine'],
  varietals: ['Gesha','Geisha (Panama)','Sudan Rume','Sudan Rume (Yellow)','Wush Wush','Pink Bourbon','Red Bourbon','Yellow Bourbon','Bourbon Aruzi','Typica','Typica Mejorado','Caturra','Caturra Chiroso','Catuai','Pacamara','Maragogype','SL28','SL34','SL28 / SL34','Ruiru 11','Batian','Heirloom (Ethiopia)','74110 / 74112 (JARC)','74158 (JARC)','Castillo','Colombia','Papayo','Parainema','Marshell','Arara','Catucai','Laurina','Liberica','Catimor','Purple Leaf Caturra','Sidra','Eugenioides'],
  processes: ['Washed','Fully Washed','Double Washed','Washed Special Prep','Natural','Honey','Red Honey','Yellow Honey','Black Honey','Anaerobic Natural','Anaerobic Washed','Yeast Anaerobic Natural','Extended Fermentation Natural (EF2)','Extended Fermentation Honey','Mosto Fermentation','Carbonic Maceration','Thermal Shock','Co-Ferment','Wet-Hulled (Giling Basah)','Koji Fermentation'],
  origins: ['Colombia, Huila','Colombia, Cauca','Colombia, Valle del Cauca','Colombia, Quindío','Colombia, Nariño','Ethiopia, Yirgacheffe','Ethiopia, Guji','Ethiopia, Gedeb','Ethiopia, Sidama','Kenya, Nyeri','Kenya, Kirinyaga',"Kenya, Murang'a",'Panama, Boquete','Panama, Chiriquí','Peru, Cajamarca','Ecuador, Loja','Ecuador, Pichincha','Rwanda','Burundi','Bolivia, Samaipata','Brazil, Carmo de Minas','Brazil, Mogiana','Costa Rica, Tarrazú','Guatemala, Huehuetenango','Honduras','El Salvador','Nicaragua','Indonesia, West Java','Indonesia, Sulawesi','India, Chikmagalur','India, Coorg','China, Yunnan','Malaysia, Johor','Myanmar','Yemen'],
  temps: ['96','95','94','93','92','91','90','88','86-90','85','90 → 70','92 → 80','88 → 70','85 → 95 (ramp)','70 → 90 → 70 (oscillation)','92 (constant)'],
  ratios: ['1:15','1:14','1:14.5','1:15.3','1:15.5','1:16','1:16.2','1:16.5','1:17','~1:2 (espresso)','Unknown'],
  roasts: ['Light','Light (Filter Roast)','Light-Medium','Medium','Medium-Dark','Espresso Roast','Unknown'],
};

export interface CodexCard { id: string; kind: 'grinder'|'brewer'|'method'; name: string; spec: string; note: string; match?: RegExp }
export const CODEX: CodexCard[] = [
  { id:'ek43', kind:'grinder', name:'Mahlkönig EK43', spec:'98 mm flat cast-steel burrs · high RPM', match:/^EK43$/, note:'The clarity benchmark for filter service and the archive\u2019s most-sighted unit. Bimodal-but-low-fines distribution keeps naturals clean (Beloya, Santuário) and preserved the Inmaculada Gesha\u2019s hibiscus opening at Homeground.' },
  { id:'ek43s', kind:'grinder', name:'Mahlkönig EK43S', spec:'98 mm flat · shorter tower, same geometry', match:/EK43S/, note:'Functionally the EK43 signature in a smaller chassis. Behind Alchemist\u2019s El Morito — "Confirmed: I love this bean" — and the Ijen Laurina textbook arc.' },
  { id:'omnia', kind:'grinder', name:'Mahlkönig EK Omnia', spec:'98 mm flat · variable RPM, stepped adjust', match:/Omnia/, note:'Paired with Nylon\u2019s xBloom program. Low-RPM option preserves volatile aromatics — responsible for Banko Gotiti\u2019s bergamot clarity at a lean 1:17.' },
  { id:'p64', kind:'grinder', name:'Option-O Lagom P64', spec:'64 mm flat · low-retention single-dose', match:/P64/, note:'The boutique-bar precision pick. Preserved linalool through flash-chill (first Gesha, iced) and drove the cup of the year at Fluid Collective — El Obraje. Now also behind the thermal-oscillation Switch program there.' },
  { id:'df83', kind:'grinder', name:'DF83V (83 mm flat)', spec:'83 mm flat · variable RPM prosumer', match:/DF83/, note:'Punches above its class: the Pink Bourbon pomegranate-mandarin clarity at Zerah and Cowpresso\u2019s aggressive Las Nubes Geisha both ran through 83 mm flats.' },
  { id:'df64', kind:'grinder', name:'DF64 Gen 2', spec:'64 mm flat · single-dose workhorse', match:/^DF64/, note:'Behind the Ester Bomb — proof a modest flat burr can carry an extreme fermentation profile if the bed is managed.' },
  { id:'sculptor', kind:'grinder', name:'Timemore Sculptor 078', spec:'78 mm flat (SSP-style geometry)', match:/Sculptor/, note:'Maxi Coffee Bar\u2019s sweetness amplifier — the La Laja Sudan Rume raspberry-nectarine milestone and La Villa\u2019s fruit-cake density.' },
  { id:'ditting', kind:'grinder', name:'Ditting 98 mm (807/KR)', spec:'98 mm flat · Swiss retail-to-bar lineage', match:/Ditting/, note:'Keryi\u2019s house geometry: held fragile Gesha linalool at a tight 1:14 and delivered the archive\u2019s first mosto raspberry esters on cue.' },
  { id:'core54', kind:'grinder', name:'Mahlkönig CORE (54 mm)', spec:'54 mm flat · compact bar unit', match:/CORE/, note:'Smallest flats in the archive — yet La Papaya\u2019s 2,100 MASL terpene profile survived. Geometry class matters less than alignment and dose discipline.' },
  { id:'v60', kind:'brewer', name:'Hario V60', spec:'Conical · single large exit · high flow', match:/V60/, note:'The double-edged classic. In expert hands it carried El Morito; but the archive\u2019s two documented over-extraction misses (Rwanda Nkara, Suke Quto) share the V60-conical fingerprint. The geometry argument is now data, not preference.' },
  { id:'orea', kind:'brewer', name:'Orea V4', spec:'Flat-bottom · bottom bypass ports', match:/Orea/, note:'Bypass design lifts perceived sweetness by shortening late-phase contact. Delivered the Pink Bourbon\u2019s on-schedule sugar surfacing and Equate\u2019s isolated-peach experiment.' },
  { id:'april', kind:'brewer', name:'April Brewer', spec:'Flat-bottom · shallow wide bed', match:/April/, note:'Even beds, gentle drawdowns. Chosen for the Yellow Sudan Rume EF2 triple-milestone cup — varietal geraniol read as pure signal.' },
  { id:'switch', kind:'brewer', name:'Hario Switch', spec:'Immersion-percolation hybrid · valve control', match:/Switch/, note:'The protocol enabler: step-downs (Keryi 88→70) and Fluid Collective\u2019s 70→90→70 thermal oscillation both need the valve. Immersion phase buys solubles control before percolation clarity.' },
  { id:'origami', kind:'brewer', name:'Origami Dripper', spec:'Ceramic · conical or flat by filter/stand choice', match:/Origami/, note:'Geometry chameleon. Conical mode produced the JB thermal revelation (lime→plum); flat-bottom-stand mode carried both Homeground cups. Always log which mode.' },
  { id:'deep27', kind:'brewer', name:'Deep27', spec:'Flat-bottom immersion-assist · deep narrow bed', match:/Deep27/, note:'Kyūkei\u2019s ascending-ramp partner (85→95) — the only rising protocol in the archive, and it earned a 4/4 palate alignment on Worka Chelchele.' },
  { id:'xbloom', kind:'brewer', name:'xBloom', spec:'Automated flat-bottom · profile-driven', match:/xBloom/, note:'Automated *assistance*, not replacement: a barista programs it per bean. The archive distinguishes this sharply from batch-tap automation (see the 2050 manifesto).' },
  { id:'m-phases', kind:'method', name:'The Three-Phase Read', spec:'HOT → MID-COOL → COOL · every cup, no exceptions', note:'Volatiles first, sugars second, truth last. A cup that doesn\u2019t change is hiding something — or has nothing to say. The archive\u2019s founding discipline, vindicated repeatedly: lime→plum (La Florida), lemon→melon→white tea (Banko Gotiti), hibiscus→Darjeeling (Inmaculada).' },
  { id:'m-dna', kind:'method', name:'Palate DNA', spec:'Washed clarity · malic + linalool · Gesha apex · 1:15–1:17', note:'The preference fingerprint against which every cup is read. Malic stone-fruit brightness blooming mid-cool; jasmine-class florals; flat burrs and flat beds; fermentation admired as theatre, never as habit.' },
  { id:'m-geometry', kind:'method', name:'Flat vs Conical — the Evidence', spec:'Archive finding, not opinion', note:'Starred cups cluster heavily on flat-bottom geometry; both documented execution misses are V60 conical. Conical isn\u2019t wrong — it\u2019s less forgiving, and the archive prices that risk.' },
  { id:'m-temp', kind:'method', name:'Temperature Protocol Taxonomy', spec:'Constant · step-down · ascending ramp · oscillation', note:'Constant for stable washed lots; step-down (90→70) to separate aromatics from body; the Kyūkei ramp (85→95) to open slowly; and Fluid\u2019s 70→90→70 oscillation — the newest entry in the taxonomy, taming anaerobic variables.' },
  { id:'m-acids', kind:'method', name:'The Acid Lexicon', spec:'Citric · Malic · Phosphoric · Acetic/Lactic', note:'Citric: hot-phase zip (Banko Gotiti front). Malic: cooling stone fruit (La Florida\u2019s plum). Phosphoric: Kenyan mineral juice (Kiamugumo). Acetic/lactic: fermentation\u2019s signature — theatre in the Ester Bomb, trailing note in Las Nubes.' },
  { id:'m-ratio', kind:'method', name:'The Ratio Band', spec:'1:15–1:17 comfort band · ~80% conformity', note:'Tighter (1:14) buys body for immersion and honey Geshas; leaner (1:17) buys aromatic separation for washed Ethiopians. The band is a prior, not a rule — but deviations must earn their place.' },
];
