// Shared Places utilities. The v3.0 keyword-fanout scoring engine (runSearch/scorePlace)
// is superseded by src/services/verify.ts + src/services/confirmation.ts per
// GATEKEEPER v3.1 §4 (see DECISIONS.md).

export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371008.8, r = Math.PI / 180;
  const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const fmtDist = (m: number) => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

export const gmapsLink = (p: { name: string; placeId: string }) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.placeId}`;
export const amapsLink = (p: { name: string; lat: number; lng: number }) =>
  `https://maps.apple.com/?q=${encodeURIComponent(p.name)}&ll=${p.lat},${p.lng}`;
