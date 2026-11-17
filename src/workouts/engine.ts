import type { TelemetrySample, Workout, WorkoutBlock } from './types';

export interface ActiveBlockInfo {
  block: WorkoutBlock;
  blockIndex: number;
  blockElapsedSec: number;
  blockRemainingSec: number;
  targetPct: number;
  targetWatts: number;
}

export function computeTotalDuration(blocks: WorkoutBlock[]): number {
  return blocks.reduce((sum, b) => sum + b.durationSec, 0);
}

export function estimateTss(blocks: WorkoutBlock[]): number {
  let total = 0;
  for (const b of blocks) {
    const avgPct = (b.startPowerPct + b.endPowerPct) / 2;
    total += (b.durationSec / 3600) * avgPct * avgPct * 100;
  }
  return Math.round(total);
}

export function getActiveBlockAtTime(
  workout: Workout,
  elapsedSec: number,
  ftp: number,
  biasPct = 100
): ActiveBlockInfo | null {
  if (workout.blocks.length === 0) return null;

  let cursor = 0;
  for (let i = 0; i < workout.blocks.length; i++) {
    const block = workout.blocks[i];
    const blockEnd = cursor + block.durationSec;
    if (elapsedSec < blockEnd || i === workout.blocks.length - 1) {
      const clampedElapsed = Math.max(0, Math.min(block.durationSec, elapsedSec - cursor));
      const progress = block.durationSec > 0 ? clampedElapsed / block.durationSec : 0;
      const rawPct =
        block.startPowerPct + (block.endPowerPct - block.startPowerPct) * progress;
      const targetPct = rawPct * (biasPct / 100);
      const targetWatts = Math.max(30, Math.round(targetPct * ftp));
      return {
        block,
        blockIndex: i,
        blockElapsedSec: clampedElapsed,
        blockRemainingSec: Math.max(0, block.durationSec - clampedElapsed),
        targetPct,
        targetWatts,
      };
    }
    cursor = blockEnd;
  }

  return null;
}

export function getBlockStartTime(workout: Workout, blockIndex: number): number {
  let t = 0;
  for (let i = 0; i < Math.min(blockIndex, workout.blocks.length); i++) {
    t += workout.blocks[i].durationSec;
  }
  return t;
}

export interface RideStats {
  durationSec: number;
  distanceKm: number;
  avgPower: number;
  maxPower: number;
  normalizedPower: number;
  avgHr: number;
  maxHr: number;
  avgCadence: number;
  kilojoules: number;
  tss: number;
}

export function computeRideStats(samples: TelemetrySample[], ftp: number): RideStats {
  if (samples.length === 0) {
    return {
      durationSec: 0,
      distanceKm: 0,
      avgPower: 0,
      maxPower: 0,
      normalizedPower: 0,
      avgHr: 0,
      maxHr: 0,
      avgCadence: 0,
      kilojoules: 0,
      tss: 0,
    };
  }

  let sumPower = 0;
  let maxPower = 0;
  let sumHr = 0;
  let hrCount = 0;
  let maxHr = 0;
  let sumCad = 0;
  let cadCount = 0;

  for (const s of samples) {
    sumPower += s.powerWatts;
    if (s.powerWatts > maxPower) maxPower = s.powerWatts;
    if (s.heartRateBpm > 0) {
      sumHr += s.heartRateBpm;
      hrCount++;
      if (s.heartRateBpm > maxHr) maxHr = s.heartRateBpm;
    }
    if (s.cadenceRpm > 0) {
      sumCad += s.cadenceRpm;
      cadCount++;
    }
  }

  // 30s rolling average^4 for Normalized Power
  const rolling4th: number[] = [];
  for (let i = 0; i < samples.length; i++) {
    const start = Math.max(0, i - 29);
    let winSum = 0;
    for (let j = start; j <= i; j++) {
      winSum += samples[j].powerWatts;
    }
    const winAvg = winSum / (i - start + 1);
    rolling4th.push(Math.pow(winAvg, 4));
  }
  const mean4th = rolling4th.reduce((a, b) => a + b, 0) / rolling4th.length;
  const normalizedPower = Math.round(Math.pow(mean4th, 0.25));

  const durationSec = samples[samples.length - 1].elapsedSec;
  const distanceKm = Number(
    (samples[samples.length - 1].distanceMeters / 1000).toFixed(2)
  );
  const avgPower = Math.round(sumPower / samples.length);
  const kilojoules = Math.round(sumPower / 1000); // 1 sample/sec => W * s / 1000 = kJ
  const intensityFactor = ftp > 0 ? normalizedPower / ftp : 0;
  const tss =
    ftp > 0
      ? Math.round(((durationSec * normalizedPower * intensityFactor) / (ftp * 3600)) * 100)
      : 0;

  return {
    durationSec,
    distanceKm,
    avgPower,
    maxPower,
    normalizedPower,
    avgHr: hrCount > 0 ? Math.round(sumHr / hrCount) : 0,
    maxHr,
    avgCadence: cadCount > 0 ? Math.round(sumCad / cadCount) : 0,
    kilojoules,
    tss,
  };
}
