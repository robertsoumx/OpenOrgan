import EventList from "@/components/EventList";
import { getEventFeed } from "@/lib/events-server";
export const revalidate = 21600;
export const metadata = { title: "Organ Concerts & Recitals", description: "Find organ recitals, concerts, and workshops with dates, venue addresses, and admission details from official organizers.", alternates: { canonical: "/events" } };
export default async function EventsPage() { const feed = await getEventFeed(); return <EventList initialEvents={feed.events} sources={feed.sources} generatedAt={feed.generatedAt} />; }
