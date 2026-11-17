import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { computeTotalDuration, estimateTss } from '../workouts/engine';
import type { Workout, WorkoutBlock } from '../workouts/types';

interface WorkoutBuilderModalProps {
  onSave: (workout: Workout) => void;
  onClose: () => void;
}

export const WorkoutBuilderModal: React.FC<WorkoutBuilderModalProps> = ({
  onSave,
  onClose,
}) => {
  const [name, setName] = useState('Custom Intervals');
  const [warmupMin, setWarmupMin] = useState(5);
  const [repeats, setRepeats] = useState(4);
  const [onSec, setOnSec] = useState(180);
  const [onPct, setOnPct] = useState(105);
  const [offSec, setOffSec] = useState(120);
  const [offPct, setOffPct] = useState(55);
  const [cooldownMin, setCooldownMin] = useState(5);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const id = `custom-${Date.now()}`;
    const blocks: WorkoutBlock[] = [];
    let idx = 0;

    if (warmupMin > 0) {
      blocks.push({
        id: `${id}-b${idx++}`,
        name: 'Warmup',
        type: 'warmup',
        durationSec: warmupMin * 60,
        startPowerPct: 0.45,
        endPowerPct: 0.72,
        cadenceTarget: 88,
      });
    }

    for (let r = 1; r <= repeats; r++) {
      blocks.push({
        id: `${id}-b${idx++}`,
        name: `Interval (${r}/${repeats})`,
        type: 'interval',
        durationSec: Math.max(10, onSec),
        startPowerPct: onPct / 100,
        endPowerPct: onPct / 100,
        cadenceTarget: 92,
      });
      if (offSec > 0) {
        blocks.push({
          id: `${id}-b${idx++}`,
          name: `Recovery (${r}/${repeats})`,
          type: 'recovery',
          durationSec: offSec,
          startPowerPct: offPct / 100,
          endPowerPct: offPct / 100,
          cadenceTarget: 85,
        });
      }
    }

    if (cooldownMin > 0) {
      blocks.push({
        id: `${id}-b${idx++}`,
        name: 'Cooldown',
        type: 'cooldown',
        durationSec: cooldownMin * 60,
        startPowerPct: 0.62,
        endPowerPct: 0.40,
        cadenceTarget: 84,
      });
    }

    onSave({
      id,
      name: name.trim() || 'Custom Workout',
      category: 'Custom',
      description: `${repeats}x ${onSec}s @ ${onPct}% / ${offSec}s @ ${offPct}% FTP`,
      blocks,
      totalDurationSec: computeTotalDuration(blocks),
      tssApprox: estimateTss(blocks),
    });
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
      <div className="pixel-panel" style={{ width: '100%', maxWidth: 440, padding: 18 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <span className="pixel-font" style={{ fontSize: 12, color: 'var(--accent)' }}>
            NEW WORKOUT
          </span>
          <button className="pixel-btn" style={{ padding: '4px 8px' }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <span>Workout Name</span>
            <input
              className="pixel-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span>Warmup (min)</span>
              <input
                className="pixel-input"
                type="number"
                min={0}
                max={30}
                value={warmupMin}
                onChange={(e) => setWarmupMin(Number(e.target.value) || 0)}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span>Repeats</span>
              <input
                className="pixel-input"
                type="number"
                min={1}
                max={30}
                value={repeats}
                onChange={(e) => setRepeats(Math.max(1, Number(e.target.value) || 1))}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span>ON Duration (sec)</span>
              <input
                className="pixel-input"
                type="number"
                min={10}
                max={3600}
                value={onSec}
                onChange={(e) => setOnSec(Math.max(10, Number(e.target.value) || 60))}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span>ON Power (% FTP)</span>
              <input
                className="pixel-input"
                type="number"
                min={40}
                max={250}
                value={onPct}
                onChange={(e) => setOnPct(Math.max(40, Number(e.target.value) || 100))}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span>OFF Duration (sec)</span>
              <input
                className="pixel-input"
                type="number"
                min={0}
                max={1800}
                value={offSec}
                onChange={(e) => setOffSec(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              <span>OFF Power (% FTP)</span>
              <input
                className="pixel-input"
                type="number"
                min={30}
                max={120}
                value={offPct}
                onChange={(e) => setOffPct(Math.max(30, Number(e.target.value) || 55))}
              />
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <span>Cooldown (min)</span>
            <input
              className="pixel-input"
              type="number"
              min={0}
              max={30}
              value={cooldownMin}
              onChange={(e) => setCooldownMin(Number(e.target.value) || 0)}
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" className="pixel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="pixel-btn pixel-btn-primary">
              <Plus size={14} /> Save Workout
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
