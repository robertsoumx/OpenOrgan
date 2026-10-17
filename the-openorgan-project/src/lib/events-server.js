import { unstable_cache } from "next/cache";
import snapshot from "@/data/events-snapshot.json";
import { curateEvents } from "@/lib/events-core.mjs";
import { refreshCalendars } from "@/lib/events-refresh.mjs";
import { getActivePublicDocuments, getPublicDocument } from "@/lib/server-data";
const pullCalendars = unstable_cache(() => refreshCalendars(snapshot), ["openorgan-official-calendars-v5"], { revalidate:21600, tags:["event-calendars"] });
export async function getEventFeed() {
  const [remote,hosted] = await Promise.all([pullCalendars(),getActivePublicDocuments("events",500)]);
  return {events:curateEvents([...remote.events,...hosted]),sources:remote.sources,generatedAt:new Date().toISOString()};
}
export async function getEvent(id) {
  if (!id?.startsWith("curated-")) return getPublicDocument("events",id);
  const feed=await pullCalendars();
  return feed.events.find(e=>e.id===id) || null;
}
