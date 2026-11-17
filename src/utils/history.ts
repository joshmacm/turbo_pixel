export interface SavedRide {
  id: string;
  title: string;
  dateIso: string;
  durationSec: number;
  distanceKm: number;
  avgPower: number;
  normalizedPower: number;
  avgHr: number;
  tss: number;
  tcx: string;
}

const HISTORY_KEY = 'pp_ride_history';
const MAX_RIDES = 25;

export function loadRideHistory(): SavedRide[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRideToHistory(ride: SavedRide): SavedRide[] {
  const existing = loadRideHistory().filter((r) => r.id !== ride.id);
  const updated = [ride, ...existing].slice(0, MAX_RIDES);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // If localStorage quota is tight, drop oldest rides and retry once
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated.slice(0, 10)));
    } catch {
      // ignore
    }
  }
  return updated;
}

export function deleteRideFromHistory(id: string): SavedRide[] {
  const updated = loadRideHistory().filter((r) => r.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}
