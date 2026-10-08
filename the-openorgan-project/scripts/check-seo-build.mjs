import fs from "node:fs";
import assert from "node:assert/strict";
const html = fs.readFileSync(".next/server/app/index.html","utf8");
const events = fs.readFileSync(".next/server/app/events.html","utf8");
const robots = fs.readFileSync(".next/server/app/robots.txt.body","utf8");
const sitemap = fs.readFileSync(".next/server/app/sitemap.xml.body","utf8");
assert.match(html, /rel="canonical" href="https:\/\/openorgan\.org/);
assert.match(robots, /Sitemap: https:\/\/openorgan\.org\/sitemap.xml/);
assert.ok(!sitemap.includes("localhost"));
assert.match(sitemap, /https:\/\/openorgan\.org\/events\/curated-trinity-boston-/);
const snapshot = JSON.parse(fs.readFileSync("src/data/events-snapshot.json","utf8"));
const future = snapshot.events.filter(e => new Date(e.startDateTime)>new Date(snapshot.checkedAt)).slice(0,3);
for (const event of future) { assert.ok(html.includes(event.performer)); assert.ok(events.includes(event.performer)); }
console.log("Production HTML contains current event cards and correct canonical, robots and sitemap URLs.");
