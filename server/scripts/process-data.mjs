// RailKhoj data processor - converts real Bangladesh Railway API data
// into the engine's expected format.
//
// Inputs: raw-cities.json, raw-trains.json, raw-routes.json
// Outputs: stations.json, trains.json, corridors.json

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "src", "data");

const readJSON = (f) => JSON.parse(readFileSync(path.join(DATA_DIR, f), "utf8"));
const writeJSON = (f, data) => {
  writeFileSync(path.join(DATA_DIR, f), JSON.stringify(data, null, 2));
  console.log(`  ${f}: ${Array.isArray(data) ? data.length : Object.keys(data).length} entries`);
};

// Known station coordinates (major stations of Bangladesh)
const KNOWN_COORDS = {
  "Dhaka": [23.8103, 90.4125], "Chattogram": [22.3569, 91.7832], "Chittagong": [22.3569, 91.7832],
  "Sylhet": [24.8949, 91.8687], "Rajshahi": [24.3745, 88.6042], "Khulna": [22.8456, 89.5403],
  "Rangpur": [25.7439, 89.2752], "Bogra": [24.8465, 89.3773], "Bogura": [24.8465, 89.3773],
  "Barisal": [22.7010, 90.3535], "Comilla": [23.4607, 91.1809], "Cox's Bazar": [21.4272, 92.0058],
  "Jessore": [23.1664, 89.2132], "Jashore": [23.1664, 89.2132], "Dinajpur": [25.6217, 88.6354],
  "Mymensingh": [24.7471, 90.4203], "Brahmanbaria": [23.9608, 91.1115], "Tangail": [24.2513, 89.9164],
  "Feni": [23.0159, 91.3976], "Noakhali": [22.8696, 91.0995], "Chandpur": [23.2333, 90.6712],
  "Narsingdi": [23.9322, 90.7151], "Gazipur": [24.0023, 90.4264], "Narayanganj": [23.6238, 90.5000],
  "Kushtia": [23.9013, 89.1206], "Faridpur": [23.6070, 89.8429], "Pabna": [24.0064, 89.2372],
  "Bhairab_Bazar": [24.0473, 90.9857], "Ishwardi": [24.1289, 89.0657], "Parbatipur": [25.6533, 88.9172],
  "Santahar": [24.8473, 89.1191], "Joydebpur": [23.9999, 90.4205], "Airport": [23.8433, 90.3978],
  "Abdulpur": [24.4542, 88.9642], "Ahsanganj": [24.6167, 88.9500], "Akhaura": [23.8667, 91.2167],
  "Akkelpur": [24.9667, 88.7167], "Bheramara": [24.0219, 88.9903], "Chuadanga": [23.6402, 88.8420],
  "Darshana": [23.5000, 89.2167], "Dewanganj": [25.1444, 89.7833], "Dewanganj_Bazar": [25.1444, 89.7833],
  "Gafargaon": [24.4333, 90.5667], "Gouripur": [24.7167, 90.5667], "Gunabati": [23.0167, 91.4000],
  "Hili": [25.3167, 89.0500], "Jagannathganj": [24.8167, 89.9333], "Kulaura": [24.5167, 92.0500],
  "Laksam": [23.2333, 91.1167], "Lalmonirhat": [25.9167, 89.4500], "Maijgaon": [24.7667, 90.5667],
  "Methikanda": [24.5667, 88.9667], "Mirpur": [23.7167, 90.3667], "Nangalkot": [23.1833, 91.2000],
  "Netrokona": [24.8833, 90.7333], "Noapara": [23.6333, 89.5500], "Phulbari": [25.5167, 88.8833],
  "Rohanpur": [24.7667, 88.3167], "Sarishabari": [24.7167, 89.8333], "Sreemangal": [24.3069, 91.7281],
  "Thakurgaon": [26.0336, 88.4616], "Ullapara": [24.3167, 89.5667], "Naogaon": [24.7936, 88.9318],
  "Nawabganj": [24.5917, 88.2750], "Ashuganj": [24.0167, 91.0000], "Shayestaganj": [24.0167, 90.9500],
  "Bhanugach": [24.4500, 91.7333], "Khaliajuri": [24.6833, 91.1117], "Chhatak": [25.0333, 91.6667],
  "Sunamganj": [25.0667, 91.4000], "Ajmiriganj": [24.5500, 91.2500], "Baniachong": [24.5167, 91.3500],
  "Thakurgaon_Road": [25.9500, 88.4500], "Pirganj": [25.8500, 88.3500], "Setabganj": [25.5500, 88.7500],
  "Sultanpur": [25.5000, 88.8000], "Bhomradah": [25.4500, 88.8500], "Shibganj": [25.4000, 88.9000],
  "Akhanagar": [25.3500, 88.9500], "Ruhia": [25.3000, 89.0000], "Kismat": [25.2500, 89.0500],
  "Kanchan_Junction": [25.6000, 88.6500], "Mongalpur": [25.5500, 88.7000], "Manmathapur": [25.7000, 88.9000],
  "Chirirbandar": [25.6500, 88.8500], "Kawgaon": [25.6000, 88.8000], "Pirganj": [25.8500, 88.3500],
  "Thakurgaon_Road": [25.9500, 88.4500], "Akhanagar": [25.3500, 88.9500], "Ruhia": [25.3000, 89.0000],
  "Kismat": [25.2500, 89.0500], "Setabganj": [25.5500, 88.7500], "Sultanpur": [25.5000, 88.8000],
  "Bhomradah": [25.4500, 88.8500], "Shibganj": [25.4000, 88.9000],
};

// Time format: "07:40 am BST" -> minutes since midnight
function parseBST(timeStr) {
  if (!timeStr || timeStr === "---" || timeStr === null) return null;
  const m = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)\s*BST$/i);
  if (!m) {
    const m2 = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m2) return parseInt(m2[1]) * 60 + parseInt(m2[2]);
    return null;
  }
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const ampm = m[3].toLowerCase();
  if (ampm === "am" && h === 12) h = 0;
  else if (ampm === "pm" && h !== 12) h += 12;
  return h * 60 + min;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hashName(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0x7fffffff;
  return h;
}

const DAY_MAP = { "Sun": 0, "Mon": 1, "Tue": 2, "Wed": 3, "Thu": 4, "Fri": 5, "Sat": 6 };
const WINDING_FACTOR = 1.3;

console.log("RailKhoj data processor");
console.log("========================\n");

// Load raw data
const rawCities = readJSON("raw-cities.json");
const rawTrains = readJSON("raw-trains.json");
const rawRoutes = readJSON("raw-routes.json");
console.log(`Loaded: ${rawCities.length} cities, ${rawTrains.length} trains, ${Object.keys(rawRoutes).length} route entries`);

// Build city lookup
const cityByName = new Map(rawCities.map((c) => [c.city_name, c]));

// Find all unique cities used in routes
const routeCityNames = new Set();
for (const tr of Object.values(rawRoutes)) {
  if (tr.routes) {
    for (const r of tr.routes) routeCityNames.add(r.city);
  }
}
console.log(`Unique cities in routes: ${routeCityNames.size}`);


// ---- Generate unique station codes ----
function generateUniqueCodes(names) {
  const codeToName = new Map();
  const nameToCode = new Map();

  const sorted = [...names].sort((a, b) => {
    const ca = cityByName.get(a);
    const cb = cityByName.get(b);
    const ta = ca?.is_top_city ? 0 : 1;
    const tb = cb?.is_top_city ? 0 : 1;
    if (ta !== tb) return ta - tb;
    const sa = ca?.city_sequence || 0;
    const sb = cb?.city_sequence || 0;
    if (sa !== sb) return sb - sa;
    return a.localeCompare(b);
  });

  for (const name of sorted) {
    const clean = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    let code = null;

    for (let len = 3; len <= Math.min(clean.length, 6); len++) {
      const candidate = clean.substring(0, len);
      if (!codeToName.has(candidate)) { code = candidate; break; }
    }

    if (!code) {
      const city = cityByName.get(name);
      const id = city ? city.city_id : 0;
      code = clean.substring(0, 4) + String(id).slice(-2);
      let suffix = 0;
      while (codeToName.has(code)) { code = clean.substring(0, 4) + String(suffix).padStart(2, "0"); suffix++; }
    }

    codeToName.set(code, name);
    nameToCode.set(name, code);
  }

  return { nameToCode, codeToName };
}

const { nameToCode, codeToName } = generateUniqueCodes(routeCityNames);
console.log(`Generated ${nameToCode.size} unique station codes`);

// ---- Assign coordinates to stations ----
function assignCoordinates(names) {
  const coords = {};
  const known = [];
  const unknown = [];

  for (const name of names) {
    const kc = KNOWN_COORDS[name] || KNOWN_COORDS[name.replace(/_/g, " ")];
    if (kc) { coords[name] = kc; known.push({ name, coords: kc }); }
    else unknown.push(name);
  }
  console.log(`  Known coordinates: ${known.length}, Unknown: ${unknown.length}`);

  // Build adjacency from routes
  const neighbors = new Map();
  for (const tr of Object.values(rawRoutes)) {
    if (!tr.routes) continue;
    for (let i = 0; i < tr.routes.length - 1; i++) {
      const a = tr.routes[i].city;
      const b = tr.routes[i + 1].city;
      if (!neighbors.has(a)) neighbors.set(a, new Set());
      if (!neighbors.has(b)) neighbors.set(b, new Set());
      neighbors.get(a).add(b);
      neighbors.get(b).add(a);
    }
  }

  for (const name of unknown) {
    const adj = neighbors.get(name);
    let estimated = null;

    if (adj) {
      const knownNeighbors = [...adj].filter((n) => coords[n]);
      if (knownNeighbors.length >= 2) {
        const c1 = coords[knownNeighbors[0]];
        const c2 = coords[knownNeighbors[1]];
        estimated = [(c1[0] + c2[0]) / 2 + (hashName(name) % 10 - 5) / 500, (c1[1] + c2[1]) / 2 + (hashName(name) % 7 - 3) / 500];
      } else if (knownNeighbors.length === 1) {
        const c = coords[knownNeighbors[0]];
        const offset = 0.05 + (hashName(name) % 10) / 100;
        const angle = ((hashName(name) * 137.5) % 360) * (Math.PI / 180);
        estimated = [c[0] + Math.sin(angle) * offset, c[1] + Math.cos(angle) * offset];
      }
    }

    if (!estimated) {
      const hash = hashName(name);
      estimated = [23.685 + (hash % 100 - 50) / 500, 90.356 + ((hash >> 8) % 100 - 50) / 500];
    }
    coords[name] = estimated;
  }

  return coords;
}

const stationCoords = assignCoordinates(routeCityNames);

// ---- Build corridors from route sequences ----
const corridorGroups = new Map();
for (const [trainNum, tr] of Object.entries(rawRoutes)) {
  if (!tr.routes || tr.routes.length < 2) continue;
  const codes = tr.routes.map((r) => nameToCode.get(r.city)).filter(Boolean);
  const key = codes.join(",");
  if (!corridorGroups.has(key)) {
    corridorGroups.set(key, { stations: codes, trains: [] });
  }
  corridorGroups.get(key).trains.push(trainNum);
}

const corridors = [];
let cid = 0;
for (const [, val] of corridorGroups) {
  corridors.push({ id: "C" + cid, stations: val.stations });
  cid++;
}
console.log(`Built ${corridors.length} corridors`);

// ---- Parse time "07:40 am BST" -> "07:40" ----
function parseTime(t) {
  if (!t || t === "---" || t === null) return null;
  const m = String(t).match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!m) return null;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const ampm = m[3].toLowerCase();
  if (ampm === "am" && h === 12) h = 0;
  else if (ampm === "pm" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// ---- Build trains ----
const trains = [];
for (const [trainNum, tr] of Object.entries(rawRoutes)) {
  if (!tr.routes || tr.routes.length < 2) continue;
  const rawTrain = rawTrains.find((t) => t.train_number === trainNum);

  const codes = tr.routes.map((r) => nameToCode.get(r.city)).filter(Boolean);
  const corridorKey = codes.join(",");
  const corridorId = corridors.find((c) => c.stations.join(",") === corridorKey)?.id || "C0";

  const stopParts = [];
  for (let i = 0; i < tr.routes.length; i++) {
    const stop = tr.routes[i];
    const code = nameToCode.get(stop.city);
    if (!code) continue;
    const isFirst = i === 0;
    const isLast = i === tr.routes.length - 1;
    const time = isFirst ? parseTime(stop.departure_time) : parseTime(stop.arrival_time);
    if (isFirst) stopParts.push(`${code}*${time}`);
    else if (isLast) stopParts.push(`${code}#${time}`);
    else stopParts.push(code);
  }

  const stops = stopParts.join("|");

  // Map off-days: days listed are days it RUNS, so off = all others
  // Raw data uses abbreviated day names: "Fri", "Sat", etc.
  const dayAbbrToFull = { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" };
  const allDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const runDaysFull = (tr.days || []).map((d) => dayAbbrToFull[d] || d);
  const offDays = runDaysFull.length > 0
    ? allDays.filter((d) => !runDaysFull.includes(d))
    : [];

  trains.push({
    id: trainNum,
    number: trainNum,
    nameEn: tr.train_name || `${rawTrain?.origin_city || ""} - ${rawTrain?.destination_city || ""} Express`,
    nameBn: tr.train_name || `${rawTrain?.origin_city || ""} - ${rawTrain?.destination_city || ""}`,
    corridor: corridorId,
    off: offDays,
    stops,
  });
}
console.log(`Built ${trains.length} trains`);

// ---- Build stations output ----
const stations = [];
for (const [name, code] of nameToCode) {
  const coords = stationCoords[name] || [23.685, 90.356];
  stations.push({ code, name, lat: coords[0], lng: coords[1] });
}
console.log(`Built ${stations.length} stations`);

// ---- Write output ----
console.log("\nWriting output files...");
writeJSON("stations.json", stations);
writeJSON("corridors.json", corridors);
writeJSON("trains.json", trains);
console.log("\nDone! Real Bangladesh Railway data processed.");

