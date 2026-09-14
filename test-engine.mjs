import { TRAINS, STATIONS, CORRIDORS, trainById, dhakaNow, getLiveState } from './server/src/engine/schedule.js';

console.log('TRAINS:', TRAINS.length, 'STATIONS:', Object.keys(STATIONS).length, 'CORRIDORS:', CORRIDORS.size);

const t = trainById.get('701');
console.log('701:', t ? t.id + ' stops=' + t.stops.length : 'NOT FOUND');

const now = dhakaNow();
console.log('Now:', JSON.stringify(now));
if (t) {
  const s = getLiveState(t, now);
  console.log('State:', JSON.stringify(s));
}
