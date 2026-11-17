import type { TelemetrySample } from '../workouts/types';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a Strava-compatible TCX XML string from recorded 1Hz telemetry samples.
 */
export function generateTcx(
  samples: TelemetrySample[],
  workoutName: string,
  startTimeIso: string
): string {
  const totalTimeSec = samples.length > 0 ? samples[samples.length - 1].elapsedSec : 0;
  const totalDistMeters =
    samples.length > 0 ? samples[samples.length - 1].distanceMeters : 0;

  let maxSpeedMs = 0;
  let sumPower = 0;
  let sumHr = 0;
  let hrCount = 0;
  let maxHr = 0;

  for (const s of samples) {
    const speedMs = s.speedKmh / 3.6;
    if (speedMs > maxSpeedMs) maxSpeedMs = speedMs;
    sumPower += s.powerWatts;
    if (s.heartRateBpm > 0) {
      sumHr += s.heartRateBpm;
      hrCount++;
      if (s.heartRateBpm > maxHr) maxHr = s.heartRateBpm;
    }
  }

  const avgHr = hrCount > 0 ? Math.round(sumHr / hrCount) : 0;
  // Rough kCal estimate from kJ (human cycling efficiency ~24% => 1 kJ ≈ 1 kcal)
  const calories = Math.round(sumPower / 1000);

  const trackpointsXml = samples
    .map((s) => {
      const speedMs = (s.speedKmh / 3.6).toFixed(2);
      const hrXml =
        s.heartRateBpm > 0
          ? `
            <HeartRateBpm>
              <Value>${Math.round(s.heartRateBpm)}</Value>
            </HeartRateBpm>`
          : '';

      return `          <Trackpoint>
            <Time>${s.timestampIso}</Time>
            <DistanceMeters>${s.distanceMeters.toFixed(1)}</DistanceMeters>${hrXml}
            <Cadence>${Math.max(0, Math.min(254, Math.round(s.cadenceRpm)))}</Cadence>
            <Extensions>
              <ns3:TPX>
                <ns3:Speed>${speedMs}</ns3:Speed>
                <ns3:Watts>${Math.max(0, Math.round(s.powerWatts))}</ns3:Watts>
              </ns3:TPX>
            </Extensions>
          </Trackpoint>`;
    })
    .join('\n');

  const lapHrXml =
    avgHr > 0
      ? `
        <AverageHeartRateBpm><Value>${avgHr}</Value></AverageHeartRateBpm>
        <MaximumHeartRateBpm><Value>${maxHr}</Value></MaximumHeartRateBpm>`
      : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Activities>
    <Activity Sport="Biking">
      <Id>${startTimeIso}</Id>
      <Lap StartTime="${startTimeIso}">
        <TotalTimeSeconds>${totalTimeSec}</TotalTimeSeconds>
        <DistanceMeters>${totalDistMeters.toFixed(1)}</DistanceMeters>
        <MaximumSpeed>${maxSpeedMs.toFixed(2)}</MaximumSpeed>
        <Calories>${calories}</Calories>${lapHrXml}
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
${trackpointsXml}
        </Track>
      </Lap>
      <Notes>${escapeXml(workoutName)} - Recorded with Pixel Peloton</Notes>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
}
