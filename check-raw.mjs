import fs from "node:fs";
import path from "node:path";

const dir = "C:\\Users\\Acer\\.cline\\data\\workspaces\\chat\\bd-train-tracker\\server\\src\\data";

// Check raw data structure
const rawTrains = JSON.parse(fs.readFileSync(path.join(dir, "raw-trains.json"), "utf8"));
const rawCities = JSON.parse(fs.readFileSync(path.join(dir, "raw-cities.json"), "utf8"));
const rawRoutes = JSON.parse(fs.readFileSync(path.join(dir, "raw-routes.json"), "utf8"));

console.log("=== RAW TRAINS (first 2) ===");
console.log(JSON.stringify(rawTrains.slice(0, 2), null, 2));

console.log("\n=== RAW CITIES (first 2) ===");
console.log(JSON.stringify(rawCities.slice(0, 2), null, 2));

console.log("\n=== RAW ROUTES (train 701) ===");
console.log(JSON.stringify(rawRoutes["701"], null, 2));

console.log("\n=== RAW ROUTES (train 702) ===");
console.log(JSON.stringify(rawRoutes["702"], null, 2));

console.log("\n=== RAW ROUTES (train 01) ===");
console.log(JSON.stringify(rawRoutes["01"], null, 2));
