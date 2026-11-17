import { describe, expect, it } from 'vitest';
import {
  encodeSetTargetPower,
  parseHeartRateMeasurement,
  parseIndoorBikeData,
} from '../ble/parsers';
import { computeRideStats, getActiveBlockAtTime } from '../workouts/engine';
import { WORKOUT_LIBRARY } from '../workouts/library';
import { generateTcx } from '../export/tcx';

describe('BLE Parsers', () => {
  it('parses FTMS Indoor Bike Data with speed, cadence, and power', () => {
    // Flags: bit 0 = 0 (instant speed present), bit 2 = 1 (cadence), bit 6 = 1 (power)
    // 0x0044 = 0b0000_0000_0100_0100
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint16(0, 0x0044, true);
    view.setUint16(2, 3250, true); // 32.50 km/h
    view.setUint16(4, 180, true);  // 90 rpm (0.5 resolution)
    view.setInt16(6, 245, true);   // 245 W

    const parsed = parseIndoorBikeData(view);
    expect(parsed.speedKmh).toBeCloseTo(32.5, 2);
    expect(parsed.cadenceRpm).toBe(90);
    expect(parsed.powerWatts).toBe(245);
  });

  it('parses 8-bit and 16-bit BLE Heart Rate Measurement', () => {
    const buf8 = new ArrayBuffer(2);
    const v8 = new DataView(buf8);
    v8.setUint8(0, 0x00);
    v8.setUint8(1, 148);
    expect(parseHeartRateMeasurement(v8)).toBe(148);

    const buf16 = new ArrayBuffer(3);
    const v16 = new DataView(buf16);
    v16.setUint8(0, 0x01);
    v16.setUint16(1, 172, true);
    expect(parseHeartRateMeasurement(v16)).toBe(172);
  });

  it('encodes FTMS Set Target Power (0x05) little-endian', () => {
    const bytes = encodeSetTargetPower(275);
    expect(bytes[0]).toBe(0x05);
    expect(bytes[1]).toBe(275 & 0xff);
    expect(bytes[2]).toBe((275 >> 8) & 0xff);
  });
});

describe('Workout Engine & TCX Export', () => {
  it('interpolates ramp target watts and applies bias', () => {
    const workout = WORKOUT_LIBRARY[0]; // Warmup Ramp: 240s from 45% to 75%
    const mid = getActiveBlockAtTime(workout, 120, 200, 100);
    expect(mid).not.toBeNull();
    expect(mid!.targetWatts).toBe(120); // 60% of 200W

    const biased = getActiveBlockAtTime(workout, 120, 200, 110);
    expect(biased!.targetWatts).toBe(132); // 60% * 1.1 * 200W
  });

  it('computes ride stats and generates valid TCX with Watts & HR', () => {
    const samples = Array.from({ length: 60 }, (_, i) => ({
      timestampIso: new Date(1700000000000 + i * 1000).toISOString(),
      elapsedSec: i + 1,
      powerWatts: 200,
      targetWatts: 200,
      heartRateBpm: 150,
      cadenceRpm: 90,
      speedKmh: 36,
      distanceMeters: (i + 1) * 10,
    }));

    const stats = computeRideStats(samples, 250);
    expect(stats.avgPower).toBe(200);
    expect(stats.normalizedPower).toBe(200);
    expect(stats.avgHr).toBe(150);
    expect(stats.distanceKm).toBe(0.6);

    const tcx = generateTcx(samples, 'Test Ride', samples[0].timestampIso);
    expect(tcx).toContain('<ns3:Watts>200</ns3:Watts>');
    expect(tcx).toContain('<Value>150</Value>');
    expect(tcx).toContain('<Cadence>90</Cadence>');
  });
});
