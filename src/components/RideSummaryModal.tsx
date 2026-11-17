import React, { useState } from 'react';
import { Download, X, Zap } from 'lucide-react';
import { computeRideStats, estimateRampTestFtp } from '../workouts/engine';
import type { TelemetrySample } from '../workouts/types';
import { generateTcx } from '../export/tcx';

interface RideSummaryModalProps {
  workoutId: string;
  workoutName: string;
  samples: TelemetrySample[];
  startTimeIso: string;
  ftp: number;
  onApplyFtp?: (newFtp: number) => void;
  onClose: () => void;
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const RideSummaryModal: React.FC<RideSummaryModalProps> = ({
  workoutId,
  workoutName,
  samples,
  startTimeIso,
  ftp,
  onApplyFtp,
  onClose,
}) => {
  const [title, setTitle] = useState(`Pixel Peloton — ${workoutName}`);
  const [ftpApplied, setFtpApplied] = useState(false);

  const stats = computeRideStats(samples, ftp);
  const estimatedFtp = workoutId === 'ftp-ramp-test' ? estimateRampTestFtp(samples) : null;

  const handleDownloadTcx = () => {
    const tcx = generateTcx(samples, title, startTimeIso);
    const blob = new Blob([tcx], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.tcx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statItems = [
    { label: 'DURATION', value: formatTime(stats.durationSec) },
    { label: 'DISTANCE', value: `${stats.distanceKm} km` },
    { label: 'AVG POWER', value: `${stats.avgPower} W` },
    { label: 'NORM POWER', value: `${stats.normalizedPower} W` },
    { label: 'MAX POWER', value: `${stats.maxPower} W` },
    { label: 'AVG HR', value: stats.avgHr > 0 ? `${stats.avgHr} bpm` : '--' },
    { label: 'AVG CADENCE', value: stats.avgCadence > 0 ? `${stats.avgCadence} rpm` : '--' },
    { label: 'WORK / TSS', value: `${stats.kilojoules} kJ / ${stats.tss}` },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 7, 11, 0.84)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
      }}
    >
      <div className="pixel-panel" style={{ width: '100%', maxWidth: 520, padding: 18 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <span className="pixel-font" style={{ fontSize: 12, color: '#4ade80' }}>
            RIDE COMPLETE
          </span>
          <button className="pixel-btn" style={{ padding: '4px 8px' }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, marginBottom: 12 }}>
          <span>Activity Title</span>
          <input
            className="pixel-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginBottom: 14,
          }}
        >
          {statItems.map((item) => (
            <div
              key={item.label}
              style={{
                background: 'var(--panel-alt)',
                border: '1px solid var(--border)',
                padding: '8px 6px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{item.value}</div>
            </div>
          ))}
        </div>

        {estimatedFtp !== null && (
          <div
            style={{
              background: '#fef9c3',
              border: '2px solid #ca8a04',
              padding: '8px 10px',
              marginBottom: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
            }}
          >
            <span>
              <strong>Ramp Test Result:</strong> Estimated FTP is{' '}
              <strong>{estimatedFtp} W</strong> (75% of best 1m power)
            </span>
            {onApplyFtp && (
              <button
                className="pixel-btn pixel-btn-success"
                style={{ padding: '4px 8px' }}
                disabled={ftpApplied}
                onClick={() => {
                  onApplyFtp(estimatedFtp);
                  setFtpApplied(true);
                }}
              >
                <Zap size={12} /> {ftpApplied ? 'FTP Updated' : `Set FTP ${estimatedFtp}W`}
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <button className="pixel-btn pixel-btn-primary" onClick={handleDownloadTcx}>
            <Download size={14} /> Download .TCX
          </button>

          <button className="pixel-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
