import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bluetooth,
  Heart,
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  Minus,
  Plus,
  Volume2,
  VolumeX,
  History,
} from 'lucide-react';
import { FtmsTrainer } from './ble/ftms';
import { HeartRateMonitor } from './ble/heartRate';
import { PixelCanvas, SCENES, type SceneId } from './components/PixelCanvas';
import { WorkoutProfile } from './components/WorkoutProfile';
import { WorkoutLibrary } from './components/WorkoutLibrary';
import { RideSummaryModal } from './components/RideSummaryModal';
import { WorkoutBuilderModal } from './components/WorkoutBuilderModal';
import { RideHistoryModal } from './components/RideHistoryModal';
import { AiWorkoutModal } from './components/AiWorkoutModal';
import { WORKOUT_LIBRARY } from './workouts/library';
import { computeRideStats, getActiveBlockAtTime, getBlockStartTime } from './workouts/engine';
import { getZoneForPct } from './workouts/zones';
import { playCountdownBeep } from './utils/audio';
import { pickMotivationalMessage } from './utils/messages';
import {
  deleteRideFromHistory,
  loadRideHistory,
  saveRideToHistory,
  type SavedRide,
} from './utils/history';
import { generateTcx } from './export/tcx';
import type { TelemetrySample, Workout } from './workouts/types';

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export function App() {
  const [ftp, setFtp] = useState<number>(() => {
    const saved = localStorage.getItem('pp_ftp');
    const parsed = saved ? Number(saved) : NaN;
    return Number.isFinite(parsed) && parsed >= 80 && parsed <= 600 ? Math.round(parsed) : 250;
  });
  const [ftpInput, setFtpInput] = useState<string>(() => String(ftp));

  const [customWorkouts, setCustomWorkouts] = useState<Workout[]>(() => {
    try {
      const raw = localStorage.getItem('pp_custom_workouts');
      return raw ? (JSON.parse(raw) as Workout[]) : [];
    } catch {
      return [];
    }
  });
  const workouts = [...customWorkouts, ...WORKOUT_LIBRARY];
  const [selectedWorkout, setSelectedWorkout] = useState<Workout>(WORKOUT_LIBRARY[0]);
  const [scene, setScene] = useState<SceneId>(() => {
    const saved = localStorage.getItem('pp_scene') as SceneId | null;
    return saved && SCENES.some((s) => s.id === saved) ? saved : 'bristol';
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    () => localStorage.getItem('pp_sound') !== 'off'
  );
  const [smooth3s, setSmooth3s] = useState<boolean>(
    () => localStorage.getItem('pp_smooth') !== 'off'
  );
  const [autoPauseEnabled, setAutoPauseEnabled] = useState<boolean>(
    () => localStorage.getItem('pp_autopause') !== 'off'
  );
  const [rideHistory, setRideHistory] = useState<SavedRide[]>(() => loadRideHistory());
  const [showBuilder, setShowBuilder] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [coachMessage, setCoachMessage] = useState<string>('');
  const lastMsgBlockRef = useRef<number>(-1);
  const lastMsgElapsedRef = useRef<number>(-99);

  // Device state
  const [trainerConnected, setTrainerConnected] = useState(false);
  const [trainerName, setTrainerName] = useState('');
  const [hrConnected, setHrConnected] = useState(false);
  const [hrName, setHrName] = useState('');
  const [bleError, setBleError] = useState<string | null>(null);

  // Live telemetry
  const [powerWatts, setPowerWatts] = useState(0);
  const [cadenceRpm, setCadenceRpm] = useState(0);
  const [speedKmh, setSpeedKmh] = useState(0);
  const [heartRateBpm, setHeartRateBpm] = useState(0);

  // Workout session state
  const [rideState, setRideState] = useState<'idle' | 'running' | 'paused'>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [biasPct, setBiasPct] = useState(100);
  const [manualWatts, setManualWatts] = useState<number>(() => Math.round(ftp * 0.65));
  const [samples, setSamples] = useState<TelemetrySample[]>([]);
  const [startTimeIso, setStartTimeIso] = useState<string>(() => new Date().toISOString());
  const [showSummary, setShowSummary] = useState(false);

  // Refs for 1Hz loop & BLE instances
  const trainerRef = useRef<FtmsTrainer | null>(null);
  const hrmRef = useRef<HeartRateMonitor | null>(null);
  const lastSentTargetRef = useRef<number>(-1);
  const distanceMetersRef = useRef<number>(0);
  const recentPowersRef = useRef<number[]>([]);
  const coastSecRef = useRef<number>(0);
  const autoPausedRef = useRef<boolean>(false);

  const liveRef = useRef({
    powerWatts: 0,
    cadenceRpm: 0,
    speedKmh: 0,
    heartRateBpm: 0,
  });
  liveRef.current = { powerWatts, cadenceRpm, speedKmh, heartRateBpm };

  useEffect(() => {
    localStorage.setItem('pp_ftp', String(ftp));
  }, [ftp]);

  useEffect(() => {
    localStorage.setItem('pp_scene', scene);
  }, [scene]);

  useEffect(() => {
    localStorage.setItem('pp_custom_workouts', JSON.stringify(customWorkouts));
  }, [customWorkouts]);

  useEffect(() => {
    localStorage.setItem('pp_sound', soundEnabled ? 'on' : 'off');
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('pp_smooth', smooth3s ? 'on' : 'off');
  }, [smooth3s]);

  useEffect(() => {
    localStorage.setItem('pp_autopause', autoPauseEnabled ? 'on' : 'off');
  }, [autoPauseEnabled]);

  // Screen Wake Lock while riding
  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    if (rideState === 'running' && nav.wakeLock) {
      nav.wakeLock
        .request('screen')
        .then((s) => {
          sentinel = s;
        })
        .catch(() => undefined);
    }
    return () => {
      if (sentinel) {
        sentinel.release().catch(() => undefined);
      }
    };
  }, [rideState]);

  // Connect / Disconnect Saris H3 (FTMS)
  const toggleTrainer = async () => {
    setBleError(null);
    if (trainerConnected) {
      trainerRef.current?.disconnect();
      return;
    }
    try {
      const trainer = new FtmsTrainer(
        (data) => {
          if (data.powerWatts !== undefined) setPowerWatts(data.powerWatts);
          if (data.cadenceRpm !== undefined) setCadenceRpm(data.cadenceRpm);
          if (data.speedKmh !== undefined) setSpeedKmh(data.speedKmh);
          if (data.heartRateBpm !== undefined && !hrConnected) {
            setHeartRateBpm(data.heartRateBpm);
          }
        },
        (connected, name, err) => {
          setTrainerConnected(connected);
          setTrainerName(name || '');
          if (err) setBleError(err);
        }
      );
      trainerRef.current = trainer;
      await trainer.connect();
    } catch (err) {
      setBleError(err instanceof Error ? err.message : 'Failed to connect trainer');
    }
  };

  // Connect / Disconnect Coospo HRM
  const toggleHr = async () => {
    setBleError(null);
    if (hrConnected) {
      hrmRef.current?.disconnect();
      return;
    }
    try {
      const hrm = new HeartRateMonitor(
        (bpm) => setHeartRateBpm(bpm),
        (connected, name, err) => {
          setHrConnected(connected);
          setHrName(name || '');
          if (err) setBleError(err);
        }
      );
      hrmRef.current = hrm;
      await hrm.connect();
    } catch (err) {
      setBleError(err instanceof Error ? err.message : 'Failed to connect HRM');
    }
  };

  const isFreeRide = selectedWorkout.id === 'free-ride-erg';
  const activeBlock = getActiveBlockAtTime(selectedWorkout, elapsedSec, ftp, biasPct);
  const targetWatts = isFreeRide
    ? manualWatts
    : activeBlock
    ? activeBlock.targetWatts
    : Math.round(ftp * 0.5);
  const nextBlock =
    activeBlock && activeBlock.blockIndex + 1 < selectedWorkout.blocks.length
      ? selectedWorkout.blocks[activeBlock.blockIndex + 1]
      : null;

  const finalizeRide = useCallback(
    (recordedSamples: TelemetrySample[]) => {
      if (recordedSamples.length === 0) return;
      const stats = computeRideStats(recordedSamples, ftp);
      const title = `Pixel Peloton — ${selectedWorkout.name}`;
      const tcx = generateTcx(recordedSamples, title, startTimeIso);
      const saved: SavedRide = {
        id: `ride-${Date.now()}`,
        title,
        dateIso: startTimeIso,
        durationSec: stats.durationSec,
        distanceKm: stats.distanceKm,
        avgPower: stats.avgPower,
        normalizedPower: stats.normalizedPower,
        avgHr: stats.avgHr,
        tss: stats.tss,
        tcx,
      };
      setRideHistory(saveRideToHistory(saved));
      setShowSummary(true);
    },
    [ftp, selectedWorkout.name, startTimeIso]
  );

  // 1Hz workout loop
  useEffect(() => {
    const timer = window.setInterval(() => {
      // Track 3s rolling power average
      recentPowersRef.current = [...recentPowersRef.current.slice(-2), liveRef.current.powerWatts];

      // Auto-pause / auto-resume on coasting when trainer is connected
      if (autoPauseEnabled && trainerConnected) {
        const isCoasting = liveRef.current.cadenceRpm === 0 && liveRef.current.powerWatts < 10;
        if (rideState === 'running') {
          if (isCoasting) {
            coastSecRef.current += 1;
            if (coastSecRef.current >= 3) {
              autoPausedRef.current = true;
              trainerRef.current?.pause();
              setRideState('paused');
              return;
            }
          } else {
            coastSecRef.current = 0;
          }
        } else if (rideState === 'paused' && autoPausedRef.current && !isCoasting) {
          autoPausedRef.current = false;
          coastSecRef.current = 0;
          trainerRef.current?.resume();
          setRideState('running');
        }
      }

      if (rideState !== 'running') return;

      // 3-2-1 interval countdown beeps
      if (soundEnabled && activeBlock && !isFreeRide) {
        const rem = Math.round(activeBlock.blockRemainingSec);
        if (rem === 3 || rem === 2 || rem === 1) {
          playCountdownBeep(false);
        } else if (activeBlock.blockElapsedSec === 0 && elapsedSec > 0) {
          playCountdownBeep(true);
        }
      }

      // Refresh coach message on block change, final 15s of hard efforts, or every 22s
      if (activeBlock) {
        const blockChanged = activeBlock.blockIndex !== lastMsgBlockRef.current;
        const enteredFinal15 =
          activeBlock.targetPct >= 0.95 &&
          Math.round(activeBlock.blockRemainingSec) === 15;
        const timedRefresh = elapsedSec - lastMsgElapsedRef.current >= 22;
        if (blockChanged || enteredFinal15 || timedRefresh) {
          lastMsgBlockRef.current = activeBlock.blockIndex;
          lastMsgElapsedRef.current = elapsedSec;
          setCoachMessage((prev) =>
            pickMotivationalMessage(
              activeBlock.targetPct,
              activeBlock.blockRemainingSec,
              prev
            )
          );
        }
      }

      // Send ERG target power to physical trainer when it changes
      if (trainerConnected && trainerRef.current) {
        if (lastSentTargetRef.current !== targetWatts) {
          lastSentTargetRef.current = targetWatts;
          trainerRef.current.setTargetPower(targetWatts);
        }
      }

      // Accumulate distance (m/s = km/h / 3.6)
      const currentSpeed =
        liveRef.current.speedKmh > 0
          ? liveRef.current.speedKmh
          : liveRef.current.powerWatts > 0
          ? 12 + Math.pow(liveRef.current.powerWatts, 0.48) * 1.95
          : 0;
      distanceMetersRef.current += currentSpeed / 3.6;

      setElapsedSec((prev) => {
        const next = prev + 1;
        const sample: TelemetrySample = {
          timestampIso: new Date().toISOString(),
          elapsedSec: next,
          powerWatts: liveRef.current.powerWatts,
          targetWatts,
          heartRateBpm: liveRef.current.heartRateBpm,
          cadenceRpm: liveRef.current.cadenceRpm,
          speedKmh: Number(currentSpeed.toFixed(1)),
          distanceMeters: distanceMetersRef.current,
        };
        setSamples((s) => {
          const updated = [...s, sample];
          if (next >= selectedWorkout.totalDurationSec) {
            setRideState('paused');
            finalizeRide(updated);
          }
          return updated;
        });
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    rideState,
    trainerConnected,
    targetWatts,
    selectedWorkout.totalDurationSec,
    autoPauseEnabled,
    soundEnabled,
    activeBlock,
    elapsedSec,
    isFreeRide,
    finalizeRide,
  ]);

  const handleStart = () => {
    if (rideState === 'idle') {
      setElapsedSec(0);
      setSamples([]);
      distanceMetersRef.current = 0;
      lastSentTargetRef.current = -1;
      coastSecRef.current = 0;
      autoPausedRef.current = false;
      setStartTimeIso(new Date().toISOString());
    }
    autoPausedRef.current = false;
    trainerRef.current?.resume();
    setRideState('running');
  };

  const handlePause = () => {
    autoPausedRef.current = false;
    trainerRef.current?.pause();
    setRideState('paused');
  };

  const handleEndRide = () => {
    autoPausedRef.current = false;
    trainerRef.current?.pause();
    setRideState('idle');
    if (samples.length > 0) {
      finalizeRide(samples);
    }
  };

  const handleJumpBlock = (delta: -1 | 1) => {
    if (!activeBlock) return;
    const targetIdx = Math.max(
      0,
      Math.min(selectedWorkout.blocks.length - 1, activeBlock.blockIndex + delta)
    );
    const newElapsed = getBlockStartTime(selectedWorkout, targetIdx);
    setElapsedSec(newElapsed);
    lastSentTargetRef.current = -1;
  };

  const handleSelectWorkout = (w: Workout) => {
    if (rideState === 'running') return;
    setSelectedWorkout(w);
    setElapsedSec(0);
    setSamples([]);
    setRideState('idle');
    distanceMetersRef.current = 0;
    lastSentTargetRef.current = -1;
  };

  const displayPowerWatts =
    smooth3s && recentPowersRef.current.length > 0
      ? Math.round(
          recentPowersRef.current.reduce((a, b) => a + b, 0) / recentPowersRef.current.length
        )
      : powerWatts;

  const zone = getZoneForPct(ftp > 0 ? displayPowerWatts / ftp : 0);
  const rideProgress =
    selectedWorkout.totalDurationSec > 0
      ? Math.min(1, elapsedSec / selectedWorkout.totalDurationSec)
      : 0;

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '14px 16px 32px' }}>
      {/* Top Bar */}
      <header
        className="pixel-panel"
        style={{
          padding: '10px 14px',
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="pixel-font" style={{ fontSize: 14, color: 'var(--accent)' }}>
            PIXEL PELOTON
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>ERG TRAINER</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              background: 'var(--panel-alt)',
              border: '2px solid var(--border-bright)',
              padding: '4px 8px',
            }}
          >
            <span style={{ color: 'var(--muted)' }}>FTP</span>
            <input
              type="number"
              min={80}
              max={600}
              value={ftpInput}
              onChange={(e) => {
                const raw = e.target.value;
                setFtpInput(raw);
                const parsed = Number(raw);
                if (Number.isFinite(parsed) && parsed >= 80 && parsed <= 600) {
                  setFtp(Math.round(parsed));
                }
              }}
              onBlur={() => {
                const parsed = Number(ftpInput);
                const clamped = Number.isFinite(parsed)
                  ? Math.max(80, Math.min(600, Math.round(parsed)))
                  : ftp;
                setFtp(clamped);
                setFtpInput(String(clamped));
              }}
              style={{
                width: 52,
                background: 'transparent',
                border: 'none',
                color: 'var(--yellow)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: 13,
                outline: 'none',
              }}
            />
            <span style={{ color: 'var(--muted)' }}>W</span>
          </label>

          <button
            className={`pixel-btn ${trainerConnected ? 'pixel-btn-success' : ''}`}
            onClick={toggleTrainer}
            title="Connect any FTMS smart trainer (Saris, Wahoo, Tacx, Elite, etc.)"
          >
            <Bluetooth size={14} />
            {trainerConnected ? trainerName || 'Trainer OK' : 'Smart Trainer'}
          </button>

          <button
            className={`pixel-btn ${hrConnected ? 'pixel-btn-success' : ''}`}
            onClick={toggleHr}
            title="Connect any BLE Heart Rate Monitor"
          >
            <Heart size={14} />
            {hrConnected ? hrName || 'HRM OK' : 'Heart Rate'}
          </button>

          <button
            className="pixel-btn"
            onClick={() => setSoundEnabled((s) => !s)}
            title="Toggle 3-2-1 interval countdown beeps"
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>

          <button
            className="pixel-btn"
            onClick={() => setShowHistory(true)}
            title="View saved ride history"
          >
            <History size={14} /> History ({rideHistory.length})
          </button>
        </div>
      </header>

      {!FtmsTrainer.isSupported() && (
        <div
          className="pixel-panel"
          style={{
            padding: '8px 12px',
            marginBottom: 12,
            borderColor: '#ca8a04',
            background: '#fef9c3',
            color: '#713f12',
            fontSize: 12,
          }}
        >
          Web Bluetooth is not supported in this browser (e.g. Safari). Use{' '}
          <strong>Chrome, Edge, or Brave</strong> on macOS/Windows (or <strong>Bluefy</strong> on
          iOS) to pair your Smart Trainer &amp; Heart Rate Monitor.
        </div>
      )}

      {bleError && (
        <div
          className="pixel-panel"
          style={{
            padding: '8px 12px',
            marginBottom: 12,
            borderColor: '#dc2626',
            background: '#fee2e2',
            color: '#991b1b',
            fontSize: 12,
          }}
        >
          {bleError}
        </div>
      )}

      {/* Scene Selector + Pixel World Canvas */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginRight: 4 }}>
            ROUTE:
          </span>
          {SCENES.map((s) => (
            <button
              key={s.id}
              className={`pixel-btn ${scene === s.id ? 'pixel-btn-primary' : ''}`}
              style={{ padding: '4px 9px', fontSize: 11 }}
              onClick={() => setScene(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <PixelCanvas
          scene={scene}
          speedKmh={speedKmh}
          cadenceRpm={cadenceRpm}
          powerWatts={displayPowerWatts}
          ftp={ftp}
          isPaused={rideState !== 'running'}
          distanceMeters={distanceMetersRef.current}
          progress={rideProgress}
          coachMessage={coachMessage}
        />
      </div>

      {/* Live Telemetry HUD */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div className="pixel-panel" style={{ padding: '10px 14px', borderColor: zone.color }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 10,
              color: 'var(--muted)',
              marginBottom: 4,
            }}
          >
            <span>POWER / TARGET (ERG)</span>
            <button
              onClick={() => setSmooth3s((s) => !s)}
              style={{
                background: smooth3s ? 'var(--panel-alt)' : 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                padding: '1px 4px',
                cursor: 'pointer',
              }}
              title="Toggle 3-second power smoothing"
            >
              {smooth3s ? '3s AVG' : '1s RAW'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: zone.color }}>
              {displayPowerWatts}
            </span>
            <span style={{ fontSize: 14, color: 'var(--muted)' }}>/ {targetWatts} W</span>
          </div>
        </div>

        <div className="pixel-panel" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>HEART RATE</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--red)' }}>
              {heartRateBpm > 0 ? heartRateBpm : '--'}
            </span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>BPM</span>
          </div>
        </div>

        <div className="pixel-panel" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
            CADENCE {activeBlock?.block.cadenceTarget ? `(TGT ${activeBlock.block.cadenceTarget})` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>
              {cadenceRpm}
            </span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>RPM</span>
          </div>
        </div>

        <div className="pixel-panel" style={{ padding: '10px 14px' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
            ELAPSED / REMAINING
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>
              {formatClock(elapsedSec)}
            </span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              -{formatClock(Math.max(0, selectedWorkout.totalDurationSec - elapsedSec))}
            </span>
          </div>
        </div>
      </div>

      {/* ERG Controls & Interval Info */}
      <div
        className="pixel-panel"
        style={{
          padding: '10px 14px',
          marginBottom: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>CURRENT BLOCK</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              {activeBlock ? activeBlock.block.name : selectedWorkout.name}{' '}
              <span style={{ color: 'var(--accent)' }}>
                ({activeBlock ? formatClock(activeBlock.blockRemainingSec) : '--'})
              </span>
            </div>
          </div>
          {nextBlock && (
            <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>NEXT</div>
              <div style={{ fontSize: 12, color: 'var(--text)' }}>
                {nextBlock.name} ({Math.round(nextBlock.startPowerPct * ftp * (biasPct / 100))}W)
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            className={`pixel-btn ${autoPauseEnabled ? 'pixel-btn-primary' : ''}`}
            style={{ padding: '4px 8px', fontSize: 11 }}
            onClick={() => setAutoPauseEnabled((a) => !a)}
            title="Auto-pause when coasting (0 RPM)"
          >
            Auto-Pause: {autoPauseEnabled ? 'ON' : 'OFF'}
          </button>

          {/* Bias or Manual Free Ride Watts controls */}
          {isFreeRide ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'var(--panel-alt)',
                border: '2px solid var(--border-bright)',
                padding: '3px 6px',
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--muted)', marginRight: 2 }}>ERG</span>
              <button
                className="pixel-btn"
                style={{ padding: '2px 6px' }}
                onClick={() => setManualWatts((w) => Math.max(50, w - 10))}
              >
                <Minus size={12} />
              </button>
              <span style={{ minWidth: 48, textAlign: 'center', fontWeight: 700 }}>
                {manualWatts}W
              </span>
              <button
                className="pixel-btn"
                style={{ padding: '2px 6px' }}
                onClick={() => setManualWatts((w) => Math.min(800, w + 10))}
              >
                <Plus size={12} />
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                background: 'var(--panel-alt)',
                border: '2px solid var(--border-bright)',
                padding: '3px 6px',
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--muted)', marginRight: 2 }}>ERG</span>
              <button
                className="pixel-btn"
                style={{ padding: '2px 6px' }}
                onClick={() => setBiasPct((b) => Math.max(70, b - 5))}
              >
                <Minus size={12} />
              </button>
              <span style={{ minWidth: 40, textAlign: 'center', fontWeight: 700 }}>{biasPct}%</span>
              <button
                className="pixel-btn"
                style={{ padding: '2px 6px' }}
                onClick={() => setBiasPct((b) => Math.min(130, b + 5))}
              >
                <Plus size={12} />
              </button>
            </div>
          )}

          <button
            className="pixel-btn"
            onClick={() => handleJumpBlock(-1)}
            disabled={rideState === 'idle'}
            title="Previous Block"
          >
            <SkipBack size={14} />
          </button>

          {rideState === 'running' ? (
            <button className="pixel-btn pixel-btn-primary" onClick={handlePause}>
              <Pause size={14} /> Pause
            </button>
          ) : (
            <button className="pixel-btn pixel-btn-success" onClick={handleStart}>
              <Play size={14} /> {rideState === 'paused' ? 'Resume' : 'Start Ride'}
            </button>
          )}

          <button
            className="pixel-btn"
            onClick={() => handleJumpBlock(1)}
            disabled={rideState === 'idle'}
            title="Skip Block"
          >
            <SkipForward size={14} />
          </button>

          <button
            className="pixel-btn pixel-btn-danger"
            onClick={handleEndRide}
            disabled={rideState === 'idle' && samples.length === 0}
          >
            <Square size={14} /> End &amp; Save
          </button>
        </div>
      </div>

      {/* Workout Profile */}
      <div style={{ marginBottom: 16 }}>
        <WorkoutProfile
          workout={selectedWorkout}
          elapsedSec={elapsedSec}
          ftp={ftp}
          biasPct={biasPct}
          samples={samples}
          height={110}
        />
      </div>

      {/* Workout Library */}
      <WorkoutLibrary
        workouts={workouts}
        selectedId={selectedWorkout.id}
        ftp={ftp}
        onSelect={handleSelectWorkout}
        onImport={(w) => {
          setCustomWorkouts((prev) => [w, ...prev]);
          handleSelectWorkout(w);
        }}
        onOpenBuilder={() => setShowBuilder(true)}
        onOpenAiGenerator={() => setShowAiModal(true)}
        onDeleteCustom={(id) => {
          setCustomWorkouts((prev) => prev.filter((w) => w.id !== id));
          if (selectedWorkout.id === id) {
            handleSelectWorkout(WORKOUT_LIBRARY[0]);
          }
        }}
      />

      {showAiModal && (
        <AiWorkoutModal
          ftp={ftp}
          onSelectAndSave={(w) => {
            setCustomWorkouts((prev) => [w, ...prev]);
            handleSelectWorkout(w);
            setShowAiModal(false);
          }}
          onClose={() => setShowAiModal(false)}
        />
      )}

      {showBuilder && (
        <WorkoutBuilderModal
          onSave={(w) => {
            setCustomWorkouts((prev) => [w, ...prev]);
            handleSelectWorkout(w);
            setShowBuilder(false);
          }}
          onClose={() => setShowBuilder(false)}
        />
      )}

      {showHistory && (
        <RideHistoryModal
          rides={rideHistory}
          onDelete={(id) => setRideHistory(deleteRideFromHistory(id))}
          onClose={() => setShowHistory(false)}
        />
      )}

      {showSummary && (
        <RideSummaryModal
          workoutId={selectedWorkout.id}
          workoutName={selectedWorkout.name}
          samples={samples}
          startTimeIso={startTimeIso}
          ftp={ftp}
          onApplyFtp={(newFtp) => {
            setFtp(newFtp);
            setFtpInput(String(newFtp));
          }}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}

export default App;
