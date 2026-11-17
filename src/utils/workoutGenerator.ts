import { computeTotalDuration, estimateTss } from '../workouts/engine';
import type { Workout, WorkoutBlock, WorkoutCategory } from '../workouts/types';

function makeGeneratedWorkout(
  suffix: string,
  name: string,
  category: WorkoutCategory,
  description: string,
  blocks: Omit<WorkoutBlock, 'id'>[]
): Workout {
  const id = `ai-${Date.now()}-${suffix}`;
  const withIds: WorkoutBlock[] = blocks.map((b, i) => ({
    ...b,
    id: `${id}-b${i}`,
  }));
  return {
    id,
    name,
    category,
    description,
    blocks: withIds,
    totalDurationSec: computeTotalDuration(withIds),
    tssApprox: estimateTss(withIds),
  };
}

function parseRequestedMinutes(prompt: string): number {
  const hrMatch = prompt.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
  if (hrMatch) {
    return Math.max(15, Math.min(180, Math.round(Number(hrMatch[1]) * 60)));
  }
  const minMatch = prompt.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/i);
  if (minMatch) {
    return Math.max(15, Math.min(180, Number(minMatch[1])));
  }
  if (/quick|short|lunch/i.test(prompt)) return 30;
  if (/long|endurance|weekend/i.test(prompt)) return 75;
  return 45;
}

function detectFocus(prompt: string): WorkoutCategory {
  const p = prompt.toLowerCase();
  if (/sprint|tabata|anaerobic|max|neuromuscular|crit|kick/.test(p)) return 'Sprint';
  if (/vo2|attack|punchy|hill|surge|hard|smash|pain/.test(p)) return 'VO2 Max';
  if (/threshold|ftp|tt|time trial|over.?under|race/.test(p)) return 'Threshold';
  if (/sweet\s*spot|ss|climb|alpe|tempo/.test(p)) return 'Sweet Spot';
  if (/recover|easy|flush|z1|z2|base|endurance|coffee|spin/.test(p)) return 'Endurance';
  return 'Sweet Spot';
}

/**
 * Generates 3 tailored workout options from a natural-language description.
 */
export function generateWorkoutsFromPrompt(prompt: string): Workout[] {
  const totalMin = parseRequestedMinutes(prompt);
  const focus = detectFocus(prompt);
  const isLowCadence = /climb|torque|gravel|cadence|big gear/i.test(prompt);
  const isEasy = /easy|recover|light|tired|fresh legs/i.test(prompt);

  const warmupSec = Math.min(480, Math.max(180, Math.round(totalMin * 0.14) * 60));
  const cooldownSec = Math.min(360, Math.max(180, Math.round(totalMin * 0.1) * 60));
  const mainSec = Math.max(300, totalMin * 60 - warmupSec - cooldownSec);

  const warmup: Omit<WorkoutBlock, 'id'> = {
    name: 'Warmup',
    type: 'warmup',
    durationSec: warmupSec,
    startPowerPct: 0.45,
    endPowerPct: focus === 'Endurance' ? 0.65 : 0.76,
    cadenceTarget: 90,
  };
  const cooldown: Omit<WorkoutBlock, 'id'> = {
    name: 'Cooldown',
    type: 'cooldown',
    durationSec: cooldownSec,
    startPowerPct: 0.60,
    endPowerPct: 0.40,
    cadenceTarget: 84,
  };

  if (focus === 'Endurance' || isEasy) {
    const z2Pct = /recover|flush|z1/i.test(prompt) ? 0.54 : 0.69;
    const blocks1: Omit<WorkoutBlock, 'id'>[] = [
      warmup,
      { name: 'Steady Aerobic', type: 'steady', durationSec: mainSec, startPowerPct: z2Pct, endPowerPct: z2Pct, cadenceTarget: 90 },
      cooldown,
    ];
    const reps2 = Math.max(2, Math.floor(mainSec / 480));
    const seg2 = Math.floor(mainSec / reps2);
    const blocks2: Omit<WorkoutBlock, 'id'>[] = [warmup];
    for (let i = 1; i <= reps2; i++) {
      const work = Math.round(seg2 * 0.75);
      const surge = seg2 - work;
      blocks2.push({ name: `Z2 Cruise (${i}/${reps2})`, type: 'steady', durationSec: work, startPowerPct: 0.68, endPowerPct: 0.68, cadenceTarget: 90 });
      blocks2.push({ name: isLowCadence ? 'Torque Surge' : 'Tempo Touch', type: 'steady', durationSec: surge, startPowerPct: 0.80, endPowerPct: 0.80, cadenceTarget: isLowCadence ? 65 : 95 });
    }
    blocks2.push(cooldown);

    const blocks3: Omit<WorkoutBlock, 'id'>[] = [
      warmup,
      { name: 'Progressive Build', type: 'ramp', durationSec: mainSec, startPowerPct: 0.60, endPowerPct: 0.78, cadenceTarget: 90 },
      cooldown,
    ];

    return [
      makeGeneratedWorkout('1', `${totalMin}m Steady Base`, 'Endurance', 'Smooth uninterrupted aerobic cruise.', blocks1),
      makeGeneratedWorkout('2', `${totalMin}m Endurance + Surges`, 'Endurance', 'Base riding with short tempo/torque lifts.', blocks2),
      makeGeneratedWorkout('3', `${totalMin}m Aerobic Progression`, 'Endurance', 'Gradual ramp from Z2 into upper Z3.', blocks3),
    ];
  }

  if (focus === 'Sweet Spot') {
    const reps1 = Math.max(2, Math.min(4, Math.round(mainSec / 720)));
    const cycle1 = Math.floor(mainSec / reps1);
    const on1 = Math.round(cycle1 * 0.78);
    const off1 = cycle1 - on1;
    const blocks1: Omit<WorkoutBlock, 'id'>[] = [warmup];
    for (let i = 1; i <= reps1; i++) {
      blocks1.push({ name: `Sweet Spot (${i}/${reps1})`, type: 'steady', durationSec: on1, startPowerPct: 0.88, endPowerPct: 0.92, cadenceTarget: isLowCadence ? 72 : 90 });
      if (i < reps1 && off1 >= 30) {
        blocks1.push({ name: 'Recovery', type: 'recovery', durationSec: off1, startPowerPct: 0.54, endPowerPct: 0.54, cadenceTarget: 85 });
      }
    }
    blocks1.push(cooldown);

    const blocks2: Omit<WorkoutBlock, 'id'>[] = [
      warmup,
      { name: 'Tempo Build', type: 'steady', durationSec: Math.round(mainSec * 0.35), startPowerPct: 0.84, endPowerPct: 0.88, cadenceTarget: 90 },
      { name: 'Float', type: 'recovery', durationSec: 120, startPowerPct: 0.55, endPowerPct: 0.55, cadenceTarget: 85 },
      { name: 'Sweet Spot Climb', type: 'steady', durationSec: Math.max(180, mainSec - Math.round(mainSec * 0.35) - 120), startPowerPct: 0.90, endPowerPct: 0.94, cadenceTarget: isLowCadence ? 70 : 88 },
      cooldown,
    ];

    const reps3 = Math.max(3, Math.floor(mainSec / 300));
    const step3 = Math.floor(mainSec / reps3);
    const blocks3: Omit<WorkoutBlock, 'id'>[] = [warmup];
    for (let i = 1; i <= reps3; i++) {
      blocks3.push({ name: `SS Cruise (${i}/${reps3})`, type: 'steady', durationSec: step3 - 30, startPowerPct: 0.89, endPowerPct: 0.89, cadenceTarget: 90 });
      blocks3.push({ name: '30s Kick', type: 'interval', durationSec: 30, startPowerPct: 1.10, endPowerPct: 1.10, cadenceTarget: 100 });
    }
    blocks3.push(cooldown);

    return [
      makeGeneratedWorkout('1', `${totalMin}m Sweet Spot ${reps1}x`, 'Sweet Spot', 'Classic 88–92% FTP sweet spot blocks.', blocks1),
      makeGeneratedWorkout('2', `${totalMin}m Progressive Climb`, 'Sweet Spot', 'Two sustained climbing blocks building into 94% FTP.', blocks2),
      makeGeneratedWorkout('3', `${totalMin}m Sweet Spot + Kicks`, 'Sweet Spot', 'Sweet spot tempo with 30s punchy attacks.', blocks3),
    ];
  }

  if (focus === 'Threshold') {
    const reps1 = Math.max(2, Math.min(5, Math.round(mainSec / 600)));
    const cyc1 = Math.floor(mainSec / reps1);
    const on1 = Math.round(cyc1 * 0.72);
    const off1 = cyc1 - on1;
    const blocks1: Omit<WorkoutBlock, 'id'>[] = [warmup];
    for (let i = 1; i <= reps1; i++) {
      blocks1.push({ name: `FTP Block (${i}/${reps1})`, type: 'steady', durationSec: on1, startPowerPct: 0.98, endPowerPct: 1.00, cadenceTarget: 90 });
      if (i < reps1 && off1 >= 30) {
        blocks1.push({ name: 'Rest', type: 'recovery', durationSec: off1, startPowerPct: 0.52, endPowerPct: 0.52, cadenceTarget: 85 });
      }
    }
    blocks1.push(cooldown);

    const ouReps = Math.max(2, Math.floor(mainSec / 480));
    const blocks2: Omit<WorkoutBlock, 'id'>[] = [warmup];
    for (let i = 1; i <= ouReps; i++) {
      blocks2.push({ name: `Under 95% (${i})`, type: 'steady', durationSec: 120, startPowerPct: 0.95, endPowerPct: 0.95, cadenceTarget: 90 });
      blocks2.push({ name: `Over 106% (${i})`, type: 'interval', durationSec: 60, startPowerPct: 1.06, endPowerPct: 1.06, cadenceTarget: 95 });
      blocks2.push({ name: `Under 95% (${i})`, type: 'steady', durationSec: 120, startPowerPct: 0.95, endPowerPct: 0.95, cadenceTarget: 90 });
      if (i < ouReps) {
        blocks2.push({ name: 'Recovery', type: 'recovery', durationSec: 150, startPowerPct: 0.52, endPowerPct: 0.52, cadenceTarget: 85 });
      }
    }
    blocks2.push(cooldown);

    const blocks3: Omit<WorkoutBlock, 'id'>[] = [
      warmup,
      { name: 'Threshold Ramp', type: 'ramp', durationSec: mainSec, startPowerPct: 0.85, endPowerPct: 1.05, cadenceTarget: 92 },
      cooldown,
    ];

    return [
      makeGeneratedWorkout('1', `${totalMin}m Threshold ${reps1}x`, 'Threshold', 'Sustained 98–100% FTP blocks.', blocks1),
      makeGeneratedWorkout('2', `${totalMin}m Over-Unders`, 'Threshold', 'Alternating 95% and 106% FTP lactate clearance.', blocks2),
      makeGeneratedWorkout('3', `${totalMin}m Rising Threshold`, 'Threshold', 'Steady ramp from 85% up to 105% FTP.', blocks3),
    ];
  }

  if (focus === 'VO2 Max') {
    const reps1 = Math.max(3, Math.min(7, Math.floor(mainSec / 300)));
    const blocks1: Omit<WorkoutBlock, 'id'>[] = [warmup];
    for (let i = 1; i <= reps1; i++) {
      blocks1.push({ name: `VO2 (${i}/${reps1})`, type: 'interval', durationSec: 150, startPowerPct: 1.18, endPowerPct: 1.18, cadenceTarget: 96 });
      if (i < reps1) {
        blocks1.push({ name: 'Recovery', type: 'recovery', durationSec: 150, startPowerPct: 0.52, endPowerPct: 0.52, cadenceTarget: 84 });
      }
    }
    blocks1.push(cooldown);

    const microReps = Math.max(8, Math.min(16, Math.floor(mainSec / 75)));
    const blocks2: Omit<WorkoutBlock, 'id'>[] = [warmup];
    for (let i = 1; i <= microReps; i++) {
      blocks2.push({ name: `30s Attack (${i})`, type: 'interval', durationSec: 30, startPowerPct: 1.25, endPowerPct: 1.25, cadenceTarget: 100 });
      blocks2.push({ name: `30s Float (${i})`, type: 'recovery', durationSec: 30, startPowerPct: 0.55, endPowerPct: 0.55, cadenceTarget: 85 });
    }
    blocks2.push(cooldown);

    const blocks3: Omit<WorkoutBlock, 'id'>[] = [
      warmup,
      { name: 'VO2 4m', type: 'interval', durationSec: 240, startPowerPct: 1.14, endPowerPct: 1.14, cadenceTarget: 95 },
      { name: 'Rest', type: 'recovery', durationSec: 180, startPowerPct: 0.52, endPowerPct: 0.52, cadenceTarget: 85 },
      { name: 'VO2 2m', type: 'interval', durationSec: 120, startPowerPct: 1.22, endPowerPct: 1.22, cadenceTarget: 98 },
      { name: 'Rest', type: 'recovery', durationSec: 120, startPowerPct: 0.52, endPowerPct: 0.52, cadenceTarget: 85 },
      { name: 'VO2 1m', type: 'interval', durationSec: 60, startPowerPct: 1.32, endPowerPct: 1.32, cadenceTarget: 102 },
      cooldown,
    ];

    return [
      makeGeneratedWorkout('1', `${totalMin}m VO2 Intervals`, 'VO2 Max', `${reps1}x 2.5m at 118% FTP with equal recovery.`, blocks1),
      makeGeneratedWorkout('2', `${totalMin}m 30/30 Attacks`, 'VO2 Max', `${microReps}x 30s @ 125% / 30s @ 55% FTP.`, blocks2),
      makeGeneratedWorkout('3', `${totalMin}m Descending VO2`, 'VO2 Max', '4m → 2m → 1m getting sharper and harder.', blocks3),
    ];
  }

  // Sprint
  const sReps1 = Math.max(4, Math.min(8, Math.floor(mainSec / 210)));
  const sBlocks1: Omit<WorkoutBlock, 'id'>[] = [warmup];
  for (let i = 1; i <= sReps1; i++) {
    sBlocks1.push({ name: `Sprint (${i}/${sReps1})`, type: 'interval', durationSec: 15, startPowerPct: 1.75, endPowerPct: 1.75, cadenceTarget: 110 });
    sBlocks1.push({ name: 'Spin Easy', type: 'recovery', durationSec: 180, startPowerPct: 0.50, endPowerPct: 0.50, cadenceTarget: 85 });
  }
  sBlocks1.push(cooldown);

  const tabataReps = Math.max(6, Math.min(12, Math.floor(mainSec / 45)));
  const sBlocks2: Omit<WorkoutBlock, 'id'>[] = [warmup];
  for (let i = 1; i <= tabataReps; i++) {
    sBlocks2.push({ name: `Tabata (${i})`, type: 'interval', durationSec: 20, startPowerPct: 1.45, endPowerPct: 1.45, cadenceTarget: 105 });
    sBlocks2.push({ name: 'Float', type: 'recovery', durationSec: 15, startPowerPct: 0.50, endPowerPct: 0.50, cadenceTarget: 80 });
  }
  sBlocks2.push(cooldown);

  const sBlocks3: Omit<WorkoutBlock, 'id'>[] = [
    warmup,
    ...Array.from({ length: 4 }, (_, i) => [
      { name: `Z3 Leadout (${i + 1})`, type: 'steady' as const, durationSec: 120, startPowerPct: 0.85, endPowerPct: 0.95, cadenceTarget: 95 },
      { name: `Finish Sprint (${i + 1})`, type: 'interval' as const, durationSec: 20, startPowerPct: 1.65, endPowerPct: 1.65, cadenceTarget: 108 },
      { name: 'Recovery', type: 'recovery' as const, durationSec: 150, startPowerPct: 0.50, endPowerPct: 0.50, cadenceTarget: 84 },
    ]).flat(),
    cooldown,
  ];

  return [
    makeGeneratedWorkout('1', `${totalMin}m Max Sprints`, 'Sprint', `${sReps1}x 15s @ 175% FTP with full recovery.`, sBlocks1),
    makeGeneratedWorkout('2', `${totalMin}m Tabata Micro-Bursts`, 'Sprint', `${tabataReps}x 20s @ 145% / 15s easy.`, sBlocks2),
    makeGeneratedWorkout('3', `${totalMin}m Crit Leadout Sprints`, 'Sprint', '2m ramp leadouts into 20s finishing sprints.', sBlocks3),
  ];
}

/**
 * Optional Gemini API call if the user provides their own API key in-browser.
 */
export async function generateWorkoutsWithGeminiKey(
  prompt: string,
  apiKey: string
): Promise<Workout[]> {
  const sys = `You are a cycling coach. Return ONLY a valid JSON array of 3 workout objects matching:
[{"name":string,"category":"Endurance"|"Sweet Spot"|"Threshold"|"VO2 Max"|"Sprint","description":string,"blocks":[{"name":string,"type":"warmup"|"steady"|"interval"|"recovery"|"cooldown"|"ramp","durationSec":number,"startPowerPct":number,"endPowerPct":number,"cadenceTarget":number}]}]
PowerPct is decimal of FTP (e.g. 0.90 = 90%, 1.20 = 120%). Keep blocks realistic and total duration matching user request.`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
      apiKey.trim()
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${sys}\n\nUser request: ${prompt}` }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );

  if (!resp.ok) {
    throw new Error(`Gemini API error (${resp.status})`);
  }

  const data = (await resp.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');

  const rawList = JSON.parse(text) as {
    name: string;
    category: WorkoutCategory;
    description: string;
    blocks: Omit<WorkoutBlock, 'id'>[];
  }[];

  return rawList.slice(0, 3).map((w, idx) =>
    makeGeneratedWorkout(
      `llm-${idx}`,
      w.name || `AI Workout ${idx + 1}`,
      w.category || 'Custom',
      w.description || prompt,
      w.blocks
    )
  );
}
