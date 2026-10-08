import { unstable_cache } from "next/cache";
import snapshot from "@/data/events-snapshot.json";
import { EVENT_SOURCES, parseTrinity, curateEvents } from "@/lib/events-core.mjs";
import { getActivePublicDocuments, getPublicDocument } from "@/lib/server-data";

const pullCalendars = unstable_cache(async () => {
  const checks = await Promise.all(EVENT_SOURCES.map(async source => {
    try {
      const response = await fetch(source.url, { cache: "no-store", signal: AbortSignal.timeout(12000), headers: { "User-Agent": "OpenOrgan/1.0 (+https://openorgan.org/about)" } });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const checkedAt = new Date().toISOString();
      const events = parseTrinity(await response.text(), source, checkedAt);
      if (!events.length) throw new Error("Published schedule could not be parsed");
      return { sourceId: source.id, events, checkedAt, ok: true };
    } catch (error) {
      console.warn("Event source " + source.id + ": " + error.message);
      return { sourceId: source.id, events: snapshot.events.filter(e => e.sourceId === source.id), checkedAt: snapshot.checkedAt, ok: false };
    }
  }));
  return { events: checks.flatMap(x => x.events), sources: checks.map(({ events, ...check }) => check) };
}, ["openorgan-official-calendars-v1"], { revalidate: 21600, tags: ["event-calendars"] });

export async function getEventFeed() {
  const [remote, hosted] = await Promise.all([pullCalendars(), getActivePublicDocuments("events", 500)]);
  return { events: curateEvents([...remote.events, ...hosted]), sources: remote.sources, generatedAt: new Date().toISOString() };
}
export async function getEvent(id) {
  if (!id?.startsWith("curated-")) return getPublicDocument("events", id);
  const feed = await pullCalendars();
  return feed.events.find(e => e.id === id) || null;
}
