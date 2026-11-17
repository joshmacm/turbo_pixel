const EASY_MESSAGES = [
  'Spinning easy. Enjoy it while it lasts.',
  'Your legs think this is a coffee ride. Do not tell them.',
  'Smooth circles. Save the heroics for later.',
  'Hydrate now, question your hobbies later.',
  'Zone 2: building the engine one pedal stroke at a time.',
  'Relax the shoulders. Unclench the jaw.',
  'If you can read this comfortably, you are in the right zone.',
  'Easy spin. Even Pogacar coasts sometimes.',
];

const TEMPO_SWEET_SPOT_MESSAGES = [
  'Comfortably uncomfortable. Classic Sweet Spot.',
  'Not quite threshold, still questioning your life choices.',
  'Imagine there is a bakery at the end of this block.',
  'Steady watts, steady breathing. Dialled in.',
  'Building aerobic horsepower. Quietly getting faster.',
  'Keep the cadence snappy—do not let the legs bog down.',
  'This is where the real fitness hides.',
  'Just you, the ERG spiral, and mild regret.',
];

const THRESHOLD_MESSAGES = [
  'Right on the red line. Lovely.',
  'Remember: you voluntarily clicked Start Ride.',
  'Hold the cadence. Ignore the burning.',
  'Your FTP called—it says you are fine. Probably.',
  'Deep breaths. Pain is just watts leaving the legs.',
  'Stare at the road. Become one with the flywheel.',
  'Threshold: the art of pretending this is sustainable.',
  'Strong and steady. Do not negotiate with your legs.',
];

const HARD_VO2_MESSAGES = [
  'Shut up, legs!',
  'Breathe! Oxygen is free, use more of it.',
  'Wout is watching. Look aerodynamic.',
  'Time slows down above 115% FTP. That is just physics.',
  'Your heart rate is just enthusiasm.',
  'Do not look at the timer. Okay, look at the timer.',
  'Pedal through it—your couch is not going anywhere.',
  'Pure suffering. Great for Strava, terrible for dignity.',
  'Keep turning the cranks! ERG will not forgive you.',
  'Embrace the lactic acid. It means it is working.',
];

const FINAL_SECONDS_MESSAGES = [
  'Final seconds! Empty the tank!',
  'Do not you dare ease off now—hold it to the beep!',
  'Almost there! Finish through the line!',
  'Count it down—legs on fire, head down!',
];

export function pickMotivationalMessage(
  targetPct: number,
  blockRemainingSec: number,
  previous?: string
): string {
  let pool: string[];
  if (targetPct >= 0.95 && blockRemainingSec > 0 && blockRemainingSec <= 15) {
    pool = FINAL_SECONDS_MESSAGES;
  } else if (targetPct >= 1.06) {
    pool = HARD_VO2_MESSAGES;
  } else if (targetPct >= 0.92) {
    pool = THRESHOLD_MESSAGES;
  } else if (targetPct >= 0.75) {
    pool = TEMPO_SWEET_SPOT_MESSAGES;
  } else {
    pool = EASY_MESSAGES;
  }

  const filtered = pool.length > 1 && previous ? pool.filter((m) => m !== previous) : pool;
  return filtered[Math.floor(Math.random() * filtered.length)];
}
