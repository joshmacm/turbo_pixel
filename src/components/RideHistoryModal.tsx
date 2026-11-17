import React from 'react';
import { Download, Trash2, X } from 'lucide-react';
import type { SavedRide } from '../utils/history';

interface RideHistoryModalProps {
  rides: SavedRide[];
  onDelete: (id: string) => void;
  onClose: () => void;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export const RideHistoryModal: React.FC<RideHistoryModalProps> = ({
  rides,
  onDelete,
  onClose,
}) => {
  const handleDownload = (ride: SavedRide) => {
    const blob = new Blob([ride.tcx], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ride.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.tcx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        className="pixel-panel"
        style={{
          width: '100%',
          maxWidth: 620,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <span className="pixel-font" style={{ fontSize: 12, color: 'var(--accent)' }}>
            RIDE HISTORY ({rides.length})
          </span>
          <button className="pixel-btn" style={{ padding: '4px 8px' }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rides.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--muted)', padding: '18px 0', textAlign: 'center' }}>
              No saved rides yet. Complete a workout and click End &amp; Save!
            </div>
          ) : (
            rides.map((r) => (
              <div
                key={r.id}
                style={{
                  background: 'var(--panel-alt)',
                  border: '1px solid var(--border)',
                  padding: '8px 10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {new Date(r.dateIso).toLocaleDateString()} • {formatDuration(r.durationSec)} •{' '}
                    {r.distanceKm} km • Avg {r.avgPower}W (NP {r.normalizedPower}W) • TSS {r.tss}
                    {r.avgHr > 0 ? ` • ${r.avgHr} bpm` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="pixel-btn"
                    style={{ padding: '4px 8px' }}
                    onClick={() => handleDownload(r)}
                    title="Download .TCX"
                  >
                    <Download size={13} /> .TCX
                  </button>
                  <button
                    className="pixel-btn pixel-btn-danger"
                    style={{ padding: '4px 8px' }}
                    onClick={() => onDelete(r.id)}
                    title="Delete ride"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
