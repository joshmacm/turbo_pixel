import { computeTotalDuration, estimateTss } from './engine';
import type { Workout, WorkoutBlock, WorkoutCategory } from './types';

function makeWorkout(
  id: string,
  name: string,
  category: WorkoutCategory,
  description: string,
  blocks: Omit<WorkoutBlock, 'id'>[]
): Workout {
  const withIds: WorkoutBlock[] = blocks.map((b, i) => ({
    ...b,
    id: `${id}-b${i}`,
  }));
  return {
    id,
    name,
    category,
    description,
    blocks: withIds,
    totalDurationSec: computeTotalDuration(withIds),
    tssApprox: estimateTss(withIds),
  };
}

function repeatBlocks(
  reps: number,
  pair: Omit<WorkoutBlock, 'id'>[]
): Omit<WorkoutBlock, 'id'>[] {
  const out: Omit<WorkoutBlock, 'id'>[] = [];
  for (let i = 1; i <= reps; i++) {
    for (const b of pair) {
      out.push({ ...b, name: `${b.name} (${i}/${reps})` });
    }
  }
  return out;
}

export const WORKOUT_LIBRARY: Workout[] = [
  makeWorkout(
    'lunch-crunch-20',
    '20m Lunch Crunch',
    'Threshold',
    'Short, punchy 20-minute ERG session with progressive warmup and 3x2m threshold efforts.',
    [
      { name: 'Warmup Ramp', type: 'warmup', durationSec: 240, startPowerPct: 0.45, endPowerPct: 0.75, cadenceTarget: 90 },
      ...repeatBlocks(3, [
        { name: 'Threshold Push', type: 'interval', durationSec: 120, startPowerPct: 1.0, endPowerPct: 1.0, cadenceTarget: 92 },
        { name: 'Spin Easy', type: 'recovery', durationSec: 90, startPowerPct: 0.55, endPowerPct: 0.55, cadenceTarget: 85 },
      ]),
      { name: 'Cooldown', type: 'cooldown', durationSec: 330, startPowerPct: 0.65, endPowerPct: 0.40, cadenceTarget: 85 },
    ]
  ),
  makeWorkout(
    'sweet-spot-2x15',
    'Sweet Spot 2x15',
    'Sweet Spot',
    'Classic aerobic & muscular endurance builder: two 15-minute blocks at 88–92% FTP.',
    [
      { name: 'Warmup', type: 'warmup', durationSec: 420, startPowerPct: 0.50, endPowerPct: 0.75, cadenceTarget: 88 },
      { name: 'Primer', type: 'interval', durationSec: 60, startPowerPct: 0.95, endPowerPct: 0.95, cadenceTarget: 95 },
      { name: 'Easy Spin', type: 'recovery', durationSec: 120, startPowerPct: 0.55, endPowerPct: 0.55, cadenceTarget: 85 },
      { name: 'Sweet Spot #1', type: 'steady', durationSec: 900, startPowerPct: 0.88, endPowerPct: 0.92, cadenceTarget: 90 },
      { name: 'Recovery', type: 'recovery', durationSec: 300, startPowerPct: 0.55, endPowerPct: 0.55, cadenceTarget: 85 },
      { name: 'Sweet Spot #2', type: 'steady', durationSec: 900, startPowerPct: 0.88, endPowerPct: 0.92, cadenceTarget: 90 },
      { name: 'Cooldown', type: 'cooldown', durationSec: 300, startPowerPct: 0.65, endPowerPct: 0.42, cadenceTarget: 85 },
    ]
  ),
  makeWorkout(
    'vo2-5x3',
    'VO2 Max 5x3',
    'VO2 Max',
    'Five 3-minute VO2 intervals at 118% FTP with equal 3-minute recovery valleys.',
    [
      { name: 'Warmup Ramp', type: 'warmup', durationSec: 480, startPowerPct: 0.48, endPowerPct: 0.78, cadenceTarget: 90 },
      { name: 'Opener', type: 'interval', durationSec: 60, startPowerPct: 1.08, endPowerPct: 1.08, cadenceTarget: 98 },
      { name: 'Settle', type: 'recovery', durationSec: 120, startPowerPct: 0.55, endPowerPct: 0.55, cadenceTarget: 85 },
      ...repeatBlocks(5, [
        { name: 'VO2 Surge', type: 'interval', durationSec: 180, startPowerPct: 1.18, endPowerPct: 1.18, cadenceTarget: 96 },
        { name: 'Recovery', type: 'recovery', durationSec: 180, startPowerPct: 0.52, endPowerPct: 0.52, cadenceTarget: 84 },
      ]),
      { name: 'Cooldown', type: 'cooldown', durationSec: 300, startPowerPct: 0.60, endPowerPct: 0.40, cadenceTarget: 82 },
    ]
  ),
  makeWorkout(
    'over-unders-3x9',
    'Over-Unders 3x9',
    'Threshold',
    'Lactate clearance builder: alternating 2m at 95% and 1m at 106% FTP for 3 sets.',
    [
      { name: 'Warmup', type: 'warmup', durationSec: 480, startPowerPct: 0.50, endPowerPct: 0.76, cadenceTarget: 90 },
      ...repeatBlocks(3, [
        { name: 'Under 95%', type: 'steady', durationSec: 120, startPowerPct: 0.95, endPowerPct: 0.95, cadenceTarget: 90 },
        { name: 'Over 106%', type: 'interval', durationSec: 60, startPowerPct: 1.06, endPowerPct: 1.06, cadenceTarget: 94 },
        { name: 'Under 95%', type: 'steady', durationSec: 120, startPowerPct: 0.95, endPowerPct: 0.95, cadenceTarget: 90 },
        { name: 'Over 106%', type: 'interval', durationSec: 60, startPowerPct: 1.06, endPowerPct: 1.06, cadenceTarget: 94 },
        { name: 'Under 95%', type: 'steady', durationSec: 120, startPowerPct: 0.95, endPowerPct: 0.95, cadenceTarget: 90 },
        { name: 'Over 106%', type: 'interval', durationSec: 60, startPowerPct: 1.06, endPowerPct: 1.06, cadenceTarget: 94 },
        { name: 'Rest', type: 'recovery', durationSec: 240, startPowerPct: 0.52, endPowerPct: 0.52, cadenceTarget: 85 },
      ]),
      { name: 'Cooldown', type: 'cooldown', durationSec: 300, startPowerPct: 0.60, endPowerPct: 0.40, cadenceTarget: 82 },
    ]
  ),
  makeWorkout(
    'tabata-micro',
    'Tabata Micro-Bursts',
    'Sprint',
    'Two sets of 8x 20s @ 140% FTP / 10s easy. Brutal anaerobic capacity stimulus.',
    [
      { name: 'Warmup', type: 'warmup', durationSec: 420, startPowerPct: 0.45, endPowerPct: 0.78, cadenceTarget: 90 },
      ...repeatBlocks(8, [
        { name: 'Sprint!', type: 'interval', durationSec: 20, startPowerPct: 1.40, endPowerPct: 1.40, cadenceTarget: 105 },
        { name: 'Float', type: 'recovery', durationSec: 10, startPowerPct: 0.50, endPowerPct: 0.50, cadenceTarget: 80 },
      ]),
      { name: 'Mid Rest', type: 'recovery', durationSec: 300, startPowerPct: 0.50, endPowerPct: 0.50, cadenceTarget: 85 },
      ...repeatBlocks(8, [
        { name: 'Sprint!', type: 'interval', durationSec: 20, startPowerPct: 1.40, endPowerPct: 1.40, cadenceTarget: 105 },
        { name: 'Float', type: 'recovery', durationSec: 10, startPowerPct: 0.50, endPowerPct: 0.50, cadenceTarget: 80 },
      ]),
      { name: 'Cooldown', type: 'cooldown', durationSec: 300, startPowerPct: 0.60, endPowerPct: 0.40, cadenceTarget: 84 },
    ]
  ),
  makeWorkout(
    'z2-endurance-60',
    'Zone 2 Base Cruise',
    'Endurance',
    'Steady 60-minute aerobic base ride with subtle cadence pyramids.',
    [
      { name: 'Warmup', type: 'warmup', durationSec: 360, startPowerPct: 0.45, endPowerPct: 0.65, cadenceTarget: 88 },
      { name: 'Z2 Steady', type: 'steady', durationSec: 900, startPowerPct: 0.68, endPowerPct: 0.68, cadenceTarget: 90 },
      { name: 'Z2 High Cadence', type: 'steady', durationSec: 600, startPowerPct: 0.70, endPowerPct: 0.70, cadenceTarget: 96 },
      { name: 'Z2 Tempo Touch', type: 'steady', durationSec: 600, startPowerPct: 0.74, endPowerPct: 0.74, cadenceTarget: 88 },
      { name: 'Z2 Steady', type: 'steady', durationSec: 840, startPowerPct: 0.66, endPowerPct: 0.66, cadenceTarget: 90 },
      { name: 'Cooldown', type: 'cooldown', durationSec: 300, startPowerPct: 0.60, endPowerPct: 0.42, cadenceTarget: 85 },
    ]
  ),
];
