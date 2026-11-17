export interface PowerZone {
  zone: number;
  name: string;
  color: string;
  minPct: number;
  maxPct: number;
}

export const POWER_ZONES: PowerZone[] = [
  { zone: 1, name: 'Z1 Recovery', color: '#8b9bb4', minPct: 0, maxPct: 0.55 },
  { zone: 2, name: 'Z2 Endurance', color: '#38bdf8', minPct: 0.55, maxPct: 0.75 },
  { zone: 3, name: 'Z3 Tempo', color: '#4ade80', minPct: 0.75, maxPct: 0.90 },
  { zone: 4, name: 'Z4 Threshold', color: '#facc15', minPct: 0.90, maxPct: 1.05 },
  { zone: 5, name: 'Z5 VO2 Max', color: '#fb923c', minPct: 1.05, maxPct: 1.20 },
  { zone: 6, name: 'Z6 Anaerobic', color: '#f87171', minPct: 1.20, maxPct: 9.99 },
];

export function getZoneForPct(pct: number): PowerZone {
  for (const z of POWER_ZONES) {
    if (pct < z.maxPct) return z;
  }
  return POWER_ZONES[POWER_ZONES.length - 1];
}
