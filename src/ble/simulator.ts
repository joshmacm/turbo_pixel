export interface SimulatedTelemetry {
  powerWatts: number;
  cadenceRpm: number;
  speedKmh: number;
  heartRateBpm: number;
}

/**
 * Realistic ERG-mode trainer + HRM simulator for testing without hardware.
 */
export class RideSimulator {
  private currentPower = 110;
  private currentHr = 105;
  private targetWatts = 150;
  private ftp = 250;

  setTargetPower(watts: number) {
    this.targetWatts = Math.max(50, watts);
  }

  setFtp(ftp: number) {
    this.ftp = Math.max(80, ftp);
  }

  tick(isPaused: boolean): SimulatedTelemetry {
    if (isPaused) {
      this.currentPower = Math.max(0, this.currentPower * 0.7);
      this.currentHr = Math.max(68, this.currentHr - 0.8);
      return {
        powerWatts: Math.round(this.currentPower),
        cadenceRpm: 0,
        speedKmh: 0,
        heartRateBpm: Math.round(this.currentHr),
      };
    }

    // Smooth ERG response toward targetWatts + small realistic noise
    const diff = this.targetWatts - this.currentPower;
    this.currentPower += diff * 0.45 + (Math.random() - 0.5) * 6;
    const powerWatts = Math.max(0, Math.round(this.currentPower));

    // Cadence scales gently with effort around 86-96 rpm
    const effortRatio = powerWatts / this.ftp;
    const cadenceRpm = Math.round(
      Math.max(65, Math.min(108, 86 + effortRatio * 8 + (Math.random() - 0.5) * 3))
    );

    // Virtual flat-road speed approximation from power
    const speedKmh = Number(
      Math.max(0, 12 + Math.pow(powerWatts, 0.48) * 1.95).toFixed(1)
    );

    // Heart rate lags behind power effort
    const targetHr = Math.min(192, Math.max(85, 88 + effortRatio * 82));
    this.currentHr += (targetHr - this.currentHr) * 0.06 + (Math.random() - 0.5) * 1.2;

    return {
      powerWatts,
      cadenceRpm,
      speedKmh,
      heartRateBpm: Math.round(this.currentHr),
    };
  }
}
