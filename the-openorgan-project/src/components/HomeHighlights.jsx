import { diverseUpcoming } from "@/lib/events-core.mjs";
import Link from "next/link";
import EventCard from "@/components/EventCard";
export default function HomeHighlights({ events = [] }) {
  const upcoming = diverseUpcoming(events);
  return <section className="section home-events"><div className="container"><div className="flex-between home-events-heading"><div><h2>Upcoming events</h2></div><Link className="text-link" href="/events">View all events</Link></div><div className="grid-3">{upcoming.length ? upcoming.map(event => <EventCard key={event.id} event={event} headingLevel={3} />) : <div className="empty-state"><h3>No upcoming events</h3><p>View the events page for recently held recitals.</p></div>}</div></div></section>;
}
