const fs = require("fs");
const p = "C:/Users/Acer/.cline/data/workspaces/chat/bd-train-tracker/server/test-engine.mjs";
const c = `import { TRAINS, STATIONS, CORRIDORS, trainById, dhakaNow, getLiveState } from "./src/engine/schedule.js";
console.log("TRAINS:", TRAINS.length);
console.log("STATIONS:", STATIONS.length);
console.log("CORRIDORS:", CORRIDORS.size);
const t = TRAINS[0];
console.log("First train:", t.number, t.nameEn, "stops:", t.stops.length);
console.log("Origin:", t.originCode, "Dest:", t.destCode);
const now = dhakaNow();
console.log("Dhaka now:", now);
const st = getLiveState(t, now);
console.log("Live state:", JSON.stringify(st));
const dhakaTrains = TRAINS.filter(tr => tr.stops.some(s=>s.code==="DHA"));
console.log("Trains through DHA:", dhakaTrains.length);
const results = [];
for (const tr of TRAINS) {
  const i = tr.stops.findIndex(s=>s.code==="DHA");
  if (i<0) continue;
  const j = tr.stops.findIndex((s,idx)=>idx>i && s.code==="CHA");
  if (j<0) continue;
  results.push(tr.number+" "+tr.nameEn);
}
console.log("DHA->CHA trains:", results.length);
results.slice(0,5).forEach(r=>console.log("  ",r));
`;
fs.writeFileSync(p, c);
console.log("done");
