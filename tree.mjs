// List all files in the project recursively
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:\\Users\\Acer\\.cline\\data\\workspaces\\chat\\bd-train-tracker";
const OUT = path.join(ROOT, "tree.txt");

function listDir(dir, prefix = "") {
  let result = "";
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        result += `${prefix}${entry.name}/\n`;
        result += listDir(fullPath, prefix + "  ");
      } else {
        const size = fs.statSync(fullPath).size;
        result += `${prefix}${entry.name} (${size} bytes)\n`;
      }
    }
  } catch (e) {
    result += `${prefix}[ERROR: ${e.message}]\n`;
  }
  return result;
}

const tree = listDir(ROOT);
fs.writeFileSync(OUT, tree);
console.log("wrote " + OUT);
console.log(tree.substring(0, 3000));
