import fs from "node:fs/promises";
import { EVENT_SOURCES, parseTrinity, curateEvents } from "../src/lib/events-core.mjs";
const checkedAt = new Date().toISOString();
const pulled = await Promise.all(EVENT_SOURCES.map(async source => {
  const response = await fetch(source.url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(source.name + ": HTTP " + response.status);
  const events = parseTrinity(await response.text(), source, checkedAt);
  if (!events.length) throw new Error(source.name + ": no dated recitals parsed; snapshot preserved");
  return events;
}));
const events = curateEvents(pulled.flat());
if (!events.some(e => new Date(e.startDateTime) >= new Date())) throw new Error("No upcoming events verified; snapshot preserved");
const filename = "src/data/events-snapshot.json";
if (process.argv.includes("--if-changed")) {
  const previous = await fs.readFile(filename, "utf8").then(JSON.parse).catch(() => null);
  const facts = list => JSON.stringify((list || []).map(({ sourceCheckedAt, ...event }) => event));
  const unchanged = previous && facts(previous.events) === facts(events);
  const checkedRecently = previous && Date.now() - Date.parse(previous.checkedAt) < 24 * 60 * 60 * 1000;
  if (unchanged && checkedRecently) {
    console.log("Official calendar verified; dates unchanged and snapshot checked within 24 hours.");
    process.exit(0);
  }
}
await fs.mkdir("src/data", { recursive: true });
await fs.writeFile(filename, JSON.stringify({ checkedAt, events }, null, 2) + "\n");
console.log("Verified " + events.length + " recent/upcoming events from " + EVENT_SOURCES.length + " official calendar(s).");
