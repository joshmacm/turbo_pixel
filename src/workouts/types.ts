export type BlockType = 'warmup' | 'steady' | 'interval' | 'recovery' | 'cooldown' | 'ramp';

export interface WorkoutBlock {
  id: string;
  name: string;
  type: BlockType;
  durationSec: number;
  startPowerPct: number; // e.g., 0.65 for 65% FTP
  endPowerPct: number;   // same as startPowerPct for steady blocks
  cadenceTarget?: number;
}

export type WorkoutCategory = 'Endurance' | 'Sweet Spot' | 'Threshold' | 'VO2 Max' | 'Sprint' | 'Custom';

export interface Workout {
  id: string;
  name: string;
  category: WorkoutCategory;
  description: string;
  blocks: WorkoutBlock[];
  totalDurationSec: number;
  tssApprox: number;
}

export interface TelemetrySample {
  timestampIso: string;
  elapsedSec: number;
  powerWatts: number;
  targetWatts: number;
  heartRateBpm: number;
  cadenceRpm: number;
  speedKmh: number;
  distanceMeters: number;
}
