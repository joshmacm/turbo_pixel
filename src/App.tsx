import { useEffect, useRef, useState } from 'react';
import {
  Bluetooth,
  Heart,
  Play,
  Pause,
  Square,
  SkipForward,
  SkipBack,
  Cpu,
  Minus,
  Plus,
} from 'lucide-react';
import { FtmsTrainer } from './ble/ftms';
import { HeartRateMonitor } from './ble/heartRate';
import { RideSimulator } from './ble/simulator';
import { PixelCanvas, SCENES, type SceneId } from './components/PixelCanvas';
import { WorkoutProfile } from './components/WorkoutProfile';
import { WorkoutLibrary } from './components/WorkoutLibrary';
import { RideSummaryModal } from './components/RideSummaryModal';
import { WORKOUT_LIBRARY } from './workouts/library';
import { getActiveBlockAtTime, getBlockStartTime } from './workouts/engine';
import { getZoneForPct } from './workouts/zones';
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

  const [workouts, setWorkouts] = useState<Workout[]>(WORKOUT_LIBRARY);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout>(WORKOUT_LIBRARY[0]);
  const [scene, setScene] = useState<SceneId>(() => {
    const saved = localStorage.getItem('pp_scene') as SceneId | null;
    return saved && SCENES.some((s) => s.id === saved) ? saved : 'bristol';
  });

  // Device state
  const [trainerConnected, setTrainerConnected] = useState(false);
  const [trainerName, setTrainerName] = useState('');
  const [hrConnected, setHrConnected] = useState(false);
  const [hrName, setHrName] = useState('');
  const [simEnabled, setSimEnabled] = useState(false);
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
  const [samples, setSamples] = useState<TelemetrySample[]>([]);
  const [startTimeIso, setStartTimeIso] = useState<string>(() => new Date().toISOString());
  const [showSummary, setShowSummary] = useState(false);

  // Refs for 1Hz loop & BLE instances
  const trainerRef = useRef<FtmsTrainer | null>(null);
  const hrmRef = useRef<HeartRateMonitor | null>(null);
  const simRef = useRef<RideSimulator>(new RideSimulator());
  const lastSentTargetRef = useRef<number>(-1);
  const distanceMetersRef = useRef<number>(0);

  const liveRef = useRef({
    powerWatts: 0,
    cadenceRpm: 0,
    speedKmh: 0,
    heartRateBpm: 0,
  });
  liveRef.current = { powerWatts, cadenceRpm, speedKmh, heartRateBpm };

  useEffect(() => {
    localStorage.setItem('pp_ftp', String(ftp));
    simRef.current.setFtp(ftp);
  }, [ftp]);

  useEffect(() => {
    localStorage.setItem('pp_scene', scene);
  }, [scene]);

  // Connect / Disconnect Saris H3 (FTMS)
  const toggleTrainer = async () => {
    setBleError(null);
    if (trainerConnected) {
      trainerRef.current?.disconnect();
      return;
    }
    try {
      if (simEnabled) setSimEnabled(false);
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
      if (simEnabled) setSimEnabled(false);
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

  const toggleSimulator = () => {
    setBleError(null);
    if (!simEnabled) {
      if (trainerConnected) trainerRef.current?.disconnect();
      if (hrConnected) hrmRef.current?.disconnect();
      setSimEnabled(true);
    } else {
      setSimEnabled(false);
      setPowerWatts(0);
      setCadenceRpm(0);
      setSpeedKmh(0);
      setHeartRateBpm(0);
    }
  };

  const activeBlock = getActiveBlockAtTime(selectedWorkout, elapsedSec, ftp, biasPct);
  const targetWatts = activeBlock ? activeBlock.targetWatts : Math.round(ftp * 0.5);
  const nextBlock =
    activeBlock && activeBlock.blockIndex + 1 < selectedWorkout.blocks.length
      ? selectedWorkout.blocks[activeBlock.blockIndex + 1]
      : null;

  // 1Hz workout & simulator loop
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (simEnabled) {
        simRef.current.setTargetPower(targetWatts);
        const sim = simRef.current.tick(rideState !== 'running');
        setPowerWatts(sim.powerWatts);
        setCadenceRpm(sim.cadenceRpm);
        setSpeedKmh(sim.speedKmh);
        setHeartRateBpm(sim.heartRateBpm);
        liveRef.current = sim;
      }

      if (rideState !== 'running') return;

      // Send ERG target power to physical trainer when it changes (or every 5s keepalive)
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
        setSamples((s) => [...s, sample]);

        if (next >= selectedWorkout.totalDurationSec) {
          setRideState('paused');
          setShowSummary(true);
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [rideState, simEnabled, trainerConnected, targetWatts, selectedWorkout.totalDurationSec]);

  const handleStart = () => {
    if (rideState === 'idle') {
      setElapsedSec(0);
      setSamples([]);
      distanceMetersRef.current = 0;
      lastSentTargetRef.current = -1;
      setStartTimeIso(new Date().toISOString());
    }
    trainerRef.current?.resume();
    setRideState('running');
  };

  const handlePause = () => {
    trainerRef.current?.pause();
    setRideState('paused');
  };

  const handleEndRide = () => {
    trainerRef.current?.pause();
    setRideState('idle');
    if (samples.length > 0) {
      setShowSummary(true);
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

  const zone = getZoneForPct(ftp > 0 ? powerWatts / ftp : 0);

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
            className={`pixel-btn ${simEnabled ? 'pixel-btn-primary' : ''}`}
            onClick={toggleSimulator}
            title="Simulate trainer & HRM data for testing"
          >
            <Cpu size={14} />
            {simEnabled ? 'Sim: ON' : 'Sim'}
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
          iOS) to pair your Saris H3 &amp; Coospo HRM. Simulator mode &amp; .TCX export work here.
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
          powerWatts={powerWatts}
          ftp={ftp}
          isPaused={rideState !== 'running'}
          distanceMeters={distanceMetersRef.current}
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
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
            POWER / TARGET (ERG)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: zone.color }}>
              {powerWatts}
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
          {/* Bias controls */}
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
          setWorkouts((prev) => [w, ...prev]);
          handleSelectWorkout(w);
        }}
      />

      {showSummary && (
        <RideSummaryModal
          workoutName={selectedWorkout.name}
          samples={samples}
          startTimeIso={startTimeIso}
          ftp={ftp}
          onClose={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}

export default App;
