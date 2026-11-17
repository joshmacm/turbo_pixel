import React, { useState } from 'react';
import { Sparkles, X, Clock, Zap, Play, Key } from 'lucide-react';
import type { Workout } from '../workouts/types';
import { getZoneForPct } from '../workouts/zones';
import {
  generateWorkoutsFromPrompt,
  generateWorkoutsWithGeminiKey,
} from '../utils/workoutGenerator';

interface AiWorkoutModalProps {
  ftp: number;
  onSelectAndSave: (workout: Workout) => void;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  '45m climbing sweet spot with some torque',
  '30m punchy VO2 attacks, feeling fresh',
  '60m easy zone 2 base spin',
  '40m crit sprints & hard bursts',
];

export const AiWorkoutModal: React.FC<AiWorkoutModalProps> = ({
  ftp,
  onSelectAndSave,
  onClose,
}) => {
  const [prompt, setPrompt] = useState('');
  const [geminiKey, setGeminiKey] = useState(
    () => localStorage.getItem('pp_gemini_key') || ''
  );
  const [showKey, setShowKey] = useState(false);
  const [suggestions, setSuggestions] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setError(null);
    setLoading(true);

    try {
      if (geminiKey.trim()) {
        localStorage.setItem('pp_gemini_key', geminiKey.trim());
        const res = await generateWorkoutsWithGeminiKey(prompt, geminiKey);
        setSuggestions(res);
      } else {
        setSuggestions(generateWorkoutsFromPrompt(prompt));
      }
    } catch (err) {
      // Fall back cleanly to built-in generator if API fails
      setError(
        err instanceof Error
          ? `${err.message} — using built-in smart generator instead.`
          : 'API failed — using built-in smart generator.'
      );
      setSuggestions(generateWorkoutsFromPrompt(prompt));
    } finally {
      setLoading(false);
    }
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
          maxWidth: 680,
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 18,
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span
            className="pixel-font"
            style={{ fontSize: 12, color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Sparkles size={14} /> AI WORKOUT GENERATOR
          </span>
          <button className="pixel-btn" style={{ padding: '4px 8px' }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="pixel-input"
              style={{ flex: 1 }}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. 45 min sweet spot climbing, or 30 min brutal VO2 max..."
              required
            />
            <button type="submit" className="pixel-btn pixel-btn-primary" disabled={loading}>
              <Sparkles size={14} /> {loading ? 'Generating...' : 'Suggest 3'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>TRY:</span>
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                className="pixel-btn"
                style={{ padding: '3px 7px', fontSize: 10 }}
                onClick={() => {
                  setPrompt(q);
                  setSuggestions(generateWorkoutsFromPrompt(q));
                }}
              >
                {q}
              </button>
            ))}
            <button
              type="button"
              className="pixel-btn"
              style={{ padding: '3px 7px', fontSize: 10, marginLeft: 'auto' }}
              onClick={() => setShowKey((s) => !s)}
              title="Optional: use your own Gemini API key"
            >
              <Key size={11} /> {geminiKey ? 'API Key Set' : 'Optional API Key'}
            </button>
          </div>

          {showKey && (
            <input
              className="pixel-input"
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="Optional Gemini API key (stored locally; works offline without one)"
              style={{ fontSize: 11 }}
            />
          )}
        </form>

        {error && <div style={{ color: 'var(--orange)', fontSize: 11 }}>{error}</div>}

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {suggestions.map((w) => {
            const total = Math.max(1, w.totalDurationSec);
            const maxPct = Math.max(
              1.3,
              ...w.blocks.map((b) => Math.max(b.startPowerPct, b.endPowerPct))
            );
            let cursor = 0;

            return (
              <div
                key={w.id}
                style={{
                  background: 'var(--panel-alt)',
                  border: '2px solid var(--border)',
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{w.name}</span>
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 10,
                        color: 'var(--muted)',
                        border: '1px solid var(--border)',
                        padding: '1px 5px',
                      }}
                    >
                      {w.category}
                    </span>
                  </div>
                  <button
                    className="pixel-btn pixel-btn-success"
                    style={{ padding: '4px 10px', fontSize: 11 }}
                    onClick={() => onSelectAndSave(w)}
                  >
                    <Play size={12} /> Save &amp; Load
                  </button>
                </div>

                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{w.description}</div>

                <svg
                  viewBox="0 0 240 36"
                  preserveAspectRatio="none"
                  style={{ width: '100%', height: 36, background: '#e2e8f0', display: 'block' }}
                >
                  {w.blocks.map((b) => {
                    const x1 = (cursor / total) * 240;
                    const x2 = ((cursor + b.durationSec) / total) * 240;
                    cursor += b.durationSec;
                    const y1 = 36 - (b.startPowerPct / maxPct) * 32;
                    const y2 = 36 - (b.endPowerPct / maxPct) * 32;
                    const z = getZoneForPct((b.startPowerPct + b.endPowerPct) / 2);
                    return (
                      <polygon
                        key={b.id}
                        points={`${x1},36 ${x1},${y1} ${x2},${y2} ${x2},36`}
                        fill={z.color}
                        fillOpacity={0.85}
                      />
                    );
                  })}
                </svg>

                <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> {Math.round(w.totalDurationSec / 60)}m
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Zap size={12} /> ~{w.tssApprox} TSS (@ {ftp}W FTP)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
