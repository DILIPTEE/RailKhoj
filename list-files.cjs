const fs = require('fs');
const path = require('path');
const root = 'C:/Users/Acer/.cline/data/workspaces/chat/bd-train-tracker';

function list(d, p = '') {
  const r = [];
  try {
    const i = fs.readdirSync(d, { withFileTypes: true });
    for (const x of i) {
      const f = path.join(d, x.name);
      if (x.isDirectory()) {
        r.push(...list(f, p + x.name + '/'));
      } else {
        const s = fs.statSync(f);
        r.push({ p: p + x.name, s: s.size });
      }
    }
  } catch (e) {}
  return r;
}

const files = list(root);
console.log('Total:', files.length);
for (const f of files) {
  console.log(f.p.padEnd(60), f.s.toLocaleString().padStart(10));
}
