import fs from "node:fs";
import path from "node:path";

const root = "C:\\Users\\Acer\\.cline\\data\\workspaces\\chat\\bd-train-tracker";

function listDir(dir, prefix = "") {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) { console.log(prefix + dir + " [MISSING]"); return; }
  const items = fs.readdirSync(full);
  for (const item of items) {
    const itemPath = path.join(full, item);
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      console.log(prefix + item + "/");
      listDir(path.join(dir, item), prefix + "  ");
    } else {
      console.log(prefix + item + " (" + stat.size + " bytes)");
    }
  }
}

console.log("=== Project structure ===");
listDir("");
