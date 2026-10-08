"use client";
import { useMemo, useState } from "react";
import EventCard from "@/components/EventCard";
import { eventDate } from "@/lib/events-core.mjs";
export default function EventList({ initialEvents = [], sources = [], generatedAt }) {
  const [period, setPeriod] = useState("upcoming"), [search, setSearch] = useState("");
  const now = new Date(generatedAt).getTime();
  const filtered = useMemo(() => initialEvents.filter(event => {
    const date = new Date(event.endDateTime || event.startDateTime).getTime();
    return (period === "upcoming" ? date >= now : date < now) && [event.title, event.organizationName, event.location?.city].join(" ").toLowerCase().includes(search.toLowerCase());
  }), [initialEvents, now, period, search]);
  const verifiedDates = sources.map(x => x.checkedAt).filter(Boolean).sort();
  return <section className="section"><div className="container">
    <div className="page-header editorial-header"><span className="eyebrow">The sound of the city</span><h1>Make room for<br />live music.</h1><p>Organ recitals and concerts, selected from official calendars across Greater Boston.</p></div>
    <div className="search-toolbar event-filters"><div className="segmented" aria-label="Event period">{["upcoming", "recent"].map(p => <button type="button" key={p} className={p === period ? "active" : ""} aria-pressed={p === period} onClick={() => setPeriod(p)}>{p === "upcoming" ? "Coming up" : "Recently held"}</button>)}</div><label className="event-search"><span className="visually-hidden">Search events</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search performer, venue, or city" type="search" /></label></div>
    <p className="small muted">{filtered.length} {filtered.length === 1 ? "event" : "events"}{verifiedDates.length ? " · Official calendars checked " + eventDate(verifiedDates[0]) : ""}. {sources.some(x => !x.ok) ? "A source is unavailable; showing its last verified schedule. " : ""}Confirm the latest details with the organizer.</p>
    {filtered.length ? <div className="grid-3">{filtered.map(event => <EventCard key={event.id} event={event} recent={period === "recent"} />)}</div> : <div className="empty-state"><h2>{search ? "No matching events" : "No verified events in this period"}</h2><p>{search ? "Try another performer or venue." : "New published dates appear when the official calendars update."}</p></div>}
  </div></section>;
}
