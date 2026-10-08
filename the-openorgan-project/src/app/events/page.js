import EventList from "@/components/EventList";
import { getEventFeed } from "@/lib/events-server";
export const revalidate = 21600;
export const metadata = { title: "Boston Organ Concerts & Recitals", description: "Upcoming and recent organ recitals in Greater Boston, curated from official church calendars with dates, venues, and admission details.", alternates: { canonical: "/events" } };
export default async function EventsPage() { const feed = await getEventFeed(); return <EventList initialEvents={feed.events} sources={feed.sources} generatedAt={feed.generatedAt} />; }
