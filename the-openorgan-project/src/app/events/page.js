import EventList from "@/components/EventList";
import { getEventFeed } from "@/lib/events-server";
export const revalidate = 21600;
export const metadata = { title: "Find events", description: "Find organ recitals, concerts, and workshops by date, venue, or driving route, with organizer and admission details.", alternates: { canonical: "/events" } };
export default async function EventsPage() { const feed = await getEventFeed(); return <EventList initialEvents={feed.events} sources={feed.sources} generatedAt={feed.generatedAt} />; }
