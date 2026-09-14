// RailKhoj sitemap generator.
// Usage: node server/scripts/gen-sitemap.mjs --domain https://trains.example.com
// Writes web/public/sitemap.xml (run `npm run build` afterwards so it lands in dist).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOMAIN_ARG = process.argv.find((a) => a.startsWith("--domain="));
const domain = (
  DOMAIN_ARG ? DOMAIN_ARG.split("=")[1] : process.env.SITE_URL
)?.replace(/\/+$/, "") || "https://railkhoj.example.com";

const trainsRaw = JSON.parse(
  readFileSync(path.resolve(__dirname, "..", "src", "data", "trains.json"), "utf8")
);
const today = new Date().toISOString().slice(0, 10);

const urls = [
  { loc: "/", priority: "1.0" },
  { loc: "/search", priority: "0.8" },
  ...trainsRaw.map((t) => ({ loc: `/train/${t.id}`, priority: "0.6" })),
];

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((u) =>
    [
      "  <url>",
      `    <loc>${domain}${u.loc}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>daily</changefreq>`,
      `    <priority>${u.priority}</priority>`,
      "  </url>",
    ].join("\n")
  ),
  "</urlset>",
  "",
].join("\n");

const out = path.resolve(__dirname, "..", "..", "web", "public", "sitemap.xml");
writeFileSync(out, xml, "utf8");
console.log(`Wrote ${out} with ${urls.length} URLs`);