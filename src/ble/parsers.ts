export interface IndoorBikeData {
  speedKmh?: number;
  cadenceRpm?: number;
  powerWatts?: number;
  heartRateBpm?: number;
  distanceMeters?: number;
}

/**
 * Parses Bluetooth FTMS Indoor Bike Data (characteristic 0x2AD2) per the
 * Fitness Machine Service specification.
 */
export function parseIndoorBikeData(data: DataView): IndoorBikeData {
  if (data.byteLength < 2) return {};

  const flags = data.getUint16(0, true);
  let offset = 2;
  const result: IndoorBikeData = {};

  const hasMoreData = (flags & (1 << 0)) !== 0;
  const hasAvgSpeed = (flags & (1 << 1)) !== 0;
  const hasInstantCadence = (flags & (1 << 2)) !== 0;
  const hasAvgCadence = (flags & (1 << 3)) !== 0;
  const hasTotalDistance = (flags & (1 << 4)) !== 0;
  const hasResistanceLevel = (flags & (1 << 5)) !== 0;
  const hasInstantPower = (flags & (1 << 6)) !== 0;
  const hasAvgPower = (flags & (1 << 7)) !== 0;
  const hasExpendedEnergy = (flags & (1 << 8)) !== 0;
  const hasHeartRate = (flags & (1 << 9)) !== 0;

  // Bit 0 == 0 means Instantaneous Speed is present (uint16, 0.01 km/h)
  if (!hasMoreData && offset + 2 <= data.byteLength) {
    result.speedKmh = data.getUint16(offset, true) * 0.01;
    offset += 2;
  }

  if (hasAvgSpeed && offset + 2 <= data.byteLength) {
    offset += 2;
  }

  // Bit 2: Instantaneous Cadence (uint16, 0.5 rpm)
  if (hasInstantCadence && offset + 2 <= data.byteLength) {
    result.cadenceRpm = Math.round(data.getUint16(offset, true) * 0.5);
    offset += 2;
  }

  if (hasAvgCadence && offset + 2 <= data.byteLength) {
    offset += 2;
  }

  // Bit 4: Total Distance (uint24, meters)
  if (hasTotalDistance && offset + 3 <= data.byteLength) {
    const b0 = data.getUint8(offset);
    const b1 = data.getUint8(offset + 1);
    const b2 = data.getUint8(offset + 2);
    result.distanceMeters = b0 | (b1 << 8) | (b2 << 16);
    offset += 3;
  }

  if (hasResistanceLevel && offset + 2 <= data.byteLength) {
    offset += 2;
  }

  // Bit 6: Instantaneous Power (sint16, watts)
  if (hasInstantPower && offset + 2 <= data.byteLength) {
    result.powerWatts = data.getInt16(offset, true);
    offset += 2;
  }

  if (hasAvgPower && offset + 2 <= data.byteLength) {
    offset += 2;
  }

  // Bit 8: Expended Energy (uint16 total + uint16/hr + uint8/min = 5 bytes)
  if (hasExpendedEnergy && offset + 5 <= data.byteLength) {
    offset += 5;
  }

  // Bit 9: Heart Rate (uint8, bpm)
  if (hasHeartRate && offset + 1 <= data.byteLength) {
    result.heartRateBpm = data.getUint8(offset);
    offset += 1;
  }

  return result;
}

/**
 * Parses standard Bluetooth Heart Rate Measurement (characteristic 0x2A37).
 */
export function parseHeartRateMeasurement(data: DataView): number | null {
  if (data.byteLength < 2) return null;
  const flags = data.getUint8(0);
  const isUint16 = (flags & 0x01) !== 0;
  if (isUint16) {
    if (data.byteLength < 3) return null;
    return data.getUint16(1, true);
  }
  return data.getUint8(1);
}

/**
 * Encodes FTMS Set Target Power (OpCode 0x05) with sint16 watts (little-endian).
 */
export function encodeSetTargetPower(watts: number): Uint8Array {
  const clamped = Math.max(0, Math.min(2000, Math.round(watts)));
  const buf = new ArrayBuffer(3);
  const view = new DataView(buf);
  view.setUint8(0, 0x05);
  view.setInt16(1, clamped, true);
  return new Uint8Array(buf);
}
