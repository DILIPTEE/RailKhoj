// Data ingestion script - fetches real data from Bangladesh Railway API.
// Run: node server/scripts/fetch-data.mjs
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "src", "data");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const BASE = "https://railspaapi.shohoz.com/v1.0/web";

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(BASE + path, {
      headers: { "User-Agent": UA, Accept: "application/json, text/plain, */*",
        Origin: "https://eticket.railway.gov.bd", Referer: "https://eticket.railway.gov.bd/", ...headers },
      timeout: 30000 }, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => resolve({ status: r.statusCode, text: b })); });
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
  });
}

function post(path, body = {}, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(BASE + path, {
      method: "POST", headers: { "User-Agent": UA, Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json", Origin: "https://eticket.railway.gov.bd",
        Referer: "https://eticket.railway.gov.bd/", "Content-Length": Buffer.byteLength(data), ...headers },
      timeout: 30000 }, (r) => { let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => resolve({ status: r.statusCode, text: b })); });
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject); req.write(data); req.end();
  });
}

async function fetchAllTrains() {
  console.log("Fetching /all-trains/info...");
  const r = await get("/all-trains/info");
  if (r.status !== 200) throw new Error("Failed: " + r.status);
  const j = JSON.parse(r.text);
  console.log("  Got " + j.data.trains.length + " trains");
  return j.data.trains;
}

async function fetchStations() {
  console.log("Fetching /handshake...");
  const r = await post("/handshake", {});
  if (r.status !== 200) throw new Error("Failed: " + r.status);
  const j = JSON.parse(r.text);
  console.log("  Got " + (j.data.cities || []).length + " cities");
  return j.data.cities || [];
}

async function fetchTrainRoute(tn) {
  const r = await post("/train-routes", { model: tn });
  if (r.status !== 200) return null;
  try { const j = JSON.parse(r.text); return j.data || j; } catch { return null; }
}

function log(msg) { console.log(msg); }

(async () => {
  log("=== Bangladesh Railway Data Ingestion ===\n");
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const trains = await fetchAllTrains();
  const cities = await fetchStations();

  log("\nFetching train routes...");
  const trainRoutes = {};
  let routeCount = 0;
  for (const train of trains) {
    const tn = train.train_number;
    process.stdout.write("  Train " + tn + "... ");
    try {
      const route = await fetchTrainRoute(tn);
      if (route) { trainRoutes[tn] = route; routeCount++; log("OK"); }
      else log("no data");
    } catch (e) { log("ERR: " + e.message); }
    await new Promise((r) => setTimeout(r, 200));
  }

  log("\nTrains: " + trains.length + " | Cities: " + cities.length + " | Routes: " + routeCount);
  fs.writeFileSync(path.join(DATA_DIR, "raw-trains.json"), JSON.stringify(trains, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, "raw-cities.json"), JSON.stringify(cities, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, "raw-routes.json"), JSON.stringify(trainRoutes, null, 2));
  log("Raw data saved.");
})().catch((e) => { console.error("FATAL: " + e.message); process.exit(1); });
