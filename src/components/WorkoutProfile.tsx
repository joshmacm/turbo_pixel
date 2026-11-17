import React, { useState } from 'react';
import type { TelemetrySample, Workout, WorkoutBlock } from '../workouts/types';
import { getZoneForPct } from '../workouts/zones';

interface WorkoutProfileProps {
  workout: Workout;
  elapsedSec: number;
  ftp: number;
  biasPct: number;
  samples: TelemetrySample[];
  height?: number;
}

function formatBlockDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export const WorkoutProfile: React.FC<WorkoutProfileProps> = ({
  workout,
  elapsedSec,
  ftp,
  biasPct,
  samples,
  height = 120,
}) => {
  const [hovered, setHovered] = useState<{
    block: WorkoutBlock;
    pctX: number;
  } | null>(null);

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

    return {
      id: b.id,
      block: b,
      points,
      color: zone.color,
      centerPctX: (((x1 + x2) / 2) / W) * 100,
    };
  });

  const ftpY = H - (1.0 / maxPct) * (H - 10);
  const playheadX = Math.min(W, Math.max(0, (elapsedSec / totalSec) * W));

  // Build live actual-power & HR polylines (downsampled for SVG speed)
  let tracePoints = '';
  let hrPoints = '';
  if (samples.length > 1 && ftp > 0) {
    const step = Math.max(1, Math.floor(samples.length / 250));
    const pts: string[] = [];
    const hPts: string[] = [];
    for (let i = 0; i < samples.length; i += step) {
      const s = samples[i];
      const x = Math.min(W, (s.elapsedSec / totalSec) * W);
      const pct = s.powerWatts / ftp;
      const y = Math.max(2, H - (pct / maxPct) * (H - 10));
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);

      if (s.heartRateBpm > 0) {
        const hrNorm = Math.max(0, Math.min(1, (s.heartRateBpm - 55) / 145));
        const hy = Math.max(2, H - hrNorm * (H - 10));
        hPts.push(`${x.toFixed(1)},${hy.toFixed(1)}`);
      }
    }
    tracePoints = pts.join(' ');
    hrPoints = hPts.join(' ');
  }

  const renderTooltip = () => {
    if (!hovered) return null;
    const { block, pctX } = hovered;
    const p1 = block.startPowerPct * (biasPct / 100);
    const p2 = block.endPowerPct * (biasPct / 100);
    const w1 = Math.round(p1 * ftp);
    const w2 = Math.round(p2 * ftp);
    const pct1 = Math.round(p1 * 100);
    const pct2 = Math.round(p2 * 100);
    const zone = getZoneForPct((p1 + p2) / 2);

    const powerText =
      pct1 === pct2 ? `${pct1}% FTP (${w1}W)` : `${pct1}–${pct2}% FTP (${w1}–${w2}W)`;

    const clampedLeft = Math.max(12, Math.min(88, pctX));

    return (
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: `${clampedLeft}%`,
          transform: 'translateX(-50%)',
          background: '#0f172a',
          color: '#f8fafc',
          border: `2px solid ${zone.color}`,
          boxShadow: '0 3px 0 rgba(15,23,42,0.35)',
          padding: '6px 9px',
          fontSize: 11,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        <div style={{ fontWeight: 700, color: zone.color, marginBottom: 2 }}>
          {block.name} • {formatBlockDuration(block.durationSec)}
        </div>
        <div>
          {powerText} • {zone.name}
          {block.cadenceTarget ? ` • ${block.cadenceTarget} RPM` : ''}
        </div>
      </div>
    );
  };

  return (
    <div
      className="pixel-panel"
      style={{ padding: '8px 10px', position: 'relative' }}
      onMouseLeave={() => setHovered(null)}
    >
      {renderTooltip()}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: `${height}px`, display: 'block', background: '#f1f5f9' }}
      >
        {/* Blocks */}
        {polygons.map((poly) => {
          const isHov = hovered?.block.id === poly.id;
          return (
            <polygon
              key={poly.id}
              points={poly.points}
              fill={poly.color}
              fillOpacity={isHov ? 1 : 0.8}
              stroke={isHov ? '#0f172a' : '#ffffff'}
              strokeWidth={isHov ? 2.5 : 1.5}
              style={{ cursor: 'crosshair' }}
              onMouseEnter={() => setHovered({ block: poly.block, pctX: poly.centerPctX })}
            />
          );
        })}

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
          style={{ pointerEvents: 'none' }}
        />

        {/* Completed veil */}
        <rect
          x={0}
          y={0}
          width={playheadX}
          height={H}
          fill="#0f172a"
          fillOpacity={0.14}
          style={{ pointerEvents: 'none' }}
        />

        {/* Live power trace */}
        {tracePoints && (
          <polyline
            fill="none"
            stroke="#0f172a"
            strokeWidth={2}
            points={tracePoints}
            opacity={0.9}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Live HR trace */}
        {hrPoints && (
          <polyline
            fill="none"
            stroke="#dc2626"
            strokeWidth={1.75}
            points={hrPoints}
            opacity={0.85}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {/* Playhead */}
        <line
          x1={playheadX}
          y1={0}
          x2={playheadX}
          y2={H}
          stroke="#0284c7"
          strokeWidth={2.5}
          style={{ pointerEvents: 'none' }}
        />
      </svg>
    </div>
  );
};
