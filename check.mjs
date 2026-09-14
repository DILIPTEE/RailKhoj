import fs from "node:fs";
import path from "node:path";

const root = "C:/Users/Acer/.cline/data/workspaces/chat/bd-train-tracker";
const out = [];

function walk(dir, prefix = "") {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === "dist") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(prefix + e.name + "/");
      walk(full, prefix + "  ");
    } else {
      const size = fs.statSync(full).size;
      out.push(prefix + e.name + " (" + size + " bytes)");
    }
  }
}

walk(root);
console.log(out.join("\n"));
