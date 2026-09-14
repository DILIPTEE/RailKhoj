// Community-sourced position corrections ("I'm on this train").
//
// A passenger's GPS report is projected onto the train's corridor polyline.
// The difference between the reported position and the schedule prediction is
// converted to a delay offset (minutes), then blended with previous reports
// using an exponential moving average. Reports expire after 45 minutes of
// silence, falling back to the schedule/simulated delay.

const store = new Map(); // trainId -> { offsetMin, lastTs, count }
const MAX_AGE_MS = 45 * 60 * 1000;

export function getCrowdOffset(trainId, nowTs) {
  const r = store.get(trainId);
  if (!r) return null;
  if (nowTs - r.lastTs > MAX_AGE_MS) return null;
  return r.offsetMin;
}

/**
 * @param predictedKm schedule-predicted position (travel km)
 * @param reportKm    reported position (travel km)
 * @param kmPerMin    average train speed on this route
 */
export function addReport(trainId, predictedKm, reportKm, kmPerMin, nowTs) {
  let deltaMin = (reportKm - predictedKm) / (kmPerMin || 1);
  if (!Number.isFinite(deltaMin)) deltaMin = 0;
  deltaMin = Math.max(-180, Math.min(180, deltaMin));

  const prev = store.get(trainId);
  const blended = prev ? prev.offsetMin * 0.5 + deltaMin * 0.5 : deltaMin;
  const entry = {
    offsetMin: Math.round(blended * 10) / 10,
    lastTs: nowTs,
    count: (prev ? prev.count : 0) + 1,
  };
  store.set(trainId, entry);
  return entry;
}

export function reportStats(trainId) {
  const r = store.get(trainId);
  return r ? { count: r.count, lastTs: r.lastTs } : null;
}
