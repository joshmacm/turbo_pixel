import { computeTotalDuration, estimateTss } from './engine';
import type { Workout, WorkoutBlock } from './types';

/**
 * Parses a Zwift (.zwo) XML workout file into our internal Workout model.
 */
export function parseZwoXml(xmlText: string, fileName = 'Imported Workout'): Workout {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid .zwo XML file');
  }

  const name =
    doc.querySelector('workout_file > name')?.textContent?.trim() ||
    fileName.replace(/\.zwo$/i, '');
  const description =
    doc.querySelector('workout_file > description')?.textContent?.trim() ||
    'Imported .zwo workout';

  const workoutEl = doc.querySelector('workout_file > workout');
  if (!workoutEl) {
    throw new Error('Missing <workout> element in .zwo file');
  }

  const blocks: WorkoutBlock[] = [];
  let idx = 0;

  const numAttr = (el: Element, attr: string, fallback: number): number => {
    const val = el.getAttribute(attr);
    if (val === null) return fallback;
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  for (const child of Array.from(workoutEl.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag === 'warmup' || tag === 'cooldown' || tag === 'ramp') {
      const duration = Math.max(10, Math.round(numAttr(child, 'Duration', 300)));
      const low = numAttr(child, 'PowerLow', 0.5);
      const high = numAttr(child, 'PowerHigh', 0.75);
      blocks.push({
        id: `zwo-${idx++}`,
        name: tag === 'warmup' ? 'Warmup' : tag === 'cooldown' ? 'Cooldown' : 'Ramp',
        type: tag === 'warmup' ? 'warmup' : tag === 'cooldown' ? 'cooldown' : 'ramp',
        durationSec: duration,
        startPowerPct: low,
        endPowerPct: high,
      });
    } else if (tag === 'steadystate' || tag === 'freeride') {
      const duration = Math.max(10, Math.round(numAttr(child, 'Duration', 300)));
      const power = numAttr(child, 'Power', 0.65);
      blocks.push({
        id: `zwo-${idx++}`,
        name: tag === 'freeride' ? 'Free Ride' : 'Steady',
        type: 'steady',
        durationSec: duration,
        startPowerPct: power,
        endPowerPct: power,
      });
    } else if (tag === 'intervalst') {
      const repeat = Math.max(1, Math.round(numAttr(child, 'Repeat', 1)));
      const onDur = Math.max(5, Math.round(numAttr(child, 'OnDuration', 60)));
      const offDur = Math.max(5, Math.round(numAttr(child, 'OffDuration', 60)));
      const onPower = numAttr(child, 'OnPower', 1.0);
      const offPower = numAttr(child, 'OffPower', 0.5);
      for (let r = 1; r <= repeat; r++) {
        blocks.push({
          id: `zwo-${idx++}`,
          name: `Interval (${r}/${repeat})`,
          type: 'interval',
          durationSec: onDur,
          startPowerPct: onPower,
          endPowerPct: onPower,
        });
        blocks.push({
          id: `zwo-${idx++}`,
          name: `Recovery (${r}/${repeat})`,
          type: 'recovery',
          durationSec: offDur,
          startPowerPct: offPower,
          endPowerPct: offPower,
        });
      }
    }
  }

  if (blocks.length === 0) {
    throw new Error('No supported workout blocks found in .zwo file');
  }

  return {
    id: `zwo-${Date.now()}`,
    name,
    category: 'Custom',
    description,
    blocks,
    totalDurationSec: computeTotalDuration(blocks),
    tssApprox: estimateTss(blocks),
  };
}
