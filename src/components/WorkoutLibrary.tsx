import React, { useRef, useState } from 'react';
import { Upload, Clock, Zap, Play } from 'lucide-react';
import type { Workout, WorkoutCategory } from '../workouts/types';
import { getZoneForPct } from '../workouts/zones';
import { parseZwoXml } from '../workouts/zwoParser';

interface WorkoutLibraryProps {
  workouts: Workout[];
  selectedId: string;
  ftp: number;
  onSelect: (workout: Workout) => void;
  onImport: (workout: Workout) => void;
}

const CATEGORIES: ('All' | WorkoutCategory)[] = [
  'All',
  'Endurance',
  'Sweet Spot',
  'Threshold',
  'VO2 Max',
  'Sprint',
  'Custom',
];

function formatDuration(sec: number): string {
  const m = Math.round(sec / 60);
  return `${m}m`;
}

export const WorkoutLibrary: React.FC<WorkoutLibraryProps> = ({
  workouts,
  selectedId,
  ftp,
  onSelect,
  onImport,
}) => {
  const [filter, setFilter] = useState<'All' | WorkoutCategory>('All');
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const visible =
    filter === 'All' ? workouts : workouts.filter((w) => w.category === filter);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const text = await file.text();
      const parsed = parseZwoXml(text, file.name);
      onImport(parsed);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to parse .zwo file');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="pixel-panel" style={{ padding: 14 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div className="pixel-font" style={{ fontSize: 12, color: 'var(--accent)' }}>
          WORKOUT LIBRARY
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`pixel-btn ${filter === cat ? 'pixel-btn-primary' : ''}`}
              style={{ padding: '4px 8px', fontSize: 11 }}
              onClick={() => setFilter(cat)}
            >
              {cat}
            </button>
          ))}
          <button
            className="pixel-btn"
            style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={() => fileInputRef.current?.click()}
            title="Import a Zwift .zwo workout file"
          >
            <Upload size={13} /> Import .ZWO
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zwo,text/xml,application/xml"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      {importError && (
        <div style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>
          {importError}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
          gap: 10,
        }}
      >
        {visible.map((w) => {
          const isSelected = w.id === selectedId;
          const total = Math.max(1, w.totalDurationSec);
          const maxPct = Math.max(
            1.3,
            ...w.blocks.map((b) => Math.max(b.startPowerPct, b.endPowerPct))
          );
          let cursor = 0;

          return (
            <div
              key={w.id}
              onClick={() => onSelect(w)}
              style={{
                background: isSelected ? '#e0f2fe' : '#f8fafc',
                border: `2px solid ${isSelected ? '#0284c7' : '#cbd5e1'}`,
                padding: 10,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{w.name}</span>
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--muted)',
                      border: '1px solid var(--border)',
                      padding: '1px 5px',
                    }}
                  >
                    {w.category}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>
                  {w.description}
                </div>
              </div>

              {/* Mini SVG preview */}
              <svg
                viewBox="0 0 200 40"
                preserveAspectRatio="none"
                style={{ width: '100%', height: 36, background: '#e2e8f0', display: 'block' }}
              >
                {w.blocks.map((b) => {
                  const x1 = (cursor / total) * 200;
                  const x2 = ((cursor + b.durationSec) / total) * 200;
                  cursor += b.durationSec;
                  const y1 = 40 - (b.startPowerPct / maxPct) * 36;
                  const y2 = 40 - (b.endPowerPct / maxPct) * 36;
                  const z = getZoneForPct((b.startPowerPct + b.endPowerPct) / 2);
                  return (
                    <polygon
                      key={b.id}
                      points={`${x1},40 ${x1},${y1} ${x2},${y2} ${x2},40`}
                      fill={z.color}
                      fillOpacity={0.8}
                    />
                  );
                })}
              </svg>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 11,
                  color: 'var(--text)',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} /> {formatDuration(w.totalDurationSec)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Zap size={12} /> ~{w.tssApprox} TSS ({Math.round(ftp * 0.85)}W+)
                </span>
                {isSelected && (
                  <span
                    style={{
                      color: 'var(--accent)',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <Play size={11} /> READY
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
