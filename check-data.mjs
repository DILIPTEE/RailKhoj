import fs from "node:fs";
import path from "node:path";

const root = "C:\\Users\\Acer\\.cline\\data\\workspaces\\chat\\bd-train-tracker";

function listDir(dir, prefix = "") {
  try {
    const items = fs.readdirSync(dir);
    items.forEach((item) => {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        console.log(prefix + item + "/");
        if (prefix.length < 4) listDir(full, prefix + "  ");
      } else {
        console.log(prefix + item + " (" + stat.size + " bytes)");
      }
    });
  } catch (e) {
    console.log(prefix + "ERROR: " + e.message);
  }
}

listDir(root);
