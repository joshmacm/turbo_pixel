import React from 'react';
import type { TelemetrySample, Workout } from '../workouts/types';
import { getZoneForPct } from '../workouts/zones';

interface WorkoutProfileProps {
  workout: Workout;
  elapsedSec: number;
  ftp: number;
  biasPct: number;
  samples: TelemetrySample[];
  height?: number;
}

export const WorkoutProfile: React.FC<WorkoutProfileProps> = ({
  workout,
  elapsedSec,
  ftp,
  biasPct,
  samples,
  height = 120,
}) => {
  const totalSec = Math.max(1, workout.totalDurationSec);
  const maxPct = Math.max(
    1.35,
    ...workout.blocks.map((b) => Math.max(b.startPowerPct, b.endPowerPct) * (biasPct / 100))
  );

  const W = 800;
  const H = height;

  let cursor = 0;
  const polygons = workout.blocks.map((b) => {
    const x1 = (cursor / totalSec) * W;
    const x2 = ((cursor + b.durationSec) / totalSec) * W;
    cursor += b.durationSec;

    const p1 = b.startPowerPct * (biasPct / 100);
    const p2 = b.endPowerPct * (biasPct / 100);
    const y1 = H - (p1 / maxPct) * (H - 10);
    const y2 = H - (p2 / maxPct) * (H - 10);
    const avgPct = (p1 + p2) / 2;
    const zone = getZoneForPct(avgPct);

    const points = `${x1.toFixed(1)},${H} ${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(
      1
    )},${y2.toFixed(1)} ${x2.toFixed(1)},${H}`;

    return { id: b.id, points, color: zone.color, x1, x2 };
  });

  const ftpY = H - (1.0 / maxPct) * (H - 10);
  const playheadX = Math.min(W, Math.max(0, (elapsedSec / totalSec) * W));

  // Build live actual-power polyline (downsampled for SVG speed)
  let tracePoints = '';
  if (samples.length > 1 && ftp > 0) {
    const step = Math.max(1, Math.floor(samples.length / 250));
    const pts: string[] = [];
    for (let i = 0; i < samples.length; i += step) {
      const s = samples[i];
      const x = Math.min(W, (s.elapsedSec / totalSec) * W);
      const pct = s.powerWatts / ftp;
      const y = Math.max(2, H - (pct / maxPct) * (H - 10));
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    tracePoints = pts.join(' ');
  }

  return (
    <div className="pixel-panel" style={{ padding: '8px 10px' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: `${height}px`, display: 'block', background: '#f1f5f9' }}
      >
        {/* Blocks */}
        {polygons.map((poly) => (
          <polygon
            key={poly.id}
            points={poly.points}
            fill={poly.color}
            fillOpacity={0.82}
            stroke="#ffffff"
            strokeWidth={1.5}
          />
        ))}

        {/* FTP 100% line */}
        <line
          x1={0}
          y1={ftpY}
          x2={W}
          y2={ftpY}
          stroke="#475569"
          strokeDasharray="4 4"
          strokeWidth={1}
          opacity={0.65}
        />

        {/* Completed veil */}
        <rect
          x={0}
          y={0}
          width={playheadX}
          height={H}
          fill="#0f172a"
          fillOpacity={0.14}
        />

        {/* Live power trace */}
        {tracePoints && (
          <polyline
            fill="none"
            stroke="#0f172a"
            strokeWidth={2}
            points={tracePoints}
            opacity={0.9}
          />
        )}

        {/* Playhead */}
        <line x1={playheadX} y1={0} x2={playheadX} y2={H} stroke="#0284c7" strokeWidth={2.5} />
      </svg>
    </div>
  );
};
