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
  makeWorkout(
    'ftp-ramp-test',
    'FTP Ramp Test',
    'Threshold',
    '5m warmup then +8% FTP every 60s until exhaustion. Estimates FTP as 75% of best 1-min power.',
    [
      { name: 'Warmup', type: 'warmup', durationSec: 300, startPowerPct: 0.45, endPowerPct: 0.50, cadenceTarget: 90 },
      ...Array.from({ length: 16 }, (_, idx) => {
        const pct = Number((0.52 + idx * 0.08).toFixed(2));
        return {
          name: `Step ${idx + 1} (${Math.round(pct * 100)}%)`,
          type: 'ramp' as const,
          durationSec: 60,
          startPowerPct: pct,
          endPowerPct: pct,
          cadenceTarget: 90,
        };
      }),
    ]
  ),
  makeWorkout(
    'free-ride-erg',
    'Free Ride (Manual ERG)',
    'Endurance',
    'Open 60-minute ERG ride. Use the +/- 10W buttons to dial in any exact target wattage.',
    [
      { name: 'Free Ride ERG', type: 'steady', durationSec: 3600, startPowerPct: 0.65, endPowerPct: 0.65, cadenceTarget: 90 },
    ]
  ),
  makeWorkout(
    'recovery-spin-30',
    '30m Active Recovery',
    'Endurance',
    'Gentle 30-minute Z1/Z2 flush spin to loosen the legs without adding fatigue.',
    [
      { name: 'Easy Warmup', type: 'warmup', durationSec: 300, startPowerPct: 0.42, endPowerPct: 0.52, cadenceTarget: 88 },
      { name: 'Z1 Flush', type: 'steady', durationSec: 1200, startPowerPct: 0.52, endPowerPct: 0.54, cadenceTarget: 92 },
      { name: 'Cooldown', type: 'cooldown', durationSec: 300, startPowerPct: 0.50, endPowerPct: 0.38, cadenceTarget: 85 },
    ]
  ),
  makeWorkout(
    'tempo-bursts-45',
    '45m Tempo Bursts',
    'Endurance',
    'Sustained Z3 tempo cruising (80% FTP) punctuated by 15s surges every 3 minutes.',
    [
      { name: 'Warmup', type: 'warmup', durationSec: 420, startPowerPct: 0.48, endPowerPct: 0.74, cadenceTarget: 90 },
      ...repeatBlocks(8, [
        { name: 'Tempo Cruise', type: 'steady', durationSec: 165, startPowerPct: 0.80, endPowerPct: 0.80, cadenceTarget: 88 },
        { name: 'Surge', type: 'interval', durationSec: 15, startPowerPct: 1.15, endPowerPct: 1.15, cadenceTarget: 100 },
      ]),
      { name: 'Cooldown', type: 'cooldown', durationSec: 360, startPowerPct: 0.65, endPowerPct: 0.42, cadenceTarget: 85 },
    ]
  ),
  makeWorkout(
    'vo2-30-30',
    '45m 30/30 VO2 Repeats',
    'VO2 Max',
    'Two sets of 8x 30s @ 125% FTP / 30s @ 55% FTP for maximal oxygen uptake.',
    [
      { name: 'Warmup Ramp', type: 'warmup', durationSec: 480, startPowerPct: 0.48, endPowerPct: 0.78, cadenceTarget: 90 },
      { name: 'Opener', type: 'interval', durationSec: 60, startPowerPct: 1.05, endPowerPct: 1.05, cadenceTarget: 96 },
      { name: 'Easy Spin', type: 'recovery', durationSec: 120, startPowerPct: 0.52, endPowerPct: 0.52, cadenceTarget: 85 },
      ...repeatBlocks(8, [
        { name: '30s ON', type: 'interval', durationSec: 30, startPowerPct: 1.25, endPowerPct: 1.25, cadenceTarget: 98 },
        { name: '30s OFF', type: 'recovery', durationSec: 30, startPowerPct: 0.55, endPowerPct: 0.55, cadenceTarget: 85 },
      ]),
      { name: 'Mid Recovery', type: 'recovery', durationSec: 300, startPowerPct: 0.50, endPowerPct: 0.50, cadenceTarget: 85 },
      ...repeatBlocks(8, [
        { name: '30s ON', type: 'interval', durationSec: 30, startPowerPct: 1.25, endPowerPct: 1.25, cadenceTarget: 98 },
        { name: '30s OFF', type: 'recovery', durationSec: 30, startPowerPct: 0.55, endPowerPct: 0.55, cadenceTarget: 85 },
      ]),
      { name: 'Cooldown', type: 'cooldown', durationSec: 300, startPowerPct: 0.60, endPowerPct: 0.40, cadenceTarget: 84 },
    ]
  ),
  makeWorkout(
    'threshold-2x20',
    '60m 2x20 Threshold',
    'Threshold',
    'Classic 2x20-minute sustained FTP intervals at 98% with a 6-minute recovery.',
    [
      { name: 'Warmup', type: 'warmup', durationSec: 480, startPowerPct: 0.48, endPowerPct: 0.76, cadenceTarget: 90 },
      { name: 'FTP #1', type: 'steady', durationSec: 1200, startPowerPct: 0.98, endPowerPct: 1.00, cadenceTarget: 90 },
      { name: 'Recovery', type: 'recovery', durationSec: 360, startPowerPct: 0.52, endPowerPct: 0.52, cadenceTarget: 85 },
      { name: 'FTP #2', type: 'steady', durationSec: 1200, startPowerPct: 0.98, endPowerPct: 1.00, cadenceTarget: 90 },
      { name: 'Cooldown', type: 'cooldown', durationSec: 360, startPowerPct: 0.62, endPowerPct: 0.40, cadenceTarget: 84 },
    ]
  ),
  makeWorkout(
    'sweet-spot-pyramid-75',
    '75m Sweet Spot Pyramid',
    'Sweet Spot',
    'Progressive pyramid: 8m, 12m, 16m, and 10m at 88–92% FTP with short 3m recoveries.',
    [
      { name: 'Warmup', type: 'warmup', durationSec: 480, startPowerPct: 0.48, endPowerPct: 0.75, cadenceTarget: 88 },
      { name: 'SS 8m', type: 'steady', durationSec: 480, startPowerPct: 0.88, endPowerPct: 0.88, cadenceTarget: 90 },
      { name: 'Rest', type: 'recovery', durationSec: 180, startPowerPct: 0.55, endPowerPct: 0.55, cadenceTarget: 85 },
      { name: 'SS 12m', type: 'steady', durationSec: 720, startPowerPct: 0.90, endPowerPct: 0.90, cadenceTarget: 90 },
      { name: 'Rest', type: 'recovery', durationSec: 180, startPowerPct: 0.55, endPowerPct: 0.55, cadenceTarget: 85 },
      { name: 'SS 16m', type: 'steady', durationSec: 960, startPowerPct: 0.92, endPowerPct: 0.92, cadenceTarget: 90 },
      { name: 'Rest', type: 'recovery', durationSec: 180, startPowerPct: 0.55, endPowerPct: 0.55, cadenceTarget: 85 },
      { name: 'SS 10m', type: 'steady', durationSec: 600, startPowerPct: 0.90, endPowerPct: 0.90, cadenceTarget: 92 },
      { name: 'Cooldown', type: 'cooldown', durationSec: 360, startPowerPct: 0.62, endPowerPct: 0.40, cadenceTarget: 85 },
    ]
  ),
  makeWorkout(
    'sweet-spot-3x10',
    '50m Sweet Spot 3x10',
    'Sweet Spot',
    'Three 10-minute blocks climbing from 88% to 93% FTP with 3-minute easy spins.',
    [
      { name: 'Warmup', type: 'warmup', durationSec: 420, startPowerPct: 0.48, endPowerPct: 0.76, cadenceTarget: 90 },
      ...repeatBlocks(3, [
        { name: 'Sweet Spot', type: 'steady', durationSec: 600, startPowerPct: 0.88, endPowerPct: 0.93, cadenceTarget: 90 },
        { name: 'Recovery', type: 'recovery', durationSec: 180, startPowerPct: 0.54, endPowerPct: 0.54, cadenceTarget: 85 },
      ]),
      { name: 'Cooldown', type: 'cooldown', durationSec: 240, startPowerPct: 0.60, endPowerPct: 0.40, cadenceTarget: 84 },
    ]
  ),
  makeWorkout(
    'endurance-torque-90',
    '90m Base & Torque',
    'Endurance',
    '90-minute aerobic endurance ride with 4x4m low-cadence (60 RPM) climbing torque blocks.',
    [
      { name: 'Warmup', type: 'warmup', durationSec: 480, startPowerPct: 0.45, endPowerPct: 0.68, cadenceTarget: 88 },
      ...repeatBlocks(4, [
        { name: 'Z2 Base', type: 'steady', durationSec: 720, startPowerPct: 0.68, endPowerPct: 0.68, cadenceTarget: 90 },
        { name: 'Climb Torque', type: 'steady', durationSec: 240, startPowerPct: 0.82, endPowerPct: 0.82, cadenceTarget: 60 },
      ]),
      { name: 'Final Z2', type: 'steady', durationSec: 720, startPowerPct: 0.66, endPowerPct: 0.66, cadenceTarget: 90 },
      { name: 'Cooldown', type: 'cooldown', durationSec: 360, startPowerPct: 0.60, endPowerPct: 0.42, cadenceTarget: 85 },
    ]
  ),
  makeWorkout(
    'neuromuscular-sprints-40',
    '40m Sprint Power 6x15s',
    'Sprint',
    'Six all-out 15s neuromuscular sprints at 180% FTP with full 3m45s recovery between efforts.',
    [
      { name: 'Warmup', type: 'warmup', durationSec: 600, startPowerPct: 0.48, endPowerPct: 0.78, cadenceTarget: 92 },
      ...repeatBlocks(6, [
        { name: 'Max Sprint!', type: 'interval', durationSec: 15, startPowerPct: 1.80, endPowerPct: 1.80, cadenceTarget: 110 },
        { name: 'Full Recovery', type: 'recovery', durationSec: 225, startPowerPct: 0.50, endPowerPct: 0.50, cadenceTarget: 85 },
      ]),
      { name: 'Cooldown', type: 'cooldown', durationSec: 360, startPowerPct: 0.58, endPowerPct: 0.40, cadenceTarget: 84 },
    ]
  ),
];
