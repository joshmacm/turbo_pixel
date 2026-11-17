import React, { useEffect, useRef } from 'react';
import { getZoneForPct } from '../workouts/zones';

export type SceneId = 'bristol' | 'swansea' | 'brecon' | 'devon' | 'girona' | 'belgium';

export const SCENES: { id: SceneId; label: string }[] = [
  { id: 'bristol', label: 'Bristol' },
  { id: 'swansea', label: 'Swansea' },
  { id: 'brecon', label: 'Brecon Beacons' },
  { id: 'devon', label: 'Devon' },
  { id: 'girona', label: 'Girona' },
  { id: 'belgium', label: 'Belgium' },
];

interface PixelCanvasProps {
  scene: SceneId;
  speedKmh: number;
  cadenceRpm: number;
  powerWatts: number;
  ftp: number;
  isPaused: boolean;
  distanceMeters: number;
}

const W = 320;
const H = 136;

export const PixelCanvas: React.FC<PixelCanvasProps> = ({
  scene,
  speedKmh,
  cadenceRpm,
  powerWatts,
  ftp,
  isPaused,
  distanceMeters,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({
    scene,
    speedKmh,
    cadenceRpm,
    powerWatts,
    ftp,
    isPaused,
    distanceMeters,
  });

  stateRef.current = {
    scene,
    speedKmh,
    cadenceRpm,
    powerWatts,
    ftp,
    isPaused,
    distanceMeters,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTime = performance.now();
    let worldX = 0;
    let pedalAngle = 0;
    let cloudX = 0;

    const rect = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    };

    const drawCloud = (x: number, y: number, tint = '#ffffff') => {
      rect(x + 4, y, 14, 4, tint);
      rect(x, y + 3, 22, 5, tint);
      rect(x + 2, y + 7, 18, 2, '#dbeafe');
    };

    const drawLinePixels = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      color: string,
      thickness = 1
    ) => {
      ctx.fillStyle = color;
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= steps; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / steps);
        const y = Math.round(y0 + ((y1 - y0) * i) / steps);
        ctx.fillRect(x, y, thickness, thickness);
      }
    };

    const drawWheel = (cx: number, cy: number, r: number, angle: number) => {
      ctx.fillStyle = '#0f172a';
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 <= r * r && d2 >= (r - 2) * (r - 2)) {
            ctx.fillRect(cx + dx, cy + dy, 1, 1);
          }
        }
      }
      ctx.fillStyle = '#94a3b8';
      const inner = r - 2;
      for (let dy = -inner; dy <= inner; dy++) {
        for (let dx = -inner; dx <= inner; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 <= inner * inner && d2 >= (inner - 1) * (inner - 1)) {
            ctx.fillRect(cx + dx, cy + dy, 1, 1);
          }
        }
      }
      ctx.fillStyle = '#cbd5e1';
      for (let i = 0; i < 4; i++) {
        const a = angle + (i * Math.PI) / 2;
        for (let t = 1; t < r - 2; t += 1) {
          ctx.fillRect(Math.round(cx + Math.cos(a) * t), Math.round(cy + Math.sin(a) * t), 1, 1);
        }
      }
      rect(cx - 1, cy - 1, 3, 3, '#f8fafc');
    };

    const drawBristol = () => {
      // Sky
      rect(0, 0, W, 32, '#38bdf8');
      rect(0, 32, W, 32, '#7dd3fc');
      rect(0, 64, W, 36, '#bae6fd');
      // Sun
      rect(270, 12, 14, 14, '#facc15');
      rect(272, 14, 10, 10, '#fef08a');
      // Clouds & Hot air balloon
      for (let i = 0; i < 3; i++) {
        const cx = ((i * 110 - cloudX) % (W + 40) + (W + 40)) % (W + 40) - 30;
        drawCloud(cx, 12 + (i % 2) * 14);
      }
      const bx = ((210 - cloudX * 0.6) % (W + 30) + (W + 30)) % (W + 30) - 15;
      rect(bx + 2, 24, 8, 8, '#ef4444');
      rect(bx + 4, 24, 4, 8, '#facc15');
      rect(bx + 3, 32, 6, 2, '#fb923c');
      rect(bx + 5, 35, 2, 2, '#78350f');

      // Avon Gorge + Clifton Suspension Bridge (parallax 0.25x)
      const bridgeOff = (worldX * 0.22) % 360;
      const brX = 160 - bridgeOff + (bridgeOff > 220 ? 360 : 0);

      // Distant green hills behind gorge
      rect(0, 84, W, 14, '#4d7c0f');

      // River Avon in the bottom of the gorge
      rect(brX - 36, 90, 72, 8, '#0284c7');

      // Steep limestone Avon Gorge cliffs extending across the full frame
      for (let step = 0; step < 26; step += 2) {
        const cliffH = 26 - step;
        const leftEnd = brX - 34 - step * 0.5;
        if (leftEnd > 0) {
          rect(0, 96 - cliffH, leftEnd, 2, cliffH > 20 ? '#3f6212' : '#a8a29e');
        }
        const rightStart = brX + 34 + step * 0.5;
        if (rightStart < W) {
          rect(rightStart, 96 - cliffH, W - rightStart, 2, cliffH > 20 ? '#3f6212' : '#78716c');
        }
      }
      // Stone cliff abutments directly under the towers
      rect(brX - 42, 72, 14, 24, '#78716c');
      rect(brX + 28, 72, 14, 24, '#78716c');

      // Bridge deck & towers anchored to the gorge cliffs
      rect(brX - 58, 72, 116, 2, '#475569');
      rect(brX - 38, 52, 8, 22, '#d6d3d1');
      rect(brX + 30, 52, 8, 22, '#d6d3d1');
      drawLinePixels(brX - 58, 72, brX - 34, 53, '#334155', 1);
      drawLinePixels(brX - 34, 53, brX, 68, '#334155', 1);
      drawLinePixels(brX, 68, brX + 34, 53, '#334155', 1);
      drawLinePixels(brX + 34, 53, brX + 58, 72, '#334155', 1);

      // Colourful Clifton / Harbourside terraced houses (parallax 0.6x)
      rect(0, 96, W, 10, '#65a30d');
      const houseColors = ['#f472b6', '#fbbf24', '#38bdf8', '#fb7185', '#a78bfa', '#34d399'];
      const hOff = (worldX * 0.6) % 144;
      for (let i = -1; i < 4; i++) {
        for (let k = 0; k < 6; k++) {
          const hx = i * 144 + k * 24 - hOff;
          const col = houseColors[k % houseColors.length];
          rect(hx, 82, 22, 22, col);
          rect(hx - 1, 79, 24, 3, '#475569'); // slate roof
          rect(hx + 4, 86, 4, 5, '#fef9c3');
          rect(hx + 13, 86, 4, 5, '#fef9c3');
          rect(hx + 8, 96, 5, 8, '#1e293b');
        }
      }
    };

    const drawSwansea = () => {
      // Crisp coastal sky
      rect(0, 0, W, 34, '#0ea5e9');
      rect(0, 34, W, 32, '#38bdf8');
      rect(0, 66, W, 20, '#bae6fd');
      rect(266, 12, 14, 14, '#fde047');
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 92 - cloudX) % (W + 40) + (W + 40)) % (W + 40) - 30;
        drawCloud(cx, 12 + (i % 2) * 12);
      }

      // Port Talbot Steelworks across Swansea Bay (far horizon, parallax 0.08x)
      const ptOff = (worldX * 0.08) % 360;
      const ptX = 215 - ptOff + (ptOff > 260 ? 360 : 0);
      // Distant Margam hills behind the steelworks
      rect(ptX - 24, 76, 86, 10, '#64748b');
      // Blast furnaces, sheds & tall stacks
      rect(ptX - 12, 74, 22, 12, '#475569');
      rect(ptX + 14, 77, 26, 9, '#334155');
      rect(ptX + 42, 79, 14, 7, '#475569');
      rect(ptX - 6, 63, 3, 12, '#334155');  // Chimney 1
      rect(ptX + 4, 65, 3, 10, '#334155');  // Chimney 2
      rect(ptX + 22, 62, 3, 16, '#1e293b'); // Tall stack
      rect(ptX + 32, 66, 3, 12, '#334155'); // Chimney 4
      // Pixel steam plumes drifting right
      rect(ptX - 5, 59, 6, 3, '#e2e8f0');
      rect(ptX + 5, 61, 5, 3, '#f1f5f9');
      rect(ptX + 23, 57, 8, 4, '#ffffff');
      rect(ptX + 33, 62, 6, 3, '#e2e8f0');

      // Mumbles Headland & Lighthouse connected to the shore (parallax 0.14x)
      const mOff = (worldX * 0.14) % 380;
      const mx = 75 - mOff + (mOff > 120 ? 380 : 0);
      // Sweeping headland connecting from the left edge out to Mumbles Point
      if (mx > 0) {
        rect(0, 74, mx, 12, '#15803d');
        rect(0, 70, Math.max(0, mx - 18), 5, '#16a34a');
      }
      // Rocky Mumbles Point & Lighthouse
      rect(mx - 4, 78, 18, 8, '#78716c');
      rect(mx + 2, 74, 10, 5, '#16a34a');
      rect(mx + 6, 58, 5, 16, '#ffffff'); // White lighthouse tower
      rect(mx + 5, 55, 7, 3, '#ef4444');  // Red lantern room

      // Swansea Bay Sea
      rect(0, 86, W, 13, '#0284c7');
      const waveOff = (worldX * 0.35) % 24;
      for (let i = -1; i < 15; i++) {
        rect(i * 24 - waveOff, 90 + (i % 2) * 3, 8, 1, '#bae6fd');
      }

      // Sandy beach & Promenade wall
      rect(0, 99, W, 5, '#fde68a');
      rect(0, 102, W, 4, '#cbd5e1');
      const postOff = (worldX * 0.7) % 48;
      for (let i = -1; i < 8; i++) {
        const px = i * 48 - postOff;
        rect(px, 95, 2, 8, '#475569');
        rect(px - 1, 93, 4, 2, '#fef08a');
      }
    };

    const drawBrecon = () => {
      // Highland sky
      rect(0, 0, W, 34, '#38bdf8');
      rect(0, 34, W, 34, '#7dd3fc');
      rect(0, 68, W, 30, '#e0f2fe');
      rect(54, 14, 14, 14, '#fde047');
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 95 - cloudX) % (W + 40) + (W + 40)) % (W + 40) - 30;
        drawCloud(cx, 14 + (i % 2) * 14);
      }

      // Pen y Fan flat-topped peaks (parallax 0.18x)
      const pOff = (worldX * 0.16) % 160;
      for (let i = -1; i < 4; i++) {
        const px = i * 160 - pOff;
        for (let h = 0; h < 42; h += 2) {
          const span = 30 + (42 - h) * 2.6;
          rect(px + 80 - span / 2, 94 - h, span, 2, h > 30 ? '#64748b' : '#4d7c0f');
        }
      }

      // Moorland heather & mossy hills (0.5x)
      rect(0, 92, W, 10, '#65a30d');
      const hOff = (worldX * 0.5) % 40;
      for (let i = -1; i < 10; i++) {
        rect(i * 40 - hOff, 94, 14, 4, '#9333ea'); // Heather patches
        if (i % 2 === 0) {
          // Pixel sheep!
          const sx = i * 40 - hOff + 22;
          rect(sx, 95, 6, 4, '#f8fafc');
          rect(sx + 5, 96, 2, 2, '#1e293b');
        }
      }

      // Dry-stone wall
      rect(0, 100, W, 6, '#94a3b8');
      const stoneOff = (worldX * 0.8) % 12;
      for (let i = -1; i < 30; i++) {
        rect(i * 12 - stoneOff, 101, 5, 2, '#64748b');
        rect(i * 12 - stoneOff + 4, 103, 5, 2, '#cbd5e1');
      }
    };

    const drawDevon = () => {
      // Soft Devon summer sky
      rect(0, 0, W, 34, '#38bdf8');
      rect(0, 34, W, 32, '#7dd3fc');
      rect(0, 66, W, 32, '#bae6fd');
      rect(268, 12, 14, 14, '#facc15');
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 90 - cloudX) % (W + 40) + (W + 40)) % (W + 40) - 30;
        drawCloud(cx, 12 + (i % 2) * 14);
      }

      // Rolling patchwork green hills (0.2x)
      const hillOff = (worldX * 0.2) % 120;
      for (let i = -1; i < 5; i++) {
        const hx = i * 120 - hillOff;
        rect(hx, 82, 120, 20, i % 2 === 0 ? '#4ade80' : '#22c55e');
        rect(hx + 20, 76, 80, 8, '#16a34a');
      }

      // Chulmleigh Village: Church spire, thatched cottages & village sign (0.65x)
      const vOff = (worldX * 0.65) % 240;
      for (let i = -1; i < 3; i++) {
        const vx = i * 240 - vOff;
        // Stone church + spire
        rect(vx + 30, 78, 20, 24, '#d6d3d1');
        rect(vx + 36, 66, 8, 14, '#a8a29e');
        for (let s = 0; s < 14; s += 2) {
          rect(vx + 40 - (14 - s) / 4, 52 + s, Math.max(2, (14 - s) / 2), 2, '#57534e');
        }
        // Thatched cottage
        rect(vx + 76, 88, 24, 14, '#fef3c7');
        rect(vx + 74, 82, 28, 7, '#b45309');
        rect(vx + 85, 94, 5, 8, '#78350f');
        // Oak tree
        rect(vx + 130, 90, 4, 12, '#78350f');
        rect(vx + 122, 78, 20, 14, '#15803d');
        // CHULMLEIGH sign
        rect(vx + 168, 94, 2, 10, '#475569');
        rect(vx + 152, 87, 36, 8, '#ffffff');
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 5px monospace';
        ctx.fillText('CHULMLEIGH', Math.round(vx + 154), 93);
      }

      // Devon hedgerow
      rect(0, 100, W, 6, '#15803d');
    };

    const drawGirona = () => {
      // Warm Mediterranean sky
      rect(0, 0, W, 32, '#0284c7');
      rect(0, 32, W, 34, '#38bdf8');
      rect(0, 66, W, 32, '#fef08a');
      rect(264, 12, 16, 16, '#fb923c');
      rect(266, 14, 12, 12, '#fde047');
      for (let i = 0; i < 3; i++) {
        const cx = ((i * 115 - cloudX) % (W + 40) + (W + 40)) % (W + 40) - 30;
        drawCloud(cx, 14 + (i % 2) * 12);
      }

      // Pyrenees foothills (0.18x)
      const pyOff = (worldX * 0.18) % 100;
      for (let i = -1; i < 5; i++) {
        const mx = i * 100 - pyOff;
        for (let h = 0; h < 28; h += 2) {
          const span = (28 - h) * 3.0;
          rect(mx + 50 - span / 2, 94 - h, span, 2, '#94a3b8');
        }
      }

      // Girona Onyar Riverfront & Cathedral (0.55x)
      const gOff = (worldX * 0.55) % 180;
      const facadeColors = ['#fb923c', '#facc15', '#f87171', '#fde68a', '#ea580c'];
      for (let i = -1; i < 3; i++) {
        const gx = i * 180 - gOff;
        // Cathedral bell tower
        rect(gx + 18, 62, 14, 40, '#e7e5e4');
        rect(gx + 21, 52, 8, 10, '#d6d3d1');
        // Terracotta riverfront buildings
        for (let b = 0; b < 5; b++) {
          const bx = gx + 42 + b * 22;
          rect(bx, 78 + (b % 2) * 4, 21, 24, facadeColors[b % facadeColors.length]);
          rect(bx - 1, 75 + (b % 2) * 4, 23, 3, '#9a3412');
          rect(bx + 5, 84 + (b % 2) * 4, 3, 5, '#451a03');
          rect(bx + 13, 84 + (b % 2) * 4, 3, 5, '#451a03');
        }
        // Cypress tree
        rect(gx + 162, 74, 5, 28, '#14532d');
        rect(gx + 163, 70, 3, 6, '#166534');
      }
      rect(0, 102, W, 4, '#d6d3d1');
    };

    const drawBelgium = () => {
      // Crisp Flemish spring sky
      rect(0, 0, W, 32, '#38bdf8');
      rect(0, 32, W, 34, '#7dd3fc');
      rect(0, 66, W, 32, '#e0f2fe');
      rect(268, 12, 14, 14, '#fde047');
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 95 - cloudX) % (W + 40) + (W + 40)) % (W + 40) - 30;
        drawCloud(cx, 12 + (i % 2) * 14);
      }

      // Far Flemish fields & windmill (0.2x)
      rect(0, 88, W, 12, '#65a30d');
      const mOff = (worldX * 0.2) % 220;
      for (let i = -1; i < 3; i++) {
        const mx = i * 220 - mOff;
        // Windmill tower & sails
        rect(mx + 60, 72, 10, 20, '#d6d3d1');
        rect(mx + 62, 68, 6, 4, '#9a3412');
        drawLinePixels(mx + 56, 63, mx + 74, 81, '#78350f', 1);
        drawLinePixels(mx + 74, 63, mx + 56, 81, '#78350f', 1);
      }

      // Roadside cafés, stepped-gable brick houses, Belgian flags & beer! (0.6x)
      const bOff = (worldX * 0.6) % 190;
      for (let i = -1; i < 3; i++) {
        const bx = i * 190 - bOff;

        // Stepped-gable Flemish brick house
        rect(bx + 14, 78, 28, 28, '#b45309');
        rect(bx + 18, 72, 20, 6, '#92400e');
        rect(bx + 23, 67, 10, 5, '#78350f');
        rect(bx + 19, 84, 5, 6, '#fef3c7');
        rect(bx + 31, 84, 5, 6, '#fef3c7');
        rect(bx + 25, 96, 6, 10, '#451a03');

        // Café with awning & giant pixel beer sign
        rect(bx + 62, 82, 34, 24, '#fef3c7');
        rect(bx + 60, 78, 38, 4, '#991b1b');
        rect(bx + 62, 91, 34, 3, '#dc2626'); // Café awning
        // Frothy beer goblet sign on roof/wall
        rect(bx + 104, 85, 7, 10, '#f59e0b'); // Amber beer
        rect(bx + 103, 82, 9, 3, '#ffffff');  // Frothy head
        rect(bx + 111, 87, 2, 5, '#cbd5e1');  // Handle

        // Belgian tricolour flag (Black | Yellow | Red) on flagpole
        rect(bx + 132, 68, 2, 38, '#475569');
        rect(bx + 134, 68, 4, 10, '#0f172a');
        rect(bx + 138, 68, 4, 10, '#facc15');
        rect(bx + 142, 68, 4, 10, '#dc2626');

        // Lion of Flanders yellow flag further along
        rect(bx + 162, 74, 2, 32, '#475569');
        rect(bx + 164, 74, 10, 8, '#facc15');
        rect(bx + 167, 76, 4, 4, '#0f172a');
      }
    };

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const s = stateRef.current;
      const activeSpeed = s.isPaused ? 0 : Math.max(0, s.speedKmh);
      const activeCadence = s.isPaused ? 0 : Math.max(0, s.cadenceRpm);

      worldX += activeSpeed * 2.2 * dt;
      cloudX += (4 + activeSpeed * 0.15) * dt;
      pedalAngle += (activeCadence / 60) * Math.PI * 2 * dt;

      const pct = s.ftp > 0 ? s.powerWatts / s.ftp : 0;
      const zone = getZoneForPct(pct);

      // Draw selected scene
      if (s.scene === 'bristol') drawBristol();
      else if (s.scene === 'swansea') drawSwansea();
      else if (s.scene === 'brecon') drawBrecon();
      else if (s.scene === 'devon') drawDevon();
      else if (s.scene === 'belgium') drawBelgium();
      else drawGirona();

      // Road (cobbles in Belgium, asphalt elsewhere)
      rect(0, 106, W, 3, '#cbd5e1');
      if (s.scene === 'belgium') {
        rect(0, 109, W, 27, '#57534e');
        const cobOff = worldX % 12;
        const cobColors = ['#78716c', '#a8a29e', '#64748b'];
        for (let row = 0; row < 4; row++) {
          const rowShift = (row % 2) * 6;
          for (let col = -1; col < 29; col++) {
            const cx = col * 12 + rowShift - cobOff;
            const cy = 110 + row * 6;
            rect(cx, cy, 9, 4, cobColors[(col + row + 30) % cobColors.length]);
          }
        }
      } else {
        rect(0, 109, W, 27, '#475569');
        const dashOffset = worldX % 28;
        for (let i = -1; i < 14; i++) {
          rect(i * 28 - dashOffset, 121, 14, 2, '#fde047');
        }
      }

      // Pixel Cyclist (subtle cobble bounce in Belgium when moving)
      const cobbleBounce =
        s.scene === 'belgium' && !s.isPaused && activeCadence > 10
          ? Math.round(Math.sin(now * 0.045))
          : 0;
      const bikeX = 96;
      const rearWheelX = bikeX - 15;
      const frontWheelX = bikeX + 17;
      const wheelY = 109 + cobbleBounce;
      const wheelRot = worldX * 0.22;

      drawWheel(rearWheelX, wheelY, 10, wheelRot);
      drawWheel(frontWheelX, wheelY, 10, wheelRot);

      const frameColor = zone.color;
      const bbX = bikeX - 1;
      const bbY = 109;
      const seatClusterX = bikeX - 6;
      const seatClusterY = 95;
      const headTubeTopX = bikeX + 11;
      const headTubeTopY = 93;

      drawLinePixels(rearWheelX, wheelY, bbX, bbY, frameColor, 2);
      drawLinePixels(rearWheelX, wheelY, seatClusterX, seatClusterY, frameColor, 1);
      drawLinePixels(bbX, bbY, seatClusterX, seatClusterY, frameColor, 2);
      drawLinePixels(bbX, bbY, headTubeTopX, headTubeTopY, frameColor, 2);
      drawLinePixels(seatClusterX, seatClusterY, headTubeTopX, headTubeTopY, frameColor, 2);
      drawLinePixels(headTubeTopX, headTubeTopY, frontWheelX, wheelY, '#e2e8f0', 2);

      rect(seatClusterX - 4, seatClusterY - 3, 7, 2, '#0f172a');
      drawLinePixels(headTubeTopX, headTubeTopY, headTubeTopX + 3, headTubeTopY - 3, '#cbd5e1', 2);
      rect(headTubeTopX + 2, headTubeTopY - 3, 4, 3, '#94a3b8');

      const crankR = 5;
      const backFootX = bbX + Math.cos(pedalAngle + Math.PI) * crankR;
      const backFootY = bbY + Math.sin(pedalAngle + Math.PI) * crankR;
      const hipX = seatClusterX - 1;
      const hipY = seatClusterY - 4;
      const backKneeX = (hipX + backFootX) / 2 + 3;
      const backKneeY = (hipY + backFootY) / 2 - 4;
      drawLinePixels(hipX, hipY, backKneeX, backKneeY, '#334155', 2);
      drawLinePixels(backKneeX, backKneeY, backFootX, backFootY, '#64748b', 2);

      const shoulderX = hipX + 10;
      const shoulderY = hipY - 10;
      drawLinePixels(hipX, hipY, shoulderX, shoulderY, frameColor, 4);
      drawLinePixels(shoulderX, shoulderY, headTubeTopX + 3, headTubeTopY - 2, '#f1c27d', 2);

      rect(shoulderX + 1, shoulderY - 8, 7, 6, '#f1c27d');
      rect(shoulderX, shoulderY - 10, 9, 4, '#f8fafc');
      rect(shoulderX + 1, shoulderY - 9, 7, 1, zone.color);

      const frontFootX = bbX + Math.cos(pedalAngle) * crankR;
      const frontFootY = bbY + Math.sin(pedalAngle) * crankR;
      const frontKneeX = (hipX + frontFootX) / 2 + 4;
      const frontKneeY = (hipY + frontFootY) / 2 - 4;
      drawLinePixels(hipX, hipY, frontKneeX, frontKneeY, '#0f172a', 3);
      drawLinePixels(frontKneeX, frontKneeY, frontFootX, frontFootY, '#f1c27d', 2);
      rect(frontFootX - 1, frontFootY - 1, 4, 2, '#ffffff');

      if (!s.isPaused && pct >= 0.9 && activeCadence > 20) {
        const pulse = Math.floor(now / 120) % 3;
        rect(bikeX - 30 - pulse * 5, 92, 8, 1, zone.color);
        rect(bikeX - 26 - pulse * 4, 98, 6, 1, '#94a3b8');
        if (pct >= 1.05 && pulse === 0) {
          rect(shoulderX + 2, shoulderY - 13, 1, 2, '#38bdf8');
        }
      }

      // Zone badge top-left
      rect(6, 6, 62, 12, 'rgba(15, 23, 42, 0.85)');
      ctx.strokeStyle = zone.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(6.5, 6.5, 61, 11);
      ctx.fillStyle = zone.color;
      ctx.font = 'bold 7px monospace';
      ctx.fillText(zone.name.toUpperCase().slice(0, 10), 10, 14);

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="pixel-panel" style={{ overflow: 'hidden', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="pixelated"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          aspectRatio: `${W} / ${H}`,
        }}
      />
    </div>
  );
};
