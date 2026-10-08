import Link from "next/link";
import EventCard from "@/components/EventCard";
export default function HomeHighlights({ events = [] }) {
  const upcoming = events.filter(e => new Date(e.startDateTime) >= new Date()).slice(0, 3);
  return <section className="section home-events"><div className="container"><div className="flex-between home-events-heading"><div><span className="eyebrow">A seat worth taking</span><h2>Coming up in Boston</h2><p>Real performances. Remarkable instruments.</p></div><Link className="text-link" href="/events">Explore the calendar</Link></div><div className="grid-3">{upcoming.length ? upcoming.map(event => <EventCard key={event.id} event={event} />) : <div className="empty-state"><h3>New dates are on their way</h3><p>Explore the calendar for recently held events.</p></div>}</div></div></section>;
}
