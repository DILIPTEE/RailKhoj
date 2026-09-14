import fs from "node:fs";
import path from "node:path";

var dir = "C:\\Users\\Acer\\.cline\\data\\workspaces\\chat\\bd-train-tracker\\server\\scripts";
fs.mkdirSync(dir, { recursive: true });
console.log("Created: " + dir);
console.log("Exists: " + fs.existsSync(dir));
