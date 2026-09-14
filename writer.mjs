import fs from 'node:fs';
const content = `import { TRAINS, STATIONS, CORRIDORS, trainById, dhakaNow, getLiveState, fmtHM, searchTrains, getStationBoard } from './src/engine/schedule.js';

console.log('Trains:', TRAINS.length, 'Stations:', STATIONS.length, 'Corridors:', CORRIDORS.size);
const now = dhakaNow();
console.log('Now:', now.dayName, fmtHM(now.min));

const t701 = trainById.get('701');
if (t701) {
  const st = getLiveState(t701, now);
  console.log('701:', st.status, st.progressPct + '%', 'delay=' + st.delayMin + 'min');
}

const t41 = trainById.get('41');
if (t41) {
  const st = getLiveState(t41, now);
  console.log('41:', st.status, st.progressPct + '%', 'offDays=' + JSON.stringify(t41.offDays));
}

const search = searchTrains('DHA', 'CHA');
console.log('Search DHA->CHA:', search.length, 'trains');

const board = getStationBoard('DHA');
console.log('Station DHA board:', board.length, 'trains');
`;
fs.writeFileSync('C:/Users/Acer/.cline/data/workspaces/chat/bd-train-tracker/server/test-engine.mjs', content);
console.log('wrote test-engine.mjs');
